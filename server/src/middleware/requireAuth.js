import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'shush_session';

/** Rejects the request with 401 unless it carries a valid session cookie. */
export function requireAuth(config) {
  return (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ message: 'Not signed in.' });
    }
    try {
      req.user = jwt.verify(token, config.jwtSecret);
      return next();
    } catch {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    }
  };
}
