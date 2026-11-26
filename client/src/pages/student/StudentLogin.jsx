import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Logo from '../../components/Logo.jsx';
import { useToast } from '../../components/Toast.jsx';
import '../../components/motion.css';
import StudentNumberInput from '../../components/StudentNumberInput.jsx';
import { useStudentAuth } from '../../context/StudentAuthContext.jsx';
import useFacultyShortcut from '../../hooks/useFacultyShortcut.js';
import { formatTime } from '../../lib/format.js';
import { STUDENT_NO_RE, formatStudentNumberInput } from '../../lib/studentNumber.js';

// Keeps the six boxes on one line inside the card. Same 44px boxes as the component default from 640px up.
const BOXES_FIT =
  '[&_input]:h-12 [&_input]:w-9 [&>div]:gap-1.5 sm:[&_input]:h-14 sm:[&_input]:w-11 sm:[&>div]:gap-2 lg:[&_input]:h-16 lg:[&_input]:w-12 lg:[&_input]:text-2xl lg:[&>div]:gap-3 2xl:[&_input]:h-[4.5rem] 2xl:[&_input]:w-14';
const FOCUS_LINK =
  'rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';

// "H:MM:SS", never negative.
function clock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const sec = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

/** Live session summary: time in the library, time left (bar drains), and when the session ends. */
function SessionTimer({ session }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.endsAt).getTime();
  const total = Math.max(1, end - start);
  const left = Math.max(0, end - now);
  const pct = Math.min(100, (left / total) * 100);
  const low = left > 0 && pct <= 15;

  return (
    <div className="mt-3 border-t border-shush-line pt-3">
      <div className="text-sm text-shush-inkSoft">Seated at Table {session.tableNo} since {formatTime(session.startedAt)}</div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-shush-white"
        role="progressbar"
        aria-label="Session time left"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none ${low ? 'bg-shush-danger' : 'bg-shush-orange'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3 tabular-nums">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-shush-muted">In library</div>
          <div className="font-semibold text-shush-ink">{clock(now - start)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-wider text-shush-muted">Time left</div>
          <div className={`font-semibold ${low ? 'text-shush-danger' : 'text-shush-ink'}`}>{left > 0 ? clock(left) : 'Time is up'}</div>
        </div>
      </div>
      <div className="mt-1.5 text-xs text-shush-muted">Session ends at {formatTime(session.endsAt)}</div>
    </div>
  );
}

export default function StudentLogin() {
  const { setStudent, logout } = useStudentAuth();
  // Ctrl+Shift+F opens the faculty sign-in. Deliberately not shown anywhere on the page.
  useFacultyShortcut();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  // The landing page can hand over a student number: look it up straight away.
  const prefill = location.state?.studentNo ?? '';
  const [raw, setRaw] = useState(STUDENT_NO_RE.test(prefill) ? prefill : '');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null); // { student, session }

  const seated = Boolean(found?.session);

  async function lookup(studentNo) {
    if (!STUDENT_NO_RE.test(studentNo)) {
      toast.error('Enter your student number, like 21-0001.');
      return;
    }
    setBusy(true);
    try {
      setFound(await api.studentLookup(studentNo));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleContinue(e) {
    e.preventDefault();
    lookup(raw);
  }

  useEffect(() => {
    if (STUDENT_NO_RE.test(prefill)) lookup(prefill);
    // Only on first load; the number came from the landing page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirm() {
    setBusy(true);
    try {
      const data = await api.studentLogin(found.student.studentNo);
      if (data.session) {
        // Signing in again while seated ends the session.
        await api.studentEndSession();
        await logout();
        setFound(null);
        setRaw('');
        toast.success(`Session at Table ${data.session.tableNo} ended. Thanks for visiting!`);
      } else {
        setStudent(data.student);
        navigate('/student/table', { replace: true });
      }
    } catch (err) {
      toast.error(err.message);
      setFound(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8 text-shush-orange lg:h-10 lg:w-10" />
          <span className="text-xl font-extrabold tracking-[0.18em] text-shush-ink lg:text-2xl">SHUSH</span>
        </div>
        <div>
          <h2 id="student-auth-heading" className="text-3xl font-bold tracking-tight text-shush-ink lg:text-4xl 2xl:text-5xl">Sign in</h2>
          <p className="mt-1.5 text-sm text-shush-inkSoft lg:mt-2 lg:text-base 2xl:text-lg">Enter your student number. You will confirm your name next.</p>
        </div>
      </header>

      <form onSubmit={handleContinue} className="mt-6 space-y-4 lg:mt-8 lg:space-y-5" noValidate>
        <div>
          <label htmlFor="student-no" className="block text-center text-xs font-semibold uppercase tracking-wider text-shush-inkSoft lg:text-sm 2xl:text-base">
            Student number
          </label>
          <div className={`mt-3 ${BOXES_FIT}`}>
            <StudentNumberInput
              id="student-no"
              value={raw}
              onChange={(d) => setRaw(formatStudentNumberInput(d))}
              autoFocus
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="m-shine w-full rounded-xl bg-shush-orange600 px-4 py-3.5 text-base font-semibold text-white shadow-md lg:py-4 2xl:py-[1.1rem] 2xl:text-lg transition hover:bg-shush-orange700 active:bg-shush-orange700 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </form>

      <div aria-hidden="true" className="my-6 flex items-center gap-3 text-xs font-medium tracking-wider text-shush-muted lg:my-8 lg:text-sm 2xl:text-base">
        <span className="h-px flex-1 bg-shush-line" />
        OR
        <span className="h-px flex-1 bg-shush-line" />
      </div>

      <div className="space-y-3 text-center text-xs text-shush-inkSoft lg:text-sm 2xl:text-base">
        <p>
          New here?
          <Link to="/student/signup" className={`ml-1 font-medium text-shush-orange700 hover:underline underline-offset-2 ${FOCUS_LINK}`}>
            Sign up with your student number
          </Link>
        </p>
      </div>

      <ConfirmDialog
        open={Boolean(found)}
        title={seated ? 'Log out of your session?' : 'Is this you?'}
        confirmLabel={seated ? 'Yes, log me out' : "Yes, that's me"}
        cancelLabel={seated ? 'Not me' : 'No, go back'}
        onConfirm={handleConfirm}
        onCancel={() => setFound(null)}
        busy={busy}
      >
        {found && (
          <div className="rounded-xl border border-shush-line bg-shush-creamDeep px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-shush-muted">Name</div>
            <div className="text-lg font-semibold text-shush-ink">{found.student.name}</div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-shush-muted">Section</div>
            <div className="font-medium text-shush-ink">{found.student.section}</div>
            <div className="mt-2 text-xs text-shush-muted">Student number {found.student.studentNo}</div>
            {seated && <SessionTimer session={found.session} />}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
