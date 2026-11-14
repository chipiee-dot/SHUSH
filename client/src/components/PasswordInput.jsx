import { useState } from 'react';

const DEFAULT_INPUT =
  'rounded-xl border border-shush-lineStrong bg-shush-white py-3 pl-11 text-sm leading-6 text-shush-ink placeholder:text-shush-muted shadow-sm transition focus:border-shush-orange focus:ring-2 focus:ring-shush-orange';

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24', 'aria-hidden': 'true' };

/**
 * Password field with a lock icon and its own show/hide eye.
 * Hidden: open eye. Visible: closed (slashed) eye. Each instance keeps its own state.
 * inputClassName replaces the default look (it should keep the left padding for the lock icon).
 */
export default function PasswordInput({
  id,
  name = 'password',
  value,
  onChange,
  placeholder = 'Enter your password',
  autoComplete = 'current-password',
  required = false,
  maxLength = 128,
  inputClassName = DEFAULT_INPUT,
  iconClassName = 'h-5 w-5',
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-shush-muted">
        <svg className={iconClassName} {...ICON}>
          <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        maxLength={maxLength}
        className={`block w-full pr-12 ${inputClassName}`}
      />

      <button
        type="button"
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        // Keep focus and the caret in the input when the eye is clicked.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-lg text-shush-muted transition hover:text-shush-inkSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
      >
        <span className="relative block h-5 w-5">
          {/* Open eye: password hidden */}
          <svg
            className={`absolute inset-0 h-5 w-5 transition duration-150 ${visible ? 'scale-75 opacity-0' : 'scale-100 opacity-100'}`}
            {...ICON}
          >
            <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* Closed eye: password visible */}
          <svg
            className={`absolute inset-0 h-5 w-5 transition duration-150 ${visible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
            {...ICON}
          >
            <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
    </div>
  );
}
