import { facultyIdDigits, formatFacultyIdBody, toFacultyId } from '../lib/facultyId.js';

/**
 * Faculty ID field with a fixed "FAC-" chip. The user types only the 8 digits;
 * the dash is added after the 4th and typing stops at 8 digits.
 * `value` and `onChange` use the full ID ('FAC-2026-2005'), so the API calls stay unchanged.
 */
export default function FacultyIdInput({ id, value = '', onChange, required = false, autoFocus = false }) {
  const digits = facultyIdDigits(value);
  const display = formatFacultyIdBody(digits);

  function handleChange(e) {
    const raw = e.target.value;
    let next = facultyIdDigits(raw);
    // Some mobile keyboards delete only the dash: same digits come back, so drop one digit instead.
    if (raw.length < display.length && next === digits && display.endsWith('-')) {
      next = digits.slice(0, -1);
    }
    onChange(toFacultyId(next));
  }

  // Backspace right after the auto-added dash removes the last digit, so the dash never traps the caret.
  function handleKeyDown(e) {
    if (e.key !== 'Backspace' || !display.endsWith('-')) return;
    const el = e.currentTarget;
    if (el.selectionStart === display.length && el.selectionEnd === display.length) {
      e.preventDefault();
      onChange(toFacultyId(digits.slice(0, -1)));
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-shush-lineStrong bg-shush-white py-1.5 pl-3 pr-2 shadow-sm transition focus-within:border-shush-orange focus-within:ring-2 focus-within:ring-shush-orange">
      <svg className="h-5 w-5 flex-none text-shush-muted" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.374a4.5 4.5 0 00-6.338 0 .75.75 0 00.522.251h5.294a.75.75 0 00.522-.251z" />
      </svg>
      <span
        aria-hidden="true"
        className="flex-none select-none rounded-lg bg-shush-creamDeep px-2 py-1 text-sm font-bold tracking-wide text-shush-orange700"
      >
        FAC-
      </span>
      {/* No maxLength on purpose: it would cut pasted text before it is cleaned. */}
      <input
        id={id}
        name="faculty-id"
        type="text"
        inputMode="numeric"
        autoComplete="username"
        autoFocus={autoFocus}
        required={required}
        placeholder="0000-0000"
        pattern="\d{4}-\d{4}"
        title="Faculty ID: 8 digits, like FAC-2026-2005"
        aria-label="Faculty ID digits. FAC and the dash are added for you."
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="block w-full min-w-0 border-0 bg-transparent p-0 py-1.5 text-sm leading-6 tracking-wider text-shush-ink shadow-none placeholder:text-shush-muted focus:border-0 focus:outline-none focus:ring-0"
      />
    </div>
  );
}
