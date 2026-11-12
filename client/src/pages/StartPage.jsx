import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';

export default function StartPage() {
  return (
    <div className="min-h-screen bg-[#1b2d5a] font-sans antialiased flex items-center justify-center p-4 sm:p-8">
      <main className="w-full max-w-2xl rounded-[2.5rem] bg-[#f7f5ed] p-8 shadow-2xl sm:p-12">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9 text-[#1b2d5a]" />
          <div className="text-2xl font-bold tracking-wider text-[#1b2d5a]">SHUSH</div>
        </div>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-[#152549]">Welcome</h1>
        <p className="mt-2 text-sm text-slate-600">Choose how you want to sign in.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            to="/student"
            className="rounded-2xl border border-[#d6cfbe] p-6 transition hover:border-[#1b2d5a] hover:shadow-md"
          >
            <div className="text-base font-semibold text-[#152549]">Student check-in</div>
            <p className="mt-1 text-sm text-slate-600">Sign in with your student number and choose a table.</p>
          </Link>
          <Link
            to="/login"
            className="rounded-2xl border border-[#d6cfbe] p-6 transition hover:border-[#1b2d5a] hover:shadow-md"
          >
            <div className="text-base font-semibold text-[#152549]">Faculty console</div>
            <p className="mt-1 text-sm text-slate-600">Dashboard, table layout, rewards and history.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
