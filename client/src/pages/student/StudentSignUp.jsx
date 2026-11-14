import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import { SECTION_RE, STUDENT_NO_RE, formatStudentNumberInput } from '../../lib/studentNumber.js';
import Logo from '../../components/Logo.jsx';
import StudentNumberInput from '../../components/StudentNumberInput.jsx';

const LABEL = 'text-xs font-semibold uppercase tracking-wider text-shush-inkSoft';
// Keeps the six boxes on one line inside the card. Same 44px boxes as the component default from 640px up.
const BOXES_FIT =
  '[&_input]:h-12 [&_input]:w-9 [&>div]:gap-1.5 sm:[&_input]:h-14 sm:[&_input]:w-11 sm:[&>div]:gap-2';
const FOCUS_LINK =
  'rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';
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

  const brand = (
    <div className="flex items-center gap-3">
      <Logo className="h-8 w-8 text-shush-orange" />
      <span className="text-xl font-extrabold tracking-[0.18em] text-shush-ink">SHUSH</span>
    </div>
  );

  if (done) {
    return (
      <div className="space-y-6">
        {brand}
        <div>
          <h2 id="student-auth-heading" className="text-3xl font-bold tracking-tight text-shush-ink">You are registered</h2>
          <p className="mt-1.5 text-sm text-shush-inkSoft">You can now sign in with your student number.</p>
        </div>
        <Link
          to="/student/login"
          className="inline-flex w-full items-center justify-center rounded-xl bg-shush-orange600 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-shush-orange700 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="space-y-4">
        {brand}
        <div>
          <h2 id="student-auth-heading" className="text-3xl font-bold tracking-tight text-shush-ink">Sign up</h2>
          <p className="mt-1.5 text-sm text-shush-inkSoft">Enter your details exactly as they appear on your student record.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-5 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <Alert>{error}</Alert>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="su-student-no" className={`block text-center ${LABEL}`}>Student number</label>
          <div className={`mt-2 ${BOXES_FIT}`}>
            <StudentNumberInput
              id="su-student-no"
              value={form.studentNo}
              onChange={(d) => setForm((f) => ({ ...f, studentNo: formatStudentNumberInput(d) }))}
            />
          </div>
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
            className="w-full rounded-xl bg-shush-orange600 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-shush-orange700 active:bg-shush-orange700 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-xs text-shush-inkSoft">
        Already registered?
        <Link to="/student/login" className={`ml-1 font-medium text-shush-orange700 hover:underline underline-offset-2 ${FOCUS_LINK}`}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
