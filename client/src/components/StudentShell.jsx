import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../context/StudentAuthContext.jsx';
import AuthLayout, { AuthHero } from './AuthLayout.jsx';
import CloudBackground from './CloudBackground.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import Logo from './Logo.jsx';
import { formatTime } from '../lib/format.js';
import './motion.css';
import './student-table.css';

const SLIDES = [
  { title: 'Enter your student number', text: 'No password needed.' },
  { title: 'Pick an open table', text: 'See which tables have free seats.' },
  { title: 'Leave when you are done', text: 'Sign in again with your number to end your session.' },
];

// Sign-in and sign-up get the split auth layout; the table page gets the cloud page below.
const AUTH_PATH = /^\/student\/(login|signup)\/?$/;

function initials(student) {
  return `${student.firstName?.[0] ?? ''}${student.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export default function StudentShell() {
  const { student, session, checking, logout } = useStudentAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
      setSigningOut(false);
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

  const signedIn = !checking && student;

  return (
    <div className="st-page-scroll">
    <div className="shush-cloud relative min-h-full font-sans antialiased selection:bg-shush-gold selection:text-shush-ink">
      <CloudBackground variant="page" />

      <header className="sticky top-0 z-30 border-b border-shush-line bg-shush-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="m-logo-hover flex items-center gap-3">
            <Logo className="m-logo h-8 w-8 flex-none text-shush-orange" />
            <div className="leading-tight">
              <div className="text-xl font-bold tracking-wider text-shush-ink">SHUSH</div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-shush-muted">Student check-in</div>
            </div>
          </div>

          {signedIn && (
            <div className="flex items-center gap-2 sm:gap-3">
              {session && (
                <p className="st-pill">
                  <span>Table {session.tableNo}</span>
                  <span className="hidden sm:inline">· since {formatTime(session.startedAt)}</span>
                </p>
              )}
              <div className="flex items-center gap-2.5" aria-label={`Signed in as ${student.name}, ${student.section}`}>
                <span
                  className="grid h-9 w-9 flex-none place-items-center rounded-full bg-shush-goldSoft text-sm font-bold text-shush-orange700"
                  aria-hidden="true"
                >
                  {initials(student)}
                </span>
                <div className="hidden min-w-0 leading-tight sm:block">
                  <div className="max-w-[12rem] truncate text-sm font-semibold text-shush-ink">{student.name}</div>
                  <div className="text-xs text-shush-inkSoft">{student.section}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSigningOut(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-2.5 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
              >
                <svg className="h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <ConfirmDialog
        open={signingOut}
        title="Sign out?"
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onConfirm={handleSignOut}
        onCancel={() => setSigningOut(false)}
        busy={busy}
      >
        {session
          ? `You will be signed out on this device, but your seat at Table ${session.tableNo} stays active. Sign in with your student number again to end your session. It also ends automatically after 2 hours.`
          : 'You will be signed out of SHUSH on this device.'}
      </ConfirmDialog>
    </div>
    </div>
  );
}
