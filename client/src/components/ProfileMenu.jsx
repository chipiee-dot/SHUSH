import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useClickOutside from '../hooks/useClickOutside.js';

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  const roleLabel = user?.role === 'Admin' ? 'Administrator' : 'Faculty';

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // Signed out on this screen either way.
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
        aria-expanded={open}
        className="flex h-10 items-center gap-2.5 rounded-xl bg-shush-orange px-2.5 text-white shadow-sm transition hover:bg-shush-orange600 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-xs font-bold tracking-wide text-white">
          {initials || '?'}
        </span>
        <span className="hidden pr-1 text-sm font-medium text-white sm:inline">
          {user?.firstName} {user?.lastName}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-shush-line bg-shush-white text-shush-ink shadow-xl">
          <div className="border-b border-shush-line px-4 py-3">
            <div className="text-sm font-semibold text-shush-ink">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="mt-0.5 break-all text-xs text-shush-muted">{user?.email}</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-shush-goldSoft px-2 py-0.5 font-medium text-shush-orange700">{roleLabel}</span>
              <span className="text-shush-muted">{user?.facultyId}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full px-4 py-3 text-left text-sm font-medium text-shush-orange700 transition hover:bg-shush-cream disabled:opacity-60"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
