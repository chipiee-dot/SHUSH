// Faculty ID helpers. An ID is "FAC-" + 4 digits + "-" + 4 digits (8 digits in total).

export const FACULTY_ID_DIGITS = 8;
export const FACULTY_ID_RE = /^FAC-\d{4}-\d{4}$/; // same pattern as the server

// Keep only digits, at most 8.
export const facultyIdDigits = (raw) => String(raw ?? '').replace(/\D/g, '').slice(0, FACULTY_ID_DIGITS);

// Digits with the dash added after the 4th: '2026' -> '2026-', '20262005' -> '2026-2005'.
export function formatFacultyIdBody(raw) {
  const d = facultyIdDigits(raw);
  return d.length >= 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
}

// Full ID for state and the API. '' when there are no digits.
export function toFacultyId(raw) {
  const d = facultyIdDigits(raw);
  return d ? `FAC-${formatFacultyIdBody(d)}` : '';
}

export const isCompleteFacultyId = (value) => FACULTY_ID_RE.test(value);
