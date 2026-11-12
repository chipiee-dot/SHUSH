// Library-clock helpers. Times are Date objects in UTC; `offsetMinutes` is the
// library's offset from UTC (480 for Philippines). Day boundaries are local.

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const toLocal = (date, offsetMinutes) => new Date(date.getTime() + offsetMinutes * MINUTE);
const toUtc = (localDate, offsetMinutes) => new Date(localDate.getTime() - offsetMinutes * MINUTE);

export function startOfLocalDay(now, offsetMinutes) {
  const local = toLocal(now, offsetMinutes);
  local.setUTCHours(0, 0, 0, 0);
  return toUtc(local, offsetMinutes);
}

// Weeks start on Monday.
export function startOfLocalWeek(now, offsetMinutes) {
  const local = toLocal(now, offsetMinutes);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - daysSinceMonday);
  local.setUTCHours(0, 0, 0, 0);
  return toUtc(local, offsetMinutes);
}

export function startOfLocalMonth(now, offsetMinutes) {
  const local = toLocal(now, offsetMinutes);
  local.setUTCDate(1);
  local.setUTCHours(0, 0, 0, 0);
  return toUtc(local, offsetMinutes);
}

// "2026-11-11" (library date) -> UTC instant of that day's local midnight.
// Returns null if the text is not a real calendar date.
export function parseLocalDate(text, offsetMinutes) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof text === 'string' ? text : '');
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const asUtc = new Date(Date.UTC(year, month - 1, day));
  if (asUtc.getUTCDate() !== day || asUtc.getUTCMonth() !== month - 1) return null;
  return toUtc(asUtc, offsetMinutes);
}

export const addDays = (date, days) => new Date(date.getTime() + days * DAY);
export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * MINUTE);
export const minutesBetween = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / MINUTE;
