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
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-[#1b2d5a]/10"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1b2d5a] text-xs font-bold tracking-wide text-white">
          {initials || '?'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-[#d6cfbe] bg-white text-slate-800 shadow-xl">
          <div className="border-b border-[#ece7da] px-4 py-3">
            <div className="text-sm font-semibold text-[#152549]">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="mt-0.5 break-all text-xs text-slate-500">{user?.email}</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-[#e9ecf5] px-2 py-0.5 font-medium text-[#1b2d5a]">{roleLabel}</span>
              <span className="text-slate-500">{user?.facultyId}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full px-4 py-3 text-left text-sm font-medium text-[#1b2d5a] transition hover:bg-[#f7f5ed] disabled:opacity-60"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
