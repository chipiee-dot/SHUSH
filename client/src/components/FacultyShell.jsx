import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';
import NotificationsMenu from './NotificationsMenu.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import './AppShell.css';

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

const LINKS = [
  {
    to: '/console/dashboard',
    label: 'Dashboard',
    icon: (
      <svg {...ICON_PROPS}>
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </svg>
    ),
  },
  {
    to: '/console/layout',
    label: 'Table layout',
    icon: (
      <svg {...ICON_PROPS}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    to: '/console/rewards',
    label: 'Rewards',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    ),
  },
  {
    to: '/console/history',
    label: 'History',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    to: '/console/settings',
    label: 'Settings',
    adminOnly: true,
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const ROUTE_NAMES = Object.fromEntries(LINKS.map((link) => [link.to, link.label]));

function getPageName(pathname) {
  const match = Object.keys(ROUTE_NAMES).find((route) => pathname.startsWith(route));
  return match ? ROUTE_NAMES[match] : 'Dashboard';
}

export default function FacultyShell() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'Admin';
  const links = LINKS.filter((link) => !link.adminOnly || isAdmin);
  const pageName = getPageName(location.pathname);

  // The page scrolls inside the shell, not the browser window.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="shell">
      <div className="app">
        <aside className="side" aria-label="Faculty console navigation">
          <span className="brand" aria-hidden="true">
            <Logo className="h-6 w-6 text-white" />
          </span>

          <nav className="nav" aria-label="Main">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/console/dashboard'}
                className={({ isActive }) => `it ${isActive ? 'on' : ''}`}
                aria-label={link.label}
              >
                {link.icon}
                <span className="tip" aria-hidden="true">
                  {link.label}
                </span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="main">
          <header className="top">
            <p className="crumb">
              SHUSH<span>/</span>
              <b>{pageName}</b>
            </p>
            <div className="top-actions">
              <NotificationsMenu />
              <ProfileMenu />
            </div>
          </header>

          <main className="page-container">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
