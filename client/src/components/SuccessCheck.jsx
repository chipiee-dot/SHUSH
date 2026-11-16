import './motion.css';

/* Adapted from BrewedOps Motion Library: Success check */

/** A circle with a tick that draws once. Decorative: the words next to it carry the meaning. */
export default function SuccessCheck({ className = 'h-6 w-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`flex-none ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.35" />
      <path className="m-check" pathLength="24" d="M7 12.5l3.2 3.2L17 9" />
    </svg>
  );
}
