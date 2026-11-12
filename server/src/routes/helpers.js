import { isDatabaseDown } from '../services/errors.js';

// Express 4 does not catch rejected promises, so async handlers go through this.
export const wrap = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

// Whole numbers only: 12 and "12" are fine, 1.5 and "abc" are not.
export function toInt(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function sendDatabaseError(res, err) {
  if (isDatabaseDown(err)) {
    return res
      .status(503)
      .json({ message: 'The database is unavailable right now. Please try again shortly.' });
  }
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
}
