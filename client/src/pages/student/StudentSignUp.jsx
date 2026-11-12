import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { SECTION_RE, STUDENT_NO_RE, formatStudentNumberInput } from '../../lib/studentNumber.js';
import StudentNumberInput from '../../components/StudentNumberInput.jsx';

const LABEL = 'text-xs font-semibold uppercase tracking-wider text-slate-600';
const INPUT =
  'mt-2 block w-full rounded-xl border border-[#d6cfbe] bg-transparent px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#1b2d5a] focus:ring-1 focus:ring-[#1b2d5a]';

const EMPTY = { studentNo: '', lastName: '', firstName: '', middleInitial: '', section: '' };

export default function StudentSignUp() {
  const { notify } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
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
    const problem = validate();
    if (problem) {
      notify('error', problem);
      return;
    }
    setBusy(true);
    try {
      await api.studentSignUp({ ...form, section: form.section.trim().toUpperCase() });
      setDone(true);
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-[#152549]">You are registered</h1>
        <p className="mt-3 text-sm text-slate-600">You can now sign in with your student number.</p>
        <Link
          to="/student/login"
          className="mt-8 inline-block rounded-xl bg-[#1b2d5a] px-6 py-3 text-sm font-medium text-white shadow-md hover:bg-[#16254a]"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold tracking-tight text-[#152549]">Sign up</h1>
      <p className="mt-2 text-sm text-slate-600">Enter your details exactly as they appear on your student record.</p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-5 sm:grid-cols-2" noValidate>

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
          <label htmlFor="su-mi" className={LABEL}>Middle initial <span className="font-normal normal-case text-slate-500">(optional)</span></label>
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

        <p className="text-xs text-slate-500 sm:col-span-2">
          Section format: course, dash, year and letter, for example BSIT-3D, BSCS-1D or BSEE-2D.
        </p>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#1b2d5a] px-4 py-3.5 text-sm font-medium text-white shadow-md transition hover:bg-[#16254a] disabled:opacity-60"
          >
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/student/login" className="font-medium text-[#1b2d5a] underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
