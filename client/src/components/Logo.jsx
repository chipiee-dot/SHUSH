export default function Logo({ className = 'h-8 w-8 text-shush-orange' }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 32 32">
      <rect height="12" rx="1.75" width="3.5" x="4" y="10" />
      <rect height="20" rx="1.75" width="3.5" x="10.5" y="6" />
      <rect height="26" rx="1.75" width="3.5" x="17" y="3" />
      <rect height="12" rx="1.75" width="3.5" x="23.5" y="10" />
    </svg>
  );
}
