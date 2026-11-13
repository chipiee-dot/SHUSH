import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import StudentNumberInput from '../../components/StudentNumberInput.jsx';
import { useStudentAuth } from '../../context/StudentAuthContext.jsx';
import { formatTime } from '../../lib/format.js';
import { STUDENT_NO_RE, formatStudentNumberInput } from '../../lib/studentNumber.js';

export default function StudentLogin() {
  const { setStudent, logout } = useStudentAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState(null); // { student, session }
  const [notice, setNotice] = useState(location.state?.notice ?? null);

  const seated = Boolean(found?.session);

  async function handleContinue(e) {
    e.preventDefault();
    setError('');
    setNotice(null);
    if (!STUDENT_NO_RE.test(raw)) {
      setError('Enter your student number, like 21-0001.');
      return;
    }
    setBusy(true);
    try {
      setFound(await api.studentLookup(raw));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

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
    <div className="mx-auto w-full max-w-4xl">
      <div className="grid gap-0 overflow-hidden rounded-[2rem] border border-shush-line bg-shush-white shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="auth-hero hidden flex-col justify-center p-8 lg:flex lg:p-10">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">Check in to your quiet seat.</h2>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/85">For a better study environment.</p>
          </div>
        </aside>

        <div className="p-6 sm:p-8 lg:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-shush-ink">Sign in</h1>
          <p className="mt-2 text-sm text-shush-inkSoft">Enter your student number. You will confirm your name next.</p>

          <form onSubmit={handleContinue} className="mt-8 space-y-4" noValidate>
            {notice && <Alert type={notice.type}>{notice.text}</Alert>}
            <Alert>{error}</Alert>
            <div>
              <label htmlFor="student-no" className="block text-center text-xs font-semibold uppercase tracking-wider text-shush-inkSoft">
                Student number
              </label>
              <div className="mt-3 sm:[&_input]:h-16 sm:[&_input]:w-12">
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
              className="w-full rounded-xl bg-shush-orange px-4 py-3.5 text-sm font-medium text-white shadow-md transition hover:bg-shush-orange600 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-shush-inkSoft">
            New here?{' '}
            <Link
              to="/student/signup"
              className="font-medium text-shush-orange700 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-shush-orange focus:ring-offset-2 rounded px-1"
            >
              Sign up with your student number
            </Link>
          </p>

          <p className="mt-2 text-center text-sm text-shush-inkSoft">
            <Link
              to="/login"
              className="font-medium text-shush-orange700 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-shush-orange focus:ring-offset-2 rounded px-1"
            >
              Faculty sign-in
            </Link>
          </p>
        </div>
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
