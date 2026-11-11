import { Outlet } from 'react-router-dom';
import TopBar from './TopBar.jsx';

// Same frame as the sign-in and console screens: navy canvas, cream panel.
export default function FacultyShell() {
  return (
    <div className="min-h-screen bg-[#1b2d5a] font-sans antialiased flex items-start justify-center p-4 sm:p-8 md:p-12 selection:bg-[#1b2d5a] selection:text-white">
      <div className="w-full max-w-6xl bg-[#f7f5ed] rounded-[2.5rem] shadow-2xl p-6 sm:p-10">
        <TopBar />
        <main className="mt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
