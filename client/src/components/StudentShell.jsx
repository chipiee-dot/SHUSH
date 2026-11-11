import { Outlet, useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../context/StudentAuthContext.jsx';
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
    <div className="min-h-screen bg-[#1b2d5a] font-sans antialiased flex items-start justify-center p-4 sm:p-8 md:p-12 selection:bg-[#1b2d5a] selection:text-white">
      <div className="w-full max-w-3xl bg-[#f7f5ed] rounded-[2.5rem] shadow-2xl p-6 sm:p-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 text-[#1b2d5a]" />
            <div className="leading-tight">
              <div className="text-xl font-bold tracking-wider text-[#1b2d5a]">SHUSH</div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Student check-in</div>
            </div>
          </div>
          {!checking && student && (
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-[#d6cfbe] px-4 py-2 text-sm font-medium text-[#1b2d5a] transition hover:bg-[#1b2d5a] hover:text-white"
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
