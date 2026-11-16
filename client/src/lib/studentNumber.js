// Student numbers look like 21-0001. The field adds the dash as the student types.
export function formatStudentNumberInput(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 6);
  return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
}

export const STUDENT_NO_RE = /^\d{2}-\d{4}$/;
export const SECTION_RE = /^BS[A-Z]{2,5}-[1-6][A-Z]$/;

// Section codes look like BSIT-3D. The field adds the dash as the student types:
// 4 to 7 letters, then a year 1-6 (the dash is added), then one letter.
export function formatSectionInput(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let letters = '';
  let year = '';
  let suffix = '';
  for (const c of s) {
    const isLetter = c >= 'A' && c <= 'Z';
    if (!year) {
      if (isLetter) {
        if (letters.length < 7) letters += c;
      } else if (letters.length >= 4 && c >= '1' && c <= '6') {
        year = c;
      }
    } else if (isLetter) {
      suffix = c;
      break;
    }
  }
  return year ? `${letters}-${year}${suffix}` : letters;
}
