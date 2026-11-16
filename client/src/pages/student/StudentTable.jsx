import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { useStudentAuth } from '../../context/StudentAuthContext.jsx';
import { formatTime } from '../../lib/format.js';

const REFRESH_MS = 20000;

function TableTile({ table, selected, onSelect }) {
  const disabled = !table.open;
  const reason = table.underMaintenance ? 'Under maintenance' : table.free === 0 ? 'Full' : `Only ${table.free} free`;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={() => onSelect(table.tableNo)}
      className={`rounded-xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange ${
        selected
          ? 'border-shush-orange bg-shush-goldSoft text-shush-ink shadow-md'
          : disabled
          ? 'cursor-not-allowed border-dashed border-shush-line bg-shush-creamDeep text-shush-muted'
          : 'border-shush-line bg-shush-white text-shush-ink hover:border-shush-orangeSoft hover:shadow-sm'
      }`}
    >
      <div className="text-base font-semibold">Table {table.tableNo}</div>
      <div className={`mt-1 text-xs ${selected ? 'text-shush-orange700' : disabled ? 'text-shush-muted' : 'text-shush-inkSoft'}`}>
        {disabled ? reason : `${table.free} of ${table.seats} seats free`}
      </div>
    </button>
  );
}

export default function StudentTable() {
  const { student, session, checking, refresh, logout } = useStudentAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const loadTables = useCallback(async () => {
    try {
      const data = await api.studentTables();
      setTables(data.tables);
      setSelected((current) => (data.tables.some((t) => t.tableNo === current && t.open) ? current : null));
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }, []);

  const seated = Boolean(session);

  // If the student already has a table open, show it (with End session) instead of the picker.
  useEffect(() => {
    if (student) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!student || seated) return undefined;
    loadTables();
    const timer = setInterval(loadTables, REFRESH_MS);
    return () => clearInterval(timer);
  }, [student, seated, loadTables]);

  if (!checking && !student) return <Navigate to="/student/login" replace />;
  if (checking || !student) return <p className="text-sm text-shush-inkSoft">Loading…</p>;

  const firstName = student.firstName;
  const chosen = tables.find((t) => t.tableNo === selected) ?? null;

  async function handleStart() {
    setBusy(true);
    setMessage(null);
    try {
      await api.studentStartSession(selected);
      setConfirming(false);
      // Back to sign-in. The session stays open until the student signs in again or 2 hours pass.
      navigate('/student/login', {
        replace: true,
        state: {
          notice: {
            type: 'success',
            text: `You are seated at Table ${selected}. To end your session, sign in with your student number again.`,
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
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-shush-ink">You are seated, {firstName}</h1>
          <p className="mt-1 text-sm text-shush-inkSoft">Enjoy your time at the library. End your session when you leave.</p>
        </div>
        <Alert type={message?.type ?? 'success'}>{message?.text}</Alert>
        <div className="rounded-xl border border-shush-line bg-shush-white px-5 py-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-shush-muted">Table</dt>
              <dd className="mt-1 text-2xl font-semibold text-shush-ink">{session.tableNo}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-shush-muted">Since</dt>
              <dd className="mt-1 text-2xl font-semibold text-shush-ink">{formatTime(session.startedAt)}</dd>
            </div>
          </dl>
        </div>
        <button
          type="button"
          onClick={() => setEnding(true)}
          className="rounded-xl border border-shush-lineStrong px-5 py-3 text-sm font-medium text-shush-orange700 transition hover:bg-shush-orange hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
        >
          End session
        </button>

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-shush-ink">Hi, {firstName}</h1>
        <p className="mt-1 text-sm text-shush-inkSoft">
          {student.section} · choose a table for your visit.
        </p>
      </div>

      <Alert type={message?.type ?? 'error'}>{message?.text}</Alert>

      <div>
        <div className="text-sm font-semibold text-shush-ink">Choose a table</div>
        {tables.length === 0 ? (
          <p className="mt-3 text-sm text-shush-inkSoft">Loading tables…</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tables.map((t) => (
              <TableTile key={t.tableNo} table={t} selected={t.tableNo === selected} onSelect={setSelected} />
            ))}
          </div>
        )}
        {tables.length > 0 && !tables.some((t) => t.open) && (
          <p className="mt-3 text-sm text-shush-inkSoft">
            No table has a free seat right now. Check back soon.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-shush-line bg-shush-white px-5 py-4">
        <div className="text-sm text-shush-inkSoft">
          {chosen
            ? <>Table <b className="text-shush-ink">{chosen.tableNo}</b></>
            : 'Select a table to continue.'}
        </div>
        <button
          type="button"
          disabled={!chosen}
          onClick={() => setConfirming(true)}
          className="rounded-xl bg-shush-orange px-5 py-3 text-sm font-medium text-white shadow-md transition hover:bg-shush-orange600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2 disabled:opacity-40"
        >
          Continue
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
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
