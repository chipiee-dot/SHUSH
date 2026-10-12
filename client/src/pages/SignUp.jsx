import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Alert from '../components/Alert.jsx';

// Soundwave bars on the left panel: [size + colour classes, glow?]
const WAVE_BARS = [
  ['h-10 bg-white/20'],
  ['h-16 bg-white/25'],
  ['h-24 bg-white/30'],
  ['h-20 bg-white/35'],
  ['h-28 bg-white/45'],
  ['h-36 bg-blue-200/50'],
  ['h-24 bg-blue-100/55'],
  ['h-44 bg-blue-100/65'],
  ['h-52 bg-white/80', true],
  ['h-32 bg-white/75', true],
  ['h-48 bg-white/90', true],
  ['h-60 bg-white', true],
  ['h-40 bg-amber-50/90', true],
  ['h-48 bg-white/95', true],
  ['h-36 bg-blue-100/80'],
  ['h-24 bg-blue-100/65'],
  ['h-32 bg-blue-200/50'],
  ['h-16 bg-white/40'],
  ['h-24 bg-white/30'],
  ['h-14 bg-white/25'],
  ['h-20 bg-white/20'],
  ['h-10 bg-white/15'],
  ['h-6 bg-white/10'],
];

const LABEL = 'block text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1';
const INPUT =
  'custom-input block w-full py-2 bg-[#ece6dc]/60 border border-[#d6cec2] rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:bg-white transition-colors duration-150';
const ICON_WRAP =
  'absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400';

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
  const [form, setForm] = useState(EMPTY_FORM);
  const FACULTY_ID_PATTERN = /^FAC-\d{4}-\d{4}$/;
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

      if (!FACULTY_ID_PATTERN.test(form.facultyId.trim())) {
      setError('Faculty ID must look like FAC-2024-1679.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.signUp(form);
      navigate('/login', { state: { registered: true, facultyId: form.facultyId.trim() } });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#273b6b] font-jakarta flex items-center justify-center p-4 sm:p-6 md:p-8 selection:bg-[#1d3268] selection:text-white">
      {/* Main Outer Light Cream Container Card */}
      <main className="w-full max-w-3xl bg-[#f5efe6] rounded-[28px] p-3 sm:p-4 md:p-5 shadow-2xl flex flex-col md:flex-row gap-5 lg:gap-7 items-stretch relative overflow-hidden">
        {/* Deep Navy Left Visual Panel */}
        <div className="md:w-[45%] bg-[#152754] rounded-[20px] p-5 sm:p-6 lg:p-7 flex flex-col justify-between relative overflow-hidden min-h-[320px] md:min-h-[440px] select-none shadow-inner">
          {/* Ambient Radial Concentric Wave Backgrounds */}
          <div className="absolute -right-24 bottom-12 w-[420px] h-[420px] rounded-full border border-white/[0.04] pointer-events-none" />
          <div className="absolute -right-12 bottom-20 w-[300px] h-[300px] rounded-full border border-white/[0.06] pointer-events-none" />
          <div className="absolute right-4 bottom-28 w-[190px] h-[190px] rounded-full border border-white/[0.08] pointer-events-none" />

          <div className="relative z-10 pt-2">
            <h1 className="text-white text-2xl sm:text-3xl lg:text-[32px] font-bold tracking-tight leading-[1.18] mb-4">
              A quieter library
              <br />
              starts here.
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm font-normal leading-relaxed opacity-90 max-w-[240px]">
              Monitor. Manage. Maintain.
              <br />
              For a better study environment.
            </p>
          </div>

          {/* Audio Equalizer / Soundwave Graphic */}
          <div className="relative z-10 mt-auto pt-8 pb-2 w-full flex items-center justify-start gap-[5px] sm:gap-[6px] h-32" aria-hidden="true">
            {WAVE_BARS.map(([classes, glow], i) => (
              <div
                key={i}
                className={`w-[5px] sm:w-[6px] ${classes} rounded-full self-center${glow ? ' glow-bar' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Right Clean Form Panel */}
        <div className="md:w-[55%] flex flex-col justify-center px-2 sm:px-3 md:px-4 py-4 md:py-5">
          {/* Brand Logo Header */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex items-center gap-[3px] h-7 text-[#14234b]" aria-hidden="true">
              <span className="w-[3px] h-3.5 bg-[#14234b] rounded-full inline-block" />
              <span className="w-[3px] h-6 bg-[#14234b] rounded-full inline-block" />
              <span className="w-[3px] h-7 bg-[#14234b] rounded-full inline-block" />
              <span className="w-[3px] h-4 bg-[#14234b] rounded-full inline-block" />
              <span className="w-[3px] h-2.5 bg-[#14234b] rounded-full inline-block" />
            </div>
            <span className="font-extrabold text-lg tracking-[0.2em] text-[#14234b] uppercase pt-0.5">SHUSH</span>
          </div>

          <div className="mb-3.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#14234b] tracking-tight">Create your account</h2>
            <p className="text-slate-600 text-xs mt-1 font-normal">Set up your SHUSH workspace to get started.</p>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <Alert>{error}</Alert>

            {/* Faculty ID */}
            <div>
              <label className={LABEL} htmlFor="faculty-id">Faculty ID</label>
              <div className="relative rounded-xl shadow-sm">
                <div className={ICON_WRAP}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                </div>
                                   <input
                     className={`${INPUT} pl-11 pr-4`}
                     id="faculty-id"
                     name="faculty_id"
                     placeholder="e.g. FAC-2024-8901"
                     required
                     maxLength={30}
                     autoComplete="username"
                     type="text"
                     value={form.facultyId}
                     onChange={set('facultyId')}
                   />
              </div>
            </div>

            {/* First Name, Last Name, M.I. */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5">
                <label className={LABEL} htmlFor="first-name">First Name</label>
                <input
                  className={`${INPUT} px-3`}
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
              <div className="col-span-5">
                <label className={LABEL} htmlFor="last-name">Last Name</label>
                <input
                  className={`${INPUT} px-3`}
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
              <div className="col-span-2">
                <label className={`${LABEL} text-center`} htmlFor="middle-initial">M.I.</label>
                <input
                  className={`${INPUT} px-2 text-center uppercase`}
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

            {/* Email */}
            <div>
              <label className={LABEL} htmlFor="email">Email Address</label>
              <div className="relative rounded-xl shadow-sm">
                <div className={ICON_WRAP}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <input
                  className={`${INPUT} pl-10 pr-4`}
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

            {/* Password */}
            <div>
              <label className={LABEL} htmlFor="password">Password</label>
              <div className="relative rounded-xl shadow-sm">
                <div className={ICON_WRAP}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <input
                  className={`${INPUT} pl-10 pr-10`}
                  id="password"
                  name="password"
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                />
                <button
                  aria-label="Toggle password visibility"
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className={LABEL} htmlFor="confirm-password">Confirm Password</label>
              <div className="relative rounded-xl shadow-sm">
                <div className={ICON_WRAP}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <input
                  className={`${INPUT} pl-10 pr-4`}
                  id="confirm-password"
                  name="confirm_password"
                  placeholder="Repeat your password"
                  required
                  maxLength={128}
                  autoComplete="new-password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-1.5">
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#1b2e60] hover:bg-[#14234b] text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg active:scale-[0.99] transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={submitting}
                type="submit"
              >
                <span>{submitting ? 'Creating account…' : 'Create account'}</span>
                {!submitting && (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
          </form>

          {/* OR Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#d8d0c4]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[#f5efe6] text-slate-400 font-medium tracking-widest text-[10px]">OR</span>
            </div>
          </div>

          <div className="text-center text-xs text-slate-600">
            Already have an account?
            <Link className="font-bold text-[#14234b] hover:underline underline-offset-2 ml-1" to="/login">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
