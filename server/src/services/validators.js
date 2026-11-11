// Student number, section and name rules. The database procedures check the same
// rules, so these are a first check that gives a clear message early.

export const STUDENT_NO_PATTERN = /^\d{2}-\d{4}$/;
export const SECTION_PATTERN = /^BS[A-Z]{2,5}-[1-6][A-Z]$/;

// Accepts "21-0001" or "210001" and returns "21-0001", or null if it can't be read.
export function normalizeStudentNo(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 6) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function normalizeSection(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function cleanName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function validateStudentSignup(body) {
  const studentNo = normalizeStudentNo(body.studentNo);
  if (!studentNo) return { error: 'Student number must look like 21-0001.' };

  const lastName = cleanName(body.lastName);
  const firstName = cleanName(body.firstName);
  if (!lastName || !firstName) return { error: 'Please enter your first and last name.' };
  if (lastName.length > 50 || firstName.length > 50) return { error: 'Names must be 50 characters or fewer.' };

  const middle = cleanName(body.middleInitial).replace(/\.$/, '').toUpperCase();
  if (middle && !/^[A-Z]$/.test(middle)) return { error: 'Middle initial must be a single letter.' };

  const section = normalizeSection(body.section);
  if (!SECTION_PATTERN.test(section)) return { error: 'Section must look like BSIT-3D.' };

  return { value: { studentNo, lastName, firstName, middleInitial: middle || null, section } };
}
