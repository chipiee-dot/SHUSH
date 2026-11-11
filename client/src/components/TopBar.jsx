import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';
import NotificationsMenu from './NotificationsMenu.jsx';
import ProfileMenu from './ProfileMenu.jsx';

const LINKS = [
  { to: '/console/dashboard', label: 'Dashboard' },
  { to: '/console/layout', label: 'Table layout' },
  { to: '/console/rewards', label: 'Rewards' },
  { to: '/console/history', label: 'History' },
  { to: '/console/settings', label: 'Settings', adminOnly: true },
];

export default function TopBar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const links = LINKS.filter((link) => !link.adminOnly || isAdmin);

  return (
    <header>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8 text-[#1b2d5a]" />
          <div className="leading-tight">
            <div className="text-xl font-bold tracking-wider text-[#1b2d5a]">SHUSH</div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Faculty console</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsMenu />
          <ProfileMenu />
        </div>
      </div>

      <nav aria-label="Faculty console" className="mt-6 flex gap-1 overflow-x-auto border-b border-[#d6cfbe] pb-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-[#1b2d5a] text-white shadow-md'
                  : 'text-[#1b2d5a] hover:bg-[#1b2d5a]/10'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
