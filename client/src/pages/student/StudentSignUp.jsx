import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import { SECTION_RE, STUDENT_NO_RE, formatSectionInput, formatStudentNumberInput } from '../../lib/studentNumber.js';
import Logo from '../../components/Logo.jsx';
import StudentNumberInput from '../../components/StudentNumberInput.jsx';
import SuccessCheck from '../../components/SuccessCheck.jsx';
import '../../components/motion.css';

const LABEL = 'text-xs font-semibold uppercase tracking-wider text-shush-inkSoft lg:text-sm 2xl:text-base';
// Keeps the six boxes on one line inside the card. Same 44px boxes as the component default from 640px up.
const BOXES_FIT =
  '[&_input]:h-12 [&_input]:w-9 [&>div]:gap-1.5 sm:[&_input]:h-14 sm:[&_input]:w-11 sm:[&>div]:gap-2 lg:[&_input]:h-16 lg:[&_input]:w-12 lg:[&_input]:text-2xl lg:[&>div]:gap-3 2xl:[&_input]:h-[4.5rem] 2xl:[&_input]:w-14';
const FOCUS_LINK =
  'rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';
const INPUT =
  'mt-2 block w-full rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-3 text-sm text-shush-ink lg:py-3.5 lg:text-base 2xl:py-4 2xl:text-lg placeholder:text-shush-muted focus:border-shush-orange focus:ring-1 focus:ring-shush-orange';

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
      <Logo className="h-8 w-8 text-shush-orange lg:h-10 lg:w-10" />
      <span className="text-xl font-extrabold tracking-[0.18em] text-shush-ink lg:text-2xl">SHUSH</span>
    </div>
  );

  if (done) {
    return (
      <div className="shush-rise space-y-6">
        {brand}
        <span className="grid h-16 w-16 place-items-center rounded-full bg-shush-goldSoft text-shush-orange700">
          <SuccessCheck className="h-10 w-10" />
        </span>
        <div>
          <h2 id="student-auth-heading" className="text-3xl font-bold tracking-tight text-shush-ink lg:text-4xl 2xl:text-5xl">You are registered</h2>
          <p className="mt-1.5 text-sm text-shush-inkSoft lg:mt-2 lg:text-base 2xl:text-lg">You can now sign in with your student number.</p>
        </div>
        <Link
          to="/student/login"
          className="m-shine inline-flex w-full items-center justify-center rounded-xl bg-shush-orange600 px-4 py-3.5 text-base font-semibold text-white shadow-md lg:py-4 2xl:py-[1.1rem] 2xl:text-lg transition hover:bg-shush-orange700 active:bg-shush-orange700 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
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
          <h2 id="student-auth-heading" className="text-3xl font-bold tracking-tight text-shush-ink lg:text-4xl 2xl:text-5xl">Sign up</h2>
          <p className="mt-1.5 text-sm text-shush-inkSoft lg:mt-2 lg:text-base 2xl:text-lg">Enter your details exactly as they appear on your student record.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-5 sm:grid-cols-2 lg:mt-8 lg:gap-6" noValidate>
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
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={form.section}
            onChange={(e) => setForm((f) => ({ ...f, section: formatSectionInput(e.target.value) }))}
            className={INPUT}
          />
        </div>

        <p className="text-xs text-shush-muted sm:col-span-2 lg:text-sm">
          Type your section and the dash is added for you, for example BSIT3D becomes BSIT-3D.
        </p>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="m-shine w-full rounded-xl bg-shush-orange600 px-4 py-3.5 text-base font-semibold text-white shadow-md lg:py-4 2xl:py-[1.1rem] 2xl:text-lg transition hover:bg-shush-orange700 active:bg-shush-orange700 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-xs text-shush-inkSoft lg:text-sm 2xl:text-base">
        Already registered?
        <Link to="/student/login" className={`ml-1 font-medium text-shush-orange700 hover:underline underline-offset-2 ${FOCUS_LINK}`}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
