// Student numbers look like 21-0001. The field adds the dash as the student types.
export function formatStudentNumberInput(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 6);
  return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
}

export const STUDENT_NO_RE = /^\d{2}-\d{4}$/;
export const SECTION_RE = /^BS[A-Z]{2,5}-[1-6][A-Z]$/;
