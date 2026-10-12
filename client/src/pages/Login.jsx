import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';

// Frequency bars on the left panel: [size + colour classes]
const WAVE_BARS = [
  'h-6 bg-blue-300/20',
  'h-10 bg-blue-300/25',
  'h-14 bg-blue-300/35',
  'h-20 bg-blue-300/40',
  'h-16 bg-blue-300/45',
  'h-28 bg-blue-300/60',
  'h-36 bg-blue-200/80',
  'h-24 bg-blue-300/65',
  'h-32 bg-blue-100',
  'h-20 bg-amber-50 shadow-[0_0_12px_rgba(255,255,255,0.45)]',
  'h-28 bg-blue-200/90',
  'h-[4.5rem] bg-blue-300/60',
  'h-12 bg-blue-300/40',
  'h-16 bg-blue-300/35',
  'h-9 bg-blue-300/25',
  'h-7 bg-blue-300/20',
  'h-4 bg-blue-300/15',
];

const INPUT =
  'block w-full rounded-xl border border-[#d6cfbe] bg-transparent py-3 pl-11 text-slate-800 placeholder:text-slate-400/80 focus:border-[#1b2d5a] focus:ring-1 focus:ring-[#1b2d5a] text-sm leading-6 transition';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = location.state?.registered === true;

  const [facultyId, setFacultyId] = useState(location.state?.facultyId ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ facultyId: facultyId.trim(), password, remember });
      navigate('/console', { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1b2d5a] font-sans antialiased flex items-center justify-center p-4 sm:p-8 md:p-12 selection:bg-[#1b2d5a] selection:text-white">
      {/* Outer rounded canvas with warm background */}
      <main className="w-full max-w-4xl bg-[#f7f5ed] rounded-[2.5rem] shadow-2xl p-4 sm:p-5 md:p-6 min-h-[600px] flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-[540px]">
          {/* Deep navy hero card */}
          <section className="lg:col-span-5 bg-gradient-to-b from-[#1b2d5b] via-[#16274e] to-[#111f3e] rounded-[2rem] p-6 sm:p-8 md:p-10 text-white relative overflow-hidden flex flex-col justify-between shadow-xl">
            {/* Decorative Concentric Acoustic Waves */}
            <div className="sonar-ring sonar-ring-1" />
            <div className="sonar-ring sonar-ring-2" />
            <div className="sonar-ring sonar-ring-3" />

            <div className="relative z-10 space-y-4 max-w-sm">
              {/* Active Status Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-blue-100 font-medium tracking-wide">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>System Online</span>
                <span className="text-white/40">•</span>
                <span>18 Nodes Active</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-[2.4rem] font-medium leading-[1.18] tracking-tight text-white">
                Welcome back to peace &amp; quiet.
              </h1>
              <p className="text-slate-300/85 text-sm sm:text-base leading-relaxed font-light">
                Real-time acoustic telemetry and zone management across all library tables.
              </p>
            </div>

            {/* Sound Wave Frequency Visualizer */}
            <div className="relative z-10 pt-12 pb-4" aria-hidden="true">
              <div className="flex items-center gap-1.5 sm:gap-2 h-32 overflow-hidden">
                {WAVE_BARS.map((classes, i) => (
                  <div key={i} className={`waveform-bar w-1.5 sm:w-2 ${classes}`} />
                ))}
              </div>
            </div>
          </section>

          {/* Login form on warm cream surface */}
          <section className="lg:col-span-7 flex flex-col justify-center px-4 sm:px-8 lg:px-12 py-5">
            <div className="max-w-md w-full mx-auto space-y-6">
              <header className="space-y-3.5">
                <div className="flex items-center gap-3">
                  {/* Acoustic Bar Logo Icon */}
                  <svg aria-hidden="true" className="h-8 w-8 text-[#1b2d5a]" fill="currentColor" viewBox="0 0 32 32">
                    <rect height="12" rx="1.75" width="3.5" x="4" y="10" />
                    <rect height="20" rx="1.75" width="3.5" x="10.5" y="6" />
                    <rect height="26" rx="1.75" width="3.5" x="17" y="3" />
                    <rect height="12" rx="1.75" width="3.5" x="23.5" y="10" />
                  </svg>
                  <span className="text-xl font-bold tracking-wider text-[#1b2d5a]">SHUSH</span>
                </div>
                <div>
                  <h2 className="text-3xl font-semibold text-[#152549] tracking-tight">Sign in to SHUSH</h2>
                  <p className="text-slate-600 text-sm mt-1.5 font-normal">
                    Access your library acoustic monitoring console.
                  </p>
                </div>
              </header>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {justRegistered && !error && (
                  <Alert type="success">Account created. Sign in with your Faculty ID and password.</Alert>
                )}
                <Alert>{error}</Alert>

                {/* Faculty ID */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 tracking-wide opacity-0" htmlFor="faculty-id">
                    Faculty ID
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.374a4.5 4.5 0 00-6.338 0 .75.75 0 00.522.251h5.294a.75.75 0 00.522-.251z" />
                      </svg>
                    </div>
                    <input
                      className={`${INPUT} pr-4`}
                      id="faculty-id"
                      name="faculty-id"
                      placeholder="e.g. FAC-2024-8841"
                      required
                      maxLength={30}
                      autoComplete="username"
                      type="text"
                      value={facultyId}
                      onChange={(e) => setFacultyId(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 tracking-wide" htmlFor="password">
                      Password
                    </label>
                    {/* Password reset isn't built yet, so this link doesn't go anywhere. */}
                    <a
                      className="text-xs font-medium text-[#1b2d5a] hover:underline focus:outline-none focus:ring-1 focus:ring-[#1b2d5a] rounded"
                      href="#forgot-password"
                      onClick={(e) => e.preventDefault()}
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <input
                      className={`${INPUT} pr-11`}
                      id="password"
                      name="password"
                      placeholder="Enter your password"
                      required
                      maxLength={128}
                      autoComplete="current-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      aria-label="Toggle password visibility"
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center">
                  <input
                    className="h-4 w-4 rounded border-[#cbbfab] text-[#1b2d5a] focus:ring-[#1b2d5a] bg-transparent"
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <label className="ml-2.5 block text-xs font-normal text-slate-600" htmlFor="remember-me">
                    Keep console active on this workstation
                  </label>
                </div>

                {/* Primary Action Button */}
                <button
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1b2d5a] hover:bg-[#16254a] active:bg-[#111e3b] px-4 py-3.5 text-sm font-medium text-white shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1b2d5a] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={submitting}
                  type="submit"
                >
                  <span>{submitting ? 'Signing in…' : 'Sign in to Console'}</span>
                  {!submitting && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div aria-hidden="true" className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#d8d2c3]" />
                </div>
                <div className="relative flex justify-center text-xs tracking-wider">
                  <span className="bg-[#f7f5ed] px-3 text-slate-400 font-medium">OR</span>
                </div>
              </div>

              <p className="text-center text-xs text-slate-600">
                Need an account?
                <Link className="font-medium text-[#1b2d5a] hover:underline underline-offset-2 ml-1" to="/signup">
                  Create your workspace
                </Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
