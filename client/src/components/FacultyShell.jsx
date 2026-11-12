import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';
import NotificationsMenu from './NotificationsMenu.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import './AppShell.css';

const COLLAPSED_KEY = 'shush.sidebar.collapsed';

const ROUTE_NAMES = {
  '/console/dashboard': 'Dashboard',
  '/console/layout': 'Table layout',
  '/console/rewards': 'Rewards',
  '/console/history': 'History',
  '/console/settings': 'Settings',
};

function getPageName(pathname) {
  for (const [route, name] of Object.entries(ROUTE_NAMES)) {
    if (pathname.startsWith(route)) {
      return name;
    }
  }
  return 'Dashboard';
}

function getInitialCollapsed() {
  try {
    const stored = window.localStorage.getItem(COLLAPSED_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

const LINKS = [
  {
    to: '/console/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

export default function FacultyShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const navRef = useRef(null);
  const searchInputRef = useRef(null);
  const [pillY, setPillY] = useState(0);
  const [pillHeight, setPillHeight] = useState(38);
  const [pillVisible, setPillVisible] = useState(false);

  const isAdmin = user?.role === 'Admin';
  const links = LINKS.filter((link) => !link.adminOnly || isAdmin);
  const pageName = getPageName(location.pathname);
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  // Keep body from scrolling while inside faculty shell
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Update sliding pill position
  useLayoutEffect(() => {
    if (!navRef.current) return;
    const activeEl = navRef.current.querySelector('.it.on');
    if (activeEl) {
      setPillY(activeEl.offsetTop);
      setPillHeight(activeEl.offsetHeight || 38);
      setPillVisible(true);
    } else {
      setPillVisible(false);
    }
  }, [location.pathname, links.length]);

  // Pill update on window resize
  useEffect(() => {
    function handleResize() {
      if (!navRef.current) return;
      const activeEl = navRef.current.querySelector('.it.on');
      if (activeEl) {
        setPillY(activeEl.offsetTop);
        setPillHeight(activeEl.offsetHeight || 38);
        setPillVisible(true);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut Ctrl/Cmd + K and Escape for drawer
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="shell">
      <div className={`app ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Mobile backdrop */}
        <div
          className="backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />

        {/* Sidebar */}
        <aside className="side" aria-label="Faculty console navigation">
          <div className="brand">
            <Logo className="h-7 w-7 text-[#1b2d5a] flex-none" />
          </div>

          <nav className="nav" ref={navRef} aria-label="Main">
            <span
              className="pill"
              aria-hidden="true"
              style={{
                transform: `translateY(${pillY}px)`,
                height: `${pillHeight}px`,
                opacity: pillVisible ? 1 : 0,
              }}
            />
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/console/dashboard'}
                className={({ isActive }) => `it ${isActive ? 'on' : ''}`}
                title={link.label}
                aria-label={link.label}
                onClick={() => setMobileOpen(false)}
              >
                {link.icon}
                <span className="it-label">{link.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main column */}
        <div className="main">
          <header className="top">
            <button
              type="button"
              className="menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <p className="crumb">
              SHUSH<span>/</span><b className="now">{pageName}</b>
            </p>

            <label className="search">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Search or jump to"
                aria-label="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <kbd>Ctrl K</kbd>
            </label>

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
