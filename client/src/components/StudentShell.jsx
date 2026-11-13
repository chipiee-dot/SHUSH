import { Outlet, useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../context/StudentAuthContext.jsx';
import BokehBackground from './BokehBackground.jsx';
import Logo from './Logo.jsx';

export default function StudentShell() {
  const { student, checking, logout } = useStudentAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await logout();
    } finally {
      navigate('/student/login', { replace: true });
    }
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
