import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../context/StudentAuthContext.jsx';
import AuthLayout, { AuthHero } from './AuthLayout.jsx';
import BokehBackground from './BokehBackground.jsx';
import Logo from './Logo.jsx';

const SLIDES = [
  { title: 'Enter your student number', text: 'No password needed.' },
  { title: 'Pick an open table', text: 'See which tables have free seats.' },
  { title: 'Leave when you are done', text: 'Sign in again with your number to end your session.' },
];

// Sign-in and sign-up get the split auth layout; the table page keeps the card shell below.
const AUTH_PATH = /^\/student\/(login|signup)\/?$/;

export default function StudentShell() {
  const { student, checking, logout } = useStudentAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  async function handleSignOut() {
    try {
      await logout();
    } finally {
      navigate('/student/login', { replace: true });
    }
  }

  if (AUTH_PATH.test(pathname)) {
    return (
      <AuthLayout
        formWidth={pathname.includes('signup') ? 'lg' : 'md'}
        labelledBy="student-auth-heading"
        hero={
          <AuthHero
            title="Check in to your quiet seat."
            subtitle="Monitor. Manage. Maintain. For a better study environment."
            slides={SLIDES}
          />
        }
      >
        <Outlet />
      </AuthLayout>
    );
  }

  return (
    <div className="shush-cloud relative min-h-screen font-sans antialiased flex items-center justify-center p-4 sm:p-8 md:p-12 selection:bg-shush-gold selection:text-shush-ink">
      <BokehBackground />
      <div className="relative z-10 w-full max-w-[1100px] bg-shush-white border border-shush-line rounded-[2.5rem] shadow-2xl p-6 sm:p-10">
        <header className="relative flex items-center justify-center">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 text-shush-orange" />
            <div className="leading-tight">
              <div className="text-xl font-bold tracking-wider text-shush-ink">SHUSH</div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-shush-muted">Student check-in</div>
            </div>
          </div>
          {!checking && student && (
            <button
              type="button"
              onClick={handleSignOut}
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-xl border border-shush-lineStrong px-4 py-2 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
            >
              Sign out
            </button>
          )}
        </header>
        <main className="mt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
