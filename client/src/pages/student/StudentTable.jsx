import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import StudentTableTile, { StudentTableSkeleton, YourTable } from '../../components/StudentTableTile.jsx';
import { useStudentAuth } from '../../context/StudentAuthContext.jsx';
import { formatTime } from '../../lib/format.js';
import '../../components/student-table.css';

const REFRESH_MS = 20000;

const CARD = 'rounded-3xl border border-shush-line bg-shush-white/90 p-6 shadow-[0_10px_30px_-18px_rgba(242,95,19,0.35)] backdrop-blur sm:p-8';
const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';

const LEGEND = [
  ['st-dot', 'Open'],
  ['st-dot st-dot--last', 'Last seat'],
  ['st-dot st-dot--full', 'Full'],
  ['st-dot st-dot--maint', 'Under maintenance'],
];

export default function StudentTable() {
  const { student, session, checking, refresh, logout } = useStudentAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState(null); // null while the first list loads
  const [updatedAt, setUpdatedAt] = useState(null);
  const [chosenNo, setChosenNo] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [onlyOpen, setOnlyOpen] = useState(false);

  const loadTables = useCallback(async () => {
    try {
      const data = await api.studentTables();
      setTables(data.tables);
      setUpdatedAt(new Date());
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setTables((current) => current ?? []);
    }
  }, []);

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
    const timer = setInterval(loadTables, REFRESH_MS);
    return () => clearInterval(timer);
  }, [student, seated, loadTables]);

  if (!checking && !student) return <Navigate to="/student/login" replace />;
  if (checking || !student) return <p className="text-sm text-shush-inkSoft">Loading…</p>;

  const firstName = student.firstName;
  const sorted = tables ? [...tables].sort((a, b) => a.tableNo - b.tableNo) : null;
  const chosen = sorted?.find((t) => t.tableNo === chosenNo) ?? null;
  const anyOpen = Boolean(sorted?.some((t) => t.open));
  const visible = sorted ? (onlyOpen ? sorted.filter((t) => t.open) : sorted) : null;

  function handlePick(no) {
    setChosenNo(no);
    setConfirming(true);
  }

  async function handleStart() {
    setBusy(true);
    setMessage(null);
    try {
      await api.studentStartSession(chosenNo);
      setConfirming(false);
      // Back to sign-in. The session stays open until the student signs in again or 2 hours pass.
      navigate('/student/login', {
        replace: true,
        state: {
          notice: {
            type: 'success',
            text: `You are seated at Table ${chosenNo}. To end your session, sign in with your student number again.`,
          },
        },
      });
      await logout();
    } catch (err) {
      setConfirming(false);
      if (/already have a table/i.test(err.message)) {
        await refresh();
      } else {
        setMessage({ type: 'error', text: err.message });
        loadTables();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd() {
    setBusy(true);
    setMessage(null);
    try {
      await api.studentEndSession();
      setEnding(false);
      navigate('/student/login', {
        replace: true,
        state: { notice: { type: 'success', text: 'You have been logged out of your session. Thank you for visiting.' } },
      });
      await logout();
    } catch (err) {
      setEnding(false);
      setMessage({ type: 'error', text: err.message });
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

          <div className="mt-6">
            <Alert type={message?.type ?? 'success'}>{message?.text}</Alert>
          </div>

          <div className="mt-6 grid items-center gap-8 md:grid-cols-[18rem_1fr]">
            <YourTable
              tableNo={session.tableNo}
              seats={mine?.seats}
              taken={mine ? mine.seats - mine.free : 0}
            />
            <div>
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
                className={`mt-6 rounded-xl bg-shush-orange px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-shush-orange600 active:bg-shush-orange700 ${RING}`}
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
      <div className={CARD}>
        <h1 className="text-3xl font-semibold tracking-tight text-shush-ink">Hi, {firstName}</h1>
        <p className="mt-1 text-sm text-shush-inkSoft">{student.section} · pick a table.</p>
        <p className="mt-1 text-xs text-shush-muted">
          Seats update every 20 seconds{updatedAt ? ` · updated ${formatTime(updatedAt)}` : ''}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-shush-inkSoft" aria-label="What the tiles mean">
            {LEGEND.map(([dot, label]) => (
              <li key={label} className="flex items-center gap-2">
                <span className={dot} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
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
            Open tables only
          </button>
        </div>
      </div>

      <Alert type={message?.type ?? 'error'}>{message?.text}</Alert>

      {sorted && sorted.length === 0 && !message && (
        <p className="text-sm text-shush-inkSoft">No tables are set up yet.</p>
      )}
      {sorted && sorted.length > 0 && !anyOpen && (
        <p className="rounded-2xl border border-shush-line bg-shush-white/90 px-5 py-4 text-sm font-medium text-shush-ink">
          All tables are taken right now. This page refreshes every 20 seconds.
        </p>
      )}

      {(!sorted || (visible && visible.length > 0)) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {visible ? visible.map((t) => <StudentTableTile key={t.tableNo} table={t} onPick={handlePick} />) : <StudentTableSkeleton />}
        </div>
      )}

      <ConfirmDialog
        open={confirming && Boolean(chosen)}
        title="Confirm your table"
        confirmLabel="Confirm and sit down"
        cancelLabel="Change"
        onConfirm={handleStart}
        onCancel={() => setConfirming(false)}
        busy={busy}
      >
        {chosen && (
          <div className="rounded-xl border border-shush-line bg-shush-white px-4 py-3">
            <div className="text-lg font-semibold text-shush-ink">Table {chosen.tableNo}</div>
            <div className="text-sm text-shush-inkSoft">
              {chosen.free} of {chosen.seats} seats free
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
