// Live checklist for the two rules the server really enforces. No strength meter on purpose.
function Rule({ met, children }) {
  return (
    <li className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-shush-orange700' : 'text-shush-muted'}`}>
      <svg
        className={`h-4 w-4 flex-none transition-colors ${met ? 'text-shush-orange' : 'text-shush-lineStrong'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        {met && <path d="M8 12.5l2.7 2.7L16 9.8" />}
      </svg>
      <span>{children}</span>
      <span className="sr-only">{met ? ' (met)' : ' (not met yet)'}</span>
    </li>
  );
}

export default function PasswordRules({ password, confirmPassword }) {
  return (
    <ul className="space-y-1.5" aria-label="Password requirements">
      <Rule met={password.length >= 8}>At least 8 characters</Rule>
      <Rule met={confirmPassword.length > 0 && password === confirmPassword}>Passwords match</Rule>
    </ul>
  );
}
