import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import { SECTION_RE, STUDENT_NO_RE, formatStudentNumberInput } from '../../lib/studentNumber.js';
import StudentNumberInput from '../../components/StudentNumberInput.jsx';

const LABEL = 'text-xs font-semibold uppercase tracking-wider text-shush-inkSoft';
const INPUT =
  'mt-2 block w-full rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-3 text-sm text-shush-ink placeholder:text-shush-muted focus:border-shush-orange focus:ring-1 focus:ring-shush-orange';

const EMPTY = { studentNo: '', lastName: '', firstName: '', middleInitial: '', section: '' };

export default function StudentSignUp() {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  function validate() {
    if (!STUDENT_NO_RE.test(form.studentNo)) return 'Student number must look like 21-0001.';
    if (!form.lastName.trim() || !form.firstName.trim()) return 'Please enter your first and last name.';
    if (form.middleInitial && !/^[A-Za-z]$/.test(form.middleInitial.replace(/\.$/, ''))) {
      return 'Middle initial must be a single letter.';
    }
    if (!SECTION_RE.test(form.section.trim().toUpperCase())) return 'Section must look like BSIT-3D.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await api.studentSignUp({ ...form, section: form.section.trim().toUpperCase() });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-[2rem] border border-shush-line bg-shush-white p-6 shadow-2xl sm:p-8 lg:p-10">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-shush-ink">You are registered</h1>
          <p className="mt-3 text-sm text-shush-inkSoft">You can now sign in with your student number.</p>
          <Link
            to="/student/login"
            className="mt-8 inline-block rounded-xl bg-shush-orange px-6 py-3 text-sm font-medium text-white shadow-md hover:bg-shush-orange600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl rounded-[2rem] border border-shush-line bg-shush-white p-6 shadow-2xl sm:p-8 lg:p-10">
      <h1 className="text-3xl font-semibold tracking-tight text-shush-ink">Sign up</h1>
      <p className="mt-2 text-sm text-shush-inkSoft">Enter your details exactly as they appear on your student record.</p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-5 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <Alert>{error}</Alert>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="su-student-no" className={LABEL}>Student number</label>
          <StudentNumberInput
            id="su-student-no"
            value={form.studentNo}
            onChange={(d) => setForm((f) => ({ ...f, studentNo: formatStudentNumberInput(d) }))}
          />
        </div>

        <div>
          <label htmlFor="su-last" className={LABEL}>Last name</label>
          <input id="su-last" autoComplete="family-name" maxLength={50} value={form.lastName} onChange={set('lastName')} className={INPUT} />
        </div>

        <div>
          <label htmlFor="su-first" className={LABEL}>First name</label>
          <input id="su-first" autoComplete="given-name" maxLength={50} value={form.firstName} onChange={set('firstName')} className={INPUT} />
        </div>

        <div>
          <label htmlFor="su-mi" className={LABEL}>Middle initial <span className="font-normal normal-case text-shush-muted">(optional)</span></label>
          <input id="su-mi" maxLength={2} value={form.middleInitial} onChange={set('middleInitial')} className={INPUT} />
        </div>

        <div>
          <label htmlFor="su-section" className={LABEL}>Section</label>
          <input
            id="su-section"
            placeholder="BSIT-3D"
            maxLength={12}
            value={form.section}
            onChange={(e) => setForm((f) => ({ ...f, section: e.target.value.toUpperCase() }))}
            className={INPUT}
          />
        </div>

        <p className="text-xs text-shush-muted sm:col-span-2">
          Section format: course, dash, year and letter, for example BSIT-3D, BSCS-1D or BSEE-2D.
        </p>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-shush-orange px-4 py-3.5 text-sm font-medium text-white shadow-md transition hover:bg-shush-orange600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-shush-inkSoft">
        Already registered?{' '}
        <Link to="/student/login" className="font-medium text-shush-orange700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange">
          Sign in
        </Link>
      </p>
    </div>
  );
}
