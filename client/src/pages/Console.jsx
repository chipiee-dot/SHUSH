import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Console() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen shush-cloud font-sans antialiased flex items-center justify-center p-4 sm:p-8 md:p-12">
      <main className="w-full max-w-3xl bg-shush-white border border-shush-line rounded-[2.5rem] shadow-2xl p-8 sm:p-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 text-shush-orange" />
            <span className="text-xl font-bold tracking-wider text-shush-ink">SHUSH</span>
          </div>
          <button
            className="rounded-xl border border-shush-lineStrong px-4 py-2 text-sm font-medium text-shush-ink hover:bg-shush-creamDeep transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange disabled:opacity-60"
            disabled={signingOut}
            onClick={handleSignOut}
            type="button"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </header>

        <section className="mt-10">
          <h1 className="text-3xl font-semibold text-shush-ink tracking-tight">
            Welcome, {user.firstName} {user.lastName}.
          </h1>
          <p className="mt-2 text-sm text-shush-inkSoft">You are signed in to the library acoustic monitoring console.</p>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-shush-line px-5 py-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-shush-muted">Faculty ID</dt>
              <dd className="mt-1 text-sm font-medium text-shush-ink">{user.facultyId}</dd>
            </div>
            <div className="rounded-xl border border-shush-line px-5 py-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-shush-muted">Email</dt>
              <dd className="mt-1 text-sm font-medium text-shush-ink break-all">{user.email}</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}
