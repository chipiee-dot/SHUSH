import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Logo from './Logo.jsx';
import NotificationsMenu from './NotificationsMenu.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import { NAV_ICONS } from './navIcons.jsx';
import './AppShell.css';

const LINKS = [
  {
    to: '/console/dashboard',
    label: 'Dashboard',
    icon: NAV_ICONS.dashboard,
  },
  {
    to: '/console/layout',
    label: 'Table layout',
    icon: NAV_ICONS.layout,
  },
  {
    to: '/console/students',
    label: 'Students',
    icon: NAV_ICONS.students,
  },
  {
    to: '/console/rewards',
    label: 'Rewards',
    icon: NAV_ICONS.rewards,
  },
  {
    to: '/console/history',
    label: 'History',
    icon: NAV_ICONS.history,
  },
  {
    to: '/console/settings',
    label: 'Settings',
    icon: NAV_ICONS.settings,
  },
];

const ROUTE_NAMES = Object.fromEntries(LINKS.map((link) => [link.to, link.label]));

function getPageName(pathname) {
  const match = Object.keys(ROUTE_NAMES).find((route) => pathname.startsWith(route));
  return match ? ROUTE_NAMES[match] : 'Dashboard';
}

export default function FacultyShell() {
  const location = useLocation();
  const links = LINKS;
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
          {/* Organic concave/convex purple rail background matching reference */}
          <svg
            className="side-bg"
            viewBox="0 0 76 540"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="navRailGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F25F13" />
                <stop offset="100%" stopColor="#E4570F" />
              </linearGradient>
            </defs>
            <path
              d="M 0,0 
                 C 0,36 76,44 76,84 
                 L 76,456 
                 C 76,496 0,504 0,540 
                 Z"
              fill="url(#navRailGrad)"
            />
          </svg>

          <div className="rail-inner">
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
          </div>
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
