import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Logo from '../../components/Logo.jsx';
import StudentNumberInput from '../../components/StudentNumberInput.jsx';
import { useStudentAuth } from '../../context/StudentAuthContext.jsx';
import { formatTime } from '../../lib/format.js';
import { STUDENT_NO_RE, formatStudentNumberInput } from '../../lib/studentNumber.js';

// Keeps the six boxes on one line inside the card. Same 44px boxes as the component default from 640px up.
const BOXES_FIT =
  '[&_input]:h-12 [&_input]:w-9 [&>div]:gap-1.5 sm:[&_input]:h-14 sm:[&_input]:w-11 sm:[&>div]:gap-2';
const FOCUS_LINK =
  'rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';

export default function StudentLogin() {
  const { setStudent, logout } = useStudentAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // The landing page can hand over a student number: look it up straight away.
  const prefill = location.state?.studentNo ?? '';
  const [raw, setRaw] = useState(STUDENT_NO_RE.test(prefill) ? prefill : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState(null); // { student, session }
  const [notice, setNotice] = useState(location.state?.notice ?? null);

  const seated = Boolean(found?.session);

  async function lookup(studentNo) {
    setError('');
    setNotice(null);
    if (!STUDENT_NO_RE.test(studentNo)) {
      setError('Enter your student number, like 21-0001.');
      return;
    }
    setBusy(true);
    try {
      setFound(await api.studentLookup(studentNo));
    } catch (err) {
      setError(err.message);
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
    setError('');
    try {
      const data = await api.studentLogin(found.student.studentNo);
      if (data.session) {
        // Signing in again while seated ends the session.
        await api.studentEndSession();
        await logout();
        setFound(null);
        setRaw('');
        setNotice({
          type: 'success',
          text: `You have been logged out of your session at Table ${data.session.tableNo}. Thank you for visiting.`,
        });
      } else {
        setStudent(data.student);
        navigate('/student/table', { replace: true });
      }
    } catch (err) {
      setError(err.message);
      setFound(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8 text-shush-orange" />
          <span className="text-xl font-extrabold tracking-[0.18em] text-shush-ink">SHUSH</span>
        </div>
        <div>
          <h2 id="student-auth-heading" className="text-3xl font-bold tracking-tight text-shush-ink">Sign in</h2>
          <p className="mt-1.5 text-sm text-shush-inkSoft">Enter your student number. You will confirm your name next.</p>
        </div>
      </header>

      <form onSubmit={handleContinue} className="mt-6 space-y-4" noValidate>
        {notice && <Alert type={notice.type}>{notice.text}</Alert>}
        <Alert>{error}</Alert>
        <div>
          <label htmlFor="student-no" className="block text-center text-xs font-semibold uppercase tracking-wider text-shush-inkSoft">
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
          className="w-full rounded-xl bg-shush-orange600 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-shush-orange700 active:bg-shush-orange700 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </form>

      <div aria-hidden="true" className="my-6 flex items-center gap-3 text-xs font-medium tracking-wider text-shush-muted">
        <span className="h-px flex-1 bg-shush-line" />
        OR
        <span className="h-px flex-1 bg-shush-line" />
      </div>

      <div className="space-y-3 text-center text-xs text-shush-inkSoft">
        <p>
          New here?
          <Link to="/student/signup" className={`ml-1 font-medium text-shush-orange700 hover:underline underline-offset-2 ${FOCUS_LINK}`}>
            Sign up with your student number
          </Link>
        </p>
        <p>
          <Link to="/login" className={`font-medium text-shush-orange700 hover:underline underline-offset-2 ${FOCUS_LINK}`}>
            Faculty sign-in
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
            {seated && (
              <p className="mt-3 text-sm text-shush-inkSoft">
                You are seated at Table {found.session.tableNo}, since {formatTime(found.session.startedAt)}.
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
