import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useToast } from '../../components/Toast.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import CloudBackground from '../../components/CloudBackground.jsx';
import ConfirmTableDialog from '../../components/ConfirmTableDialog.jsx';
import StudentCertificates from '../../components/StudentCertificates.jsx';
import SeatRing from '../../components/SeatRing.jsx';
import StudentFloorPlan from '../../components/StudentFloorPlan.jsx';
import StudentTableTile, { StudentTableSkeleton, YourTable } from '../../components/StudentTableTile.jsx';
import { useStudentAuth } from '../../context/StudentAuthContext.jsx';
import { formatTime } from '../../lib/format.js';
import '../../components/student-table.css';
import '../../components/motion.css';

const REFRESH_MS = 20000;
const VIEW_KEY = 'shush.studentTableView';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function readView() {
  try {
    const v = sessionStorage.getItem(VIEW_KEY);
    return v === 'cards' || v === 'plan' ? v : null;
  } catch {
    return null;
  }
}

const CARD = 'rounded-3xl border border-shush-line bg-shush-white/90 p-6 shadow-[0_10px_30px_-18px_rgba(242,95,19,0.35)] backdrop-blur sm:p-8';
const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';

const LEGEND = [
  ['st-dot', 'Open'],
  ['st-dot st-dot--last', 'Last seat'],
  ['st-dot st-dot--full', 'Full'],
  ['st-dot st-dot--maint', 'Under maintenance'],
];

/* The 16px ring that empties over one refresh. Its key is the last update time, so it restarts on every refresh. */
function RefreshRing({ updatedAt }) {
  return (
    <svg
      key={updatedAt ? updatedAt.getTime() : 'waiting'}
      viewBox="0 0 16 16"
      className="h-4 w-4 flex-none -rotate-90"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6" className="st-drain-track" />
      <circle cx="8" cy="8" r="6" className="st-drain-arc" style={{ animationDuration: `${REFRESH_MS}ms` }} />
    </svg>
  );
}

/* "Live · updated 9:30 AM" with a softly pulsing dot. The seconds are told by the ring, the words say it too. */
function LivePill({ updatedAt }) {
  return (
    <p
      className="inline-flex items-center gap-2 rounded-full border border-shush-line bg-shush-white/80 px-3 py-1 text-xs font-medium text-shush-inkSoft"
      title="Seats refresh every 20 seconds"
    >
      <span className="relative flex h-2 w-2 flex-none" aria-hidden="true">
        <span className="shush-pulse-ring absolute inset-0 rounded-full bg-shush-orange" />
        <span className="relative h-2 w-2 rounded-full bg-shush-orange" />
      </span>
      <span>{updatedAt ? `Live · updated ${formatTime(updatedAt)}` : 'Live · loading seats'}</span>
      {updatedAt && <RefreshRing updatedAt={updatedAt} />}
      <span className="sr-only">Seats refresh every 20 seconds.</span>
    </p>
  );
}

/* Adapted from BrewedOps Motion Library: Ring progress */
const TIME_R = 44;
const TIME_C = 2 * Math.PI * TIME_R;
const CLOCK_MS = 30000;

function formatSpan(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* "Seated for 1h 12m" and a ring of time used out of the session maximum. Updates every 30 seconds.
   maxHours comes from the server; without it the ring is left out. */
function SessionClock({ startedAt, maxHours }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(id);
  }, []);

  const start = new Date(startedAt).getTime();
  const elapsed = Number.isFinite(start) ? Math.max(0, now - start) : 0;
  const maxMs = maxHours ? maxHours * 3600000 : 0;
  const used = maxMs > 0 ? Math.min(1, elapsed / maxMs) : 0;
  const left = maxMs > 0 ? Math.max(0, maxMs - elapsed) : 0;
  const label = elapsed < 60000 ? 'Seated for less than a minute' : `Seated for ${formatSpan(elapsed)}`;

  return (
    <div className="flex items-center gap-4">
      {maxMs > 0 && (
        <div
          className="relative h-24 w-24 flex-none"
          role="img"
          aria-label={`${formatSpan(elapsed)} used of ${maxHours} ${maxHours === 1 ? 'hour' : 'hours'}`}
        >
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true" focusable="false">
            <circle cx="50" cy="50" r={TIME_R} className="st-ring-track" />
            <circle
              cx="50"
              cy="50"
              r={TIME_R}
              className="st-time-arc"
              strokeDasharray={TIME_C}
              strokeDashoffset={TIME_C * (1 - used)}
              style={{ opacity: used > 0 ? 1 : 0 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
            <span className="text-lg font-extrabold leading-none text-shush-ink">{formatSpan(left)}</span>
            <span className="mt-0.5 text-[11px] font-semibold text-shush-inkSoft">left</span>
          </div>
        </div>
      )}
      <p className="text-base font-semibold text-shush-ink">{label}</p>
    </div>
  );
}

export default function StudentTable() {
  const { student, session, checking, refresh, logout } = useStudentAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const failedRef = useRef(false); // so a list that keeps failing shows one toast, not one per refresh
  const [tables, setTables] = useState(null); // null while the first list loads
  const [updatedAt, setUpdatedAt] = useState(null);
  const [maxHours, setMaxHours] = useState(null); // from the server, never hard-coded here
  const [chosenNo, setChosenNo] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [chosenView, setChosenView] = useState(readView); // null until the student picks one
  const canShowPlan = useMediaQuery('(min-width: 768px)');
  const planByDefault = useMediaQuery('(min-width: 1024px)');

  const loadTables = useCallback(async () => {
    try {
      const data = await api.studentTables();
      setTables(data.tables);
      setMaxHours(data.maxSessionHours ?? null);
      setUpdatedAt(new Date());
      failedRef.current = false;
      setLoadFailed(false);
    } catch (err) {
      if (!failedRef.current) toast.error(err.message);
      failedRef.current = true;
      setLoadFailed(true);
      setTables((current) => current ?? []);
    }
  }, [toast]);

  const seated = Boolean(session);

  // If the student already has a table open, show it (with End session) instead of the picker.
  useEffect(() => {
    if (student) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The picker refreshes every 20 seconds. The seated view only needs the seat count once.
  useEffect(() => {
    if (!student) return undefined;
    loadTables();
    if (seated) return undefined;
    // Skip the refresh while the tab is hidden; refresh once when the student comes back.
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') loadTables();
    };
    const timer = setInterval(refreshIfVisible, REFRESH_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [student, seated, loadTables]);

  if (!checking && !student) return <Navigate to="/student/login" replace />;
  if (checking || !student) return <p className="text-sm text-shush-inkSoft">Loading…</p>;

  const firstName = student.firstName;
  const sorted = tables ? [...tables].sort((a, b) => a.tableNo - b.tableNo) : null;
  const chosen = sorted?.find((t) => t.tableNo === chosenNo) ?? null;
  const anyOpen = Boolean(sorted?.some((t) => t.open));
  const visible = sorted ? (onlyOpen ? sorted.filter((t) => t.open) : sorted) : null;

  // The ring counts tables that are not under maintenance. `open` comes from the server.
  const bookable = sorted ? sorted.filter((t) => !t.underMaintenance) : null;
  const seatsFree = bookable ? bookable.reduce((sum, t) => sum + Math.max(0, Number(t.free) || 0), 0) : null;
  const seatsTotal = bookable ? bookable.reduce((sum, t) => sum + Math.max(0, Math.floor(Number(t.seats) || 0)), 0) : null;
  const tablesOpen = bookable ? bookable.filter((t) => t.open).length : null;
  const openCount = sorted ? sorted.filter((t) => t.open).length : null;

  // Floor plan needs 768px+ and a saved position for every table. Cards are the default below 1024px.
  const hasPlan = canShowPlan && Boolean(sorted?.length) && sorted.every((t) => t.grid);
  const mode = hasPlan && (chosenView ?? (planByDefault ? 'plan' : 'cards')) === 'plan' ? 'plan' : 'cards';

  function chooseView(v) {
    setChosenView(v);
    try {
      sessionStorage.setItem(VIEW_KEY, v);
    } catch {
      /* the choice just is not remembered */
    }
  }

  function handlePick(no) {
    setChosenNo(no);
    setConfirming(true);
  }

  async function handleStart() {
    setBusy(true);
    try {
      await api.studentStartSession(chosenNo);
      setConfirming(false);
      // Back to sign-in. The session stays open until the student signs in again or 2 hours pass.
      toast.success(`Seated at Table ${chosenNo}. Sign in again to end your session.`);
      navigate('/student/login', { replace: true });
      await logout();
    } catch (err) {
      setConfirming(false);
      if (/already have a table/i.test(err.message)) {
        await refresh();
      } else {
        toast.error(err.message);
        loadTables();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd() {
    setBusy(true);
    try {
      await api.studentEndSession();
      setEnding(false);
      toast.success('Session ended. Thanks for visiting!');
      navigate('/student/login', { replace: true });
      await logout();
    } catch (err) {
      setEnding(false);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (seated) {
    const mine = sorted?.find((t) => t.tableNo === session.tableNo);
    return (
      <div className="space-y-6">
        <div className={CARD}>
          <h1 className="text-3xl font-semibold tracking-tight text-shush-ink">You are seated, {firstName}</h1>
          <p className="mt-1 text-sm text-shush-inkSoft">Enjoy your time at the library. End your session when you leave.</p>

          <div className="mt-6 grid items-center gap-8 md:grid-cols-[18rem_1fr]">
            <div className="st-seat-stage">
              <YourTable
                tableNo={session.tableNo}
                seats={mine?.seats}
                taken={mine ? mine.seats - mine.free : 0}
              />
            </div>
            <div>
              <SessionClock startedAt={session.startedAt} maxHours={maxHours} />
              <div className="mt-5" />
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-shush-muted">Table</dt>
                  <dd className="mt-1 text-2xl font-semibold text-shush-ink">{session.tableNo}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-shush-muted">Since</dt>
                  <dd className="mt-1 text-2xl font-semibold text-shush-ink">{formatTime(session.startedAt)}</dd>
                </div>
                {session.endsAt && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-shush-muted">Ends automatically at</dt>
                    <dd className="mt-1 text-2xl font-semibold text-shush-ink">{formatTime(session.endsAt)}</dd>
                  </div>
                )}
              </dl>
              <button
                type="button"
                onClick={() => setEnding(true)}
                className={`m-shine mt-6 rounded-xl bg-shush-orange600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-shush-orange700 active:bg-shush-orange700 ${RING}`}
              >
                End session
              </button>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={ending}
          title="End your session?"
          confirmLabel="End session"
          cancelLabel="Stay"
          onConfirm={handleEnd}
          onCancel={() => setEnding(false)}
          busy={busy}
        >
          You are leaving Table {session.tableNo}. Your visit will be recorded as finished.
        </ConfirmDialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`${CARD} relative overflow-hidden`}>
        <CloudBackground variant="card" />
        <div className="relative z-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-shush-ink">
                Hi, <span className="st-marker">{firstName}</span>
              </h1>
              <p className="mt-1 text-sm text-shush-inkSoft">{student.section} · pick a table.</p>
              <div className="mt-3">
                <LivePill updatedAt={updatedAt} />
              </div>
            </div>
            <SeatRing free={seatsFree} total={seatsTotal} openTables={tablesOpen} totalTables={bookable ? bookable.length : null} />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-shush-inkSoft" aria-label="What the tiles mean">
              {LEGEND.map(([dot, label]) => (
                <li key={label} className="flex items-center gap-2">
                  <span className={dot} aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              {hasPlan && (
                <div className="inline-flex rounded-full border border-shush-lineStrong bg-shush-white p-0.5" role="group" aria-label="Table view">
                  {[
                    ['cards', 'Cards'],
                    ['plan', 'Floor plan'],
                  ].map(([key, text]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={mode === key}
                      onClick={() => chooseView(key)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${RING} ${
                        mode === key ? 'bg-shush-orange600 text-white' : 'text-shush-inkSoft hover:bg-shush-creamDeep'
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                aria-pressed={onlyOpen}
                onClick={() => setOnlyOpen((v) => !v)}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${RING} ${
                  onlyOpen
                    ? 'border-shush-orange bg-shush-goldSoft text-shush-ink'
                    : 'border-shush-lineStrong bg-shush-white text-shush-inkSoft hover:bg-shush-creamDeep'
                }`}
              >
                Open tables only{openCount !== null ? ` · ${openCount}` : ''}
              </button>
            </div>
          </div>
        </div>
      </div>

      <StudentCertificates />

      {sorted && sorted.length === 0 && !loadFailed && (
        <p className="text-sm text-shush-inkSoft">No tables are set up yet.</p>
      )}
      {sorted && sorted.length > 0 && !anyOpen && (
        <div className="st-panel flex items-center gap-3 rounded-2xl border border-shush-line bg-shush-white/90 px-5 py-4 text-sm font-medium text-shush-ink">
          <RefreshRing updatedAt={updatedAt} />
          <p>All tables are taken right now. This page refreshes every 20 seconds.</p>
        </div>
      )}

      {mode === 'plan' && <StudentFloorPlan tables={sorted} onPick={handlePick} onlyOpen={onlyOpen} />}

      {mode === 'cards' && (!sorted || (visible && visible.length > 0)) && (
        <div
          key={onlyOpen ? 'open' : 'all'}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5"
        >
          {visible ? (
            visible.map((t, i) => <StudentTableTile key={t.tableNo} table={t} index={i} onPick={handlePick} />)
          ) : (
            <StudentTableSkeleton />
          )}
        </div>
      )}

      <ConfirmTableDialog
        open={confirming && Boolean(chosen)}
        table={chosen}
        student={student}
        maxSessionHours={maxHours}
        busy={busy}
        onConfirm={handleStart}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
