import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout, { AuthHero } from '../components/AuthLayout.jsx';
import libraryPhoto from '../assets/library-snapshot.jpg';
import './StartPage.css';

const SLIDES = [
  { title: 'Check in', text: 'Enter your student number and pick an open table.' },
  { title: 'Stay in the quiet zone', text: 'Each table listens for noise and signals when it gets loud.' },
  { title: 'Quiet study earns rewards', text: 'The most frequent, quietest and longest quiet-streak visitors are recognized.' },
];

const STEPS = [
  { title: 'Enter your student number', text: 'No password needed.' },
  { title: 'Choose a table', text: 'See which tables have free seats.' },
  { title: 'Keep it quiet', text: 'Your table lights up if it gets loud.' },
];

export default function StartPage() {
  const navigate = useNavigate();

  // Ctrl+Shift+F opens the faculty sign-in. Deliberately not shown anywhere on the page.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.repeat || !e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return;
      if (e.key.toLowerCase() !== 'f') return;
      e.preventDefault();
      navigate('/login');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return (
    <AuthLayout
      labelledBy="welcome-heading"
      photo={libraryPhoto}
      hero={
        <AuthHero
          title="A quieter library starts here."
          subtitle="Monitor. Manage. Maintain. For a better study environment."
          slides={SLIDES}
        />
      }
    >
      <h2 id="welcome-heading" className="landing-title">Welcome</h2>
      <p className="landing-subtitle">Check in with your student number and find a quiet table.</p>

      <ol className="landing-steps" aria-label="How it works">
        {STEPS.map((step) => (
          <li key={step.title} className="landing-step">
            <span className="landing-step-num" aria-hidden="true" />
            <span>
              <span className="landing-step-title">{step.title}</span>
              <span className="landing-step-text">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <Link
        to="/student"
        className="landing-cta group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-shush-orange600 px-5 py-4 text-base font-semibold text-white shadow-md lg:min-[801px]:py-5 lg:min-[801px]:text-xl transition hover:bg-shush-orange700 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
      >
        Student check-in
        <svg aria-hidden="true" className="landing-cta-arrow h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>

      <p className="mt-4 text-center text-sm text-shush-inkSoft lg:min-[801px]:mt-5 lg:min-[801px]:text-base">
        New here?{' '}
        <Link
          to="/student/signup"
          className="rounded px-1 font-semibold text-shush-orange700 underline underline-offset-4 hover:text-shush-orange600 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
        >
          Create a student account
        </Link>
      </p>

      <p className="landing-footer">Need assistance? Contact your library desk administrator.</p>
    </AuthLayout>
  );
}
