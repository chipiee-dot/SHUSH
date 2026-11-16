import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';
import AuthLayout, { AuthHero } from '../components/AuthLayout.jsx';
import FacultyIdInput from '../components/FacultyIdInput.jsx';
import Logo from '../components/Logo.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { isCompleteFacultyId, toFacultyId } from '../lib/facultyId.js';

const SLIDES = [
  { title: 'Live table status', text: 'See quiet, loud and alert tables as they happen.' },
  { title: 'Manage the floor', text: 'Add tables, set seat counts and schedule maintenance.' },
  { title: 'Recognize quiet study', text: 'Rewards highlight frequent and quiet visitors.' },
];

const FOCUS_LINK =
  'rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = location.state?.registered === true;

  // The sign-up page passes the full ID ('FAC-2026-2005'); this keeps it in the same shape.
  const [facultyId, setFacultyId] = useState(() => toFacultyId(location.state?.facultyId ?? ''));
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!isCompleteFacultyId(facultyId)) {
      setError('Enter your full Faculty ID: FAC-0000-0000.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await login({ facultyId, password, remember });
      navigate('/console', { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      labelledBy="login-heading"
      hero={
        <AuthHero
          title="Welcome back to peace & quiet."
          subtitle="Real-time acoustic telemetry and zone management across all library tables."
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
          <h2 id="login-heading" className="text-3xl font-bold tracking-tight text-shush-ink lg:text-4xl 2xl:text-5xl">Sign in to SHUSH</h2>
          <p className="mt-1.5 text-sm text-shush-inkSoft lg:mt-2 lg:text-base 2xl:text-lg">Access your library acoustic monitoring console.</p>
        </div>
      </header>

      <form className="mt-6 space-y-4 lg:mt-8 lg:space-y-5" onSubmit={handleSubmit} noValidate>
        {justRegistered && !error && (
          <Alert type="success">Account created. Sign in with your Faculty ID and password.</Alert>
        )}
        <Alert>{error}</Alert>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold tracking-wide text-shush-ink lg:text-sm 2xl:text-base" htmlFor="faculty-id">
            Faculty ID
          </label>
          <FacultyIdInput id="faculty-id" value={facultyId} onChange={setFacultyId} required />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold tracking-wide text-shush-ink lg:text-sm 2xl:text-base" htmlFor="password">
              Password
            </label>
            {/* Password reset isn't built yet, so this link doesn't go anywhere. */}
            <a
              className={`text-xs font-medium text-shush-orange700 hover:underline lg:text-sm 2xl:text-base ${FOCUS_LINK}`}
              href="#forgot-password"
              onClick={(e) => e.preventDefault()}
            >
              Forgot password?
            </a>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center">
          <input
            className="h-4 w-4 rounded border-shush-lineStrong lg:h-5 lg:w-5 bg-shush-white text-shush-orange focus:ring-shush-orange"
            id="remember-me"
            name="remember-me"
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <label className="ml-2.5 block text-xs text-shush-inkSoft lg:text-sm 2xl:text-base" htmlFor="remember-me">
            Keep console active on this workstation
          </label>
        </div>

        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-shush-orange px-4 py-3.5 text-base font-semibold text-white shadow-md lg:py-4 2xl:py-[1.1rem] 2xl:text-lg transition hover:bg-shush-orange600 active:bg-shush-orange700 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          <span>{submitting ? 'Signing in…' : 'Sign in to Console'}</span>
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

      <div className="space-y-3 text-center text-xs text-shush-inkSoft lg:text-sm 2xl:text-base">
        <p>
          <Link className={`font-medium text-shush-orange700 hover:underline underline-offset-2 ${FOCUS_LINK}`} to="/student/login">
            Student check-in →
          </Link>
        </p>
        <p>
          Need an account?
          <Link className={`ml-1 font-medium text-shush-orange700 hover:underline underline-offset-2 ${FOCUS_LINK}`} to="/signup">
            Create your workspace
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
