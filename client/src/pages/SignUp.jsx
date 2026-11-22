import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import AuthLayout, { AuthHero } from '../components/AuthLayout.jsx';
import FacultyIdInput from '../components/FacultyIdInput.jsx';
import Logo from '../components/Logo.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import PasswordRules from '../components/PasswordRules.jsx';
import { isCompleteFacultyId } from '../lib/facultyId.js';

const SLIDES = [
  { title: 'One account, whole console', text: 'Dashboard, Table layout, Rewards and History share one Faculty ID.' },
  { title: 'Faculty stay in control', text: 'Faculty can add tables and adjust device settings.' },
  { title: 'Students stay simple', text: 'Students check in with just their student number.' },
];

const LABEL = 'block text-xs font-semibold tracking-wide text-shush-ink lg:text-sm 2xl:text-base';
const INPUT =
  'block w-full rounded-xl border border-shush-lineStrong bg-shush-white px-3 py-3 text-sm leading-6 text-shush-ink lg:py-3.5 lg:text-base 2xl:py-4 2xl:text-lg placeholder:text-shush-muted shadow-sm transition focus:border-shush-orange focus:ring-2 focus:ring-shush-orange';
const FOCUS_LINK =
  'rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';

const EMPTY_FORM = {
  facultyId: '',
  firstName: '',
  lastName: '',
  middleInitial: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function SignUp() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();

    if (!isCompleteFacultyId(form.facultyId.trim())) {
      toast.error('Faculty ID must look like FAC-2024-1679.');
      return;
    }

    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.signUp(form);
      navigate('/login', { state: { registered: true, facultyId: form.facultyId.trim() } });
    } catch (err) {
      toast.error(err.message);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      formWidth="lg"
      labelledBy="signup-heading"
      hero={
        <AuthHero
          title="A quieter library starts here."
          subtitle="Monitor. Manage. Maintain. For a better study environment."
          slides={SLIDES}
        />
      }
    >
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8 text-shush-orange lg:h-10 lg:w-10" />
          <span className="text-xl font-extrabold tracking-[0.18em] text-shush-ink lg:text-2xl">SHUSH</span>
        </div>
        <div>
          <h2 id="signup-heading" className="text-3xl font-bold tracking-tight text-shush-ink lg:text-4xl 2xl:text-5xl">Create your account</h2>
          <p className="mt-1.5 text-sm text-shush-inkSoft lg:mt-2 lg:text-base 2xl:text-lg">Set up your SHUSH workspace to get started.</p>
        </div>
      </header>

      <form className="mt-6 space-y-4 lg:mt-8 lg:space-y-5" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1.5">
          <label className={LABEL} htmlFor="faculty-id">Faculty ID</label>
          <FacultyIdInput
            id="faculty-id"
            value={form.facultyId}
            onChange={(facultyId) => setForm((f) => ({ ...f, facultyId }))}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_5rem]">
          <div className="space-y-1.5">
            <label className={LABEL} htmlFor="first-name">First name</label>
            <input
              className={INPUT}
              id="first-name"
              name="first_name"
              placeholder="Jane"
              required
              maxLength={50}
              autoComplete="given-name"
              type="text"
              value={form.firstName}
              onChange={set('firstName')}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL} htmlFor="last-name">Last name</label>
            <input
              className={INPUT}
              id="last-name"
              name="last_name"
              placeholder="Doe"
              required
              maxLength={50}
              autoComplete="family-name"
              type="text"
              value={form.lastName}
              onChange={set('lastName')}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL} htmlFor="middle-initial">M.I.</label>
            <input
              className={`${INPUT} text-center uppercase`}
              id="middle-initial"
              name="middle_initial"
              placeholder="M."
              maxLength={2}
              autoComplete="additional-name"
              type="text"
              value={form.middleInitial}
              onChange={set('middleInitial')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={LABEL} htmlFor="email">Email address</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-shush-muted">
              <svg className="h-5 w-5 lg:h-6 lg:w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <input
              className={`${INPUT} pl-11 lg:pl-12`}
              id="email"
              name="email"
              placeholder="janedoe@gmail.com"
              required
              maxLength={254}
              autoComplete="email"
              type="email"
              value={form.email}
              onChange={set('email')}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className={LABEL} htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              name="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={set('password')}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL} htmlFor="confirm-password">Confirm password</label>
            <PasswordInput
              id="confirm-password"
              name="confirm_password"
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
            />
          </div>
        </div>

        <PasswordRules password={form.password} confirmPassword={form.confirmPassword} />

        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-shush-orange px-4 py-3.5 text-base font-semibold text-white shadow-md lg:py-4 2xl:py-[1.1rem] 2xl:text-lg transition hover:bg-shush-orange600 active:bg-shush-orange700 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          <span>{submitting ? 'Creating account…' : 'Create account'}</span>
          {!submitting && (
            <svg className="h-4 w-4 lg:h-5 lg:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </form>

      <div aria-hidden="true" className="my-6 flex items-center gap-3 text-xs font-medium tracking-wider text-shush-muted lg:my-8 lg:text-sm 2xl:text-base">
        <span className="h-px flex-1 bg-shush-line" />
        OR
        <span className="h-px flex-1 bg-shush-line" />
      </div>

      <p className="text-center text-xs text-shush-inkSoft lg:text-sm 2xl:text-base">
        Already have an account?
        <Link className={`ml-1 font-medium text-shush-orange700 hover:underline underline-offset-2 ${FOCUS_LINK}`} to="/login">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
