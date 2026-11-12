import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import './StartPage.css';

export default function StartPage() {
  // Tracks cursor position to power the .glow-btn radial light effect
  const handlePointerMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--glow-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--glow-y', `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div className="landing-shell">
      {/* Decorative Concentric Acoustic Wave Rings */}
      <div className="acoustic-rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <main className="landing-card" aria-labelledby="welcome-heading">
        {/* Top Brand Row */}
        <header className="landing-brand-row">
          <div className="landing-brand">
            <Logo className="landing-logo-icon" />
            <span className="landing-wordmark">SHUSH</span>
          </div>

          <span className="landing-pill">
            <span className="status-dot" aria-hidden="true" />
            Quiet-Zone Console
          </span>
        </header>

        {/* Welcome Header */}
        <div className="landing-header">
          <h1 id="welcome-heading" className="landing-title">
            Welcome
          </h1>
          <p className="landing-subtitle">
            Choose how you want to sign in to the SHUSH network.
          </p>
        </div>

        {/* Two-Column Role Selection Grid */}
        <div className="role-grid">
          {/* Student Check-in Card */}
          <Link
            to="/student"
            className="role-card glow-btn"
            onMouseMove={handlePointerMove}
          >
            <span className="glow-light" aria-hidden="true" />
            <div className="role-card-top">
              <span className="role-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <polyline points="16 11 18 13 22 9" />
                </svg>
              </span>
              <span className="role-arrow" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </div>

            <div className="role-body glow-text">
              <h2 className="role-title">Student check-in</h2>
              <p className="role-desc">
                Sign in with your student number and choose an available study table.
              </p>
            </div>
          </Link>

          {/* Faculty Console Card */}
          <Link
            to="/console/dashboard"
            className="role-card role-card--faculty glow-btn"
            onMouseMove={handlePointerMove}
          >
            <span className="glow-light" aria-hidden="true" />
            <div className="role-card-top">
              <span className="role-icon role-icon--purple" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="7" height="9" x="3" y="3" rx="1" />
                  <rect width="7" height="5" x="14" y="3" rx="1" />
                  <rect width="7" height="9" x="14" y="12" rx="1" />
                  <rect width="7" height="5" x="3" y="16" rx="1" />
                </svg>
              </span>
              <span className="role-arrow" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </div>

            <div className="role-body glow-text">
              <h2 className="role-title">Faculty console</h2>
              <p className="role-desc">
                Manage dashboard metrics, table layout, student rewards, and history.
              </p>
            </div>
          </Link>
        </div>

        {/* Footer Support Note */}
        <footer className="landing-footer">
          <span>Need assistance? Contact your library desk administrator.</span>
        </footer>
      </main>
    </div>
  );
}
