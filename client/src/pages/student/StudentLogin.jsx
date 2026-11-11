import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { useStudentAuth } from '../../context/StudentAuthContext.jsx';
import { STUDENT_NO_RE, formatStudentNumberInput } from '../../lib/studentNumber.js';

const INPUT =
  'mt-2 block w-full rounded-xl border border-[#d6cfbe] bg-transparent px-4 py-3 text-lg tracking-widest text-slate-800 placeholder:text-slate-400 focus:border-[#1b2d5a] focus:ring-1 focus:ring-[#1b2d5a]';

export default function StudentLogin() {
  const { student, checking, setStudent } = useStudentAuth();
  const navigate = useNavigate();
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState(null);

  if (!checking && student) return <Navigate to="/student/table" replace />;

  async function handleContinue(e) {
    e.preventDefault();
    setError('');
    if (!STUDENT_NO_RE.test(raw)) {
      setError('Enter your student number, like 21-0001.');
      return;
    }
    setBusy(true);
    try {
      const data = await api.studentLookup(raw);
      setFound(data.student);
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
      const data = await api.studentLogin(found.studentNo);
      setStudent(data.student);
      navigate('/student/table', { replace: true });
    } catch (err) {
      setError(err.message);
      setFound(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-semibold tracking-tight text-[#152549]">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">Enter your student number. You will confirm your name next.</p>

      <form onSubmit={handleContinue} className="mt-8 space-y-4" noValidate>
        <Alert>{error}</Alert>
        <div>
          <label htmlFor="student-no" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Student number
          </label>
          <input
            id="student-no"
            name="student-no"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="21-0001"
            maxLength={7}
            value={raw}
            onChange={(e) => setRaw(formatStudentNumberInput(e.target.value))}
            className={INPUT}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#1b2d5a] px-4 py-3.5 text-sm font-medium text-white shadow-md transition hover:bg-[#16254a] disabled:opacity-60"
        >
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        New here?{' '}
        <Link to="/student/signup" className="font-medium text-[#1b2d5a] underline-offset-4 hover:underline">
          Sign up with your student number
        </Link>
      </p>

      <ConfirmDialog
        open={Boolean(found)}
        title="Is this you?"
        confirmLabel="Yes, that's me"
        cancelLabel="No, go back"
        onConfirm={handleConfirm}
        onCancel={() => setFound(null)}
        busy={busy}
      >
        {found && (
          <div className="rounded-xl border border-[#d6cfbe] bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Name</div>
            <div className="text-lg font-semibold text-[#152549]">{found.name}</div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Section</div>
            <div className="font-medium text-[#152549]">{found.section}</div>
            <div className="mt-2 text-xs text-slate-500">Student number {found.studentNo}</div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
