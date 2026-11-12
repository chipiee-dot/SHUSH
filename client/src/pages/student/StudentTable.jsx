import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Logo from '../../components/Logo.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useStudentAuth } from '../../context/StudentAuthContext.jsx';
import { formatTime } from '../../lib/format.js';

const REFRESH_MS = 20000;
const GROUP_SIZE = 1; // the new design has no group selector

export default function StudentTable() {
  const { notify } = useToast();
  const { student, session, checking, refresh, logout } = useStudentAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);

  const seated = Boolean(session);

  const loadTables = useCallback(async () => {
    try {
      const data = await api.studentTables(GROUP_SIZE);
      setTables(data.tables);
      setSelected((current) => (data.tables.some((t) => t.tableNo === current && t.fits) ? current : null));
    } catch (err) {
      notify('error', err.message);
    }
  }, []);

  // If the student already has a table open, show it instead of the picker.
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
  if (checking || !student) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  const chosen = tables.find((t) => t.tableNo === selected) ?? null;

  async function handleSignOut() {
    try {
      await logout();
    } finally {
      navigate('/student/login', { replace: true });
    }
  }

  async function handleStart() {
    setBusy(true);
    try {
      await api.studentStartSession(selected, GROUP_SIZE);
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
        notify('error', err.message);
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
      navigate('/student/login', {
        replace: true,
        state: { notice: { type: 'success', text: 'You have been logged out of your session. Thank you for visiting.' } },
      });
      await logout();
    } catch (err) {
      setEnding(false);
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Logo className="h-7 w-7 text-blue-700" />
        <div>
          <div className="text-xl font-bold leading-none tracking-tight text-slate-900">SHUSH</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Student check-in</div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1"
      >
        Sign out
      </button>
    </header>
  );


  if (seated) {
    return (
      <div className="flex flex-col gap-6 rounded-3xl bg-white p-8 shadow-2xl">
        {header}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">You are seated, {student.firstName}</h1>
          <p className="mt-2 text-sm font-medium text-slate-500 md:text-base">Enjoy your time at the library. End your session when you leave.</p>
        </div>
        <dl className="grid gap-4 rounded-2xl border border-slate-200 p-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Table</dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-900">{session.tableNo}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Group</dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-900">{session.groupSize}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Since</dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-900">{formatTime(session.startedAt)}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => setEnding(true)}
          className="self-start rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md"
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
          You are leaving Table {session.tableNo}. You will be signed out after this.
        </ConfirmDialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="p-8 pb-4">{header}</div>

      <div className="px-8 py-4">
        <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">Hi, {student.firstName}</h1>
        <p className="mt-2 text-sm font-medium text-slate-500 md:text-base">{student.section} · choose a table for your visit.</p>
      </div>

      <div className="mb-6 flex-1 px-8 py-4">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Choose a table</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {tables.map((table) => {
            const isSelected = selected === table.tableNo;
            const disabled = !table.fits;
            const label = table.underMaintenance
              ? 'Under maintenance'
              : table.free === 0
              ? 'Full'
              : `${table.free} of ${table.seats} seats free`;
            return (
              <button
                key={table.tableNo}
                type="button"
                onClick={() => !disabled && setSelected(table.tableNo)}
                disabled={disabled}
                aria-pressed={isSelected}
                className={`relative rounded-2xl border-2 p-5 text-left transition-all duration-200 focus:border-blue-600 focus:outline-none ${
                  disabled
                    ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-50'
                    : isSelected
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                    : 'cursor-pointer border-slate-100 bg-white hover:border-blue-300 hover:bg-slate-50/50 hover:shadow-sm'
                }`}
              >
                <div className={`mb-1 text-base font-bold ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>Table {table.tableNo}</div>
                <div className={`text-xs font-medium ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>{label}</div>
                {isSelected && <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-blue-600" />}
              </button>
            );
          })}
        </div>
        {tables.length === 0 && <p className="text-sm text-slate-500">Loading tables…</p>}
      </div>

      <div className="mt-auto flex flex-col items-center justify-between gap-4 border-t border-slate-200/60 bg-slate-50 p-6 px-8 sm:flex-row">
        <div className="text-sm font-medium text-slate-600">
          {chosen ? (
            <span>
              Ready to check in at <strong className="text-blue-700">Table {chosen.tableNo}</strong>.
            </span>
          ) : (
            'Select a table to continue.'
          )}
        </div>
        <button
          type="button"
          disabled={!chosen}
          onClick={() => setConfirming(true)}
          className={`w-full rounded-xl px-8 py-3 text-sm font-semibold shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:w-auto ${
            chosen
              ? 'bg-blue-600 text-white hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md'
              : 'cursor-not-allowed bg-slate-200 text-slate-400'
          }`}
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
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-lg font-semibold text-slate-900">Table {chosen.tableNo}</div>
            <div className="text-sm text-slate-600">{chosen.free} of {chosen.seats} seats free</div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
