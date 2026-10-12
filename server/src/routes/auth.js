import { Router } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { COOKIE_NAME, requireAuth } from '../middleware/requireAuth.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FACULTY_ID_PATTERN = /^FAC-\d{4}-\d{4}$/;
const SHORT_SESSION = '8h';
const LONG_SESSION = '30d';
const LONG_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const asString = (value) => (typeof value === 'string' ? value : '');

// Errors raised when SQL Server can't be reached (as opposed to a bad request).
function isDatabaseDown(err) {
  return (
    err?.name === 'ConnectionError' ||
    ['ESOCKET', 'ELOGIN', 'ETIMEOUT', 'ECONNCLOSED', 'ENOTOPEN', 'EINSTLOOKUP'].includes(err?.code)
  );
}

function handleError(res, err) {
  console.error('[auth]', err);
  if (isDatabaseDown(err)) {
    return res
      .status(503)
      .json({ message: 'The database is unavailable right now. Please try again shortly.' });
  }
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
}

export function createAuthRouter(db, config) {
  const router = Router();

  const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many sign-up attempts. Please try again later.' },
  });

  // Only failed logins count toward the limit.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many failed attempts. Please try again in a few minutes.' },
  });

  // ---- POST /api/auth/signup ------------------------------------------------
  router.post('/signup', signupLimiter, async (req, res) => {
    const body = req.body ?? {};
    const data = {
      facultyId: asString(body.facultyId).trim().toUpperCase(),
      firstName: asString(body.firstName).trim(),
      lastName: asString(body.lastName).trim(),
      middleInitial: asString(body.middleInitial).trim(),
      email: asString(body.email).trim(),
      password: asString(body.password),
      confirmPassword: asString(body.confirmPassword),
    };

    let problem = null;
    if (!data.facultyId || !data.firstName || !data.lastName || !data.email) {
      problem = 'Please fill in all required fields.';
    } else if (
      data.facultyId.length > 30 ||
      data.firstName.length > 50 ||
      data.lastName.length > 50 ||
      data.middleInitial.length > 2 ||
      data.email.length > 254
    ) {
      problem = 'One of the fields is too long.';
          } else if (!FACULTY_ID_PATTERN.test(data.facultyId)) {
      problem = 'Faculty ID must look like FAC-2024-1679.';
    } else if (!EMAIL_PATTERN.test(data.email)) {
      problem = 'Please enter a valid email address.';
    } else if (data.password.length < 8) {
      problem = 'Password must be at least 8 characters.';
    } else if (data.password.length > 128) {
      problem = 'Password must be 128 characters or fewer.';
    } else if (data.password !== data.confirmPassword) {
      problem = 'Passwords do not match.';
    }
    if (problem) {
      return res.status(400).json({ message: problem });
    }

    try {
      const row = await db.signUp(data);
      if (row?.Success) {
        return res.status(201).json({ message: row.Message });
      }
      const duplicate = /already registered/i.test(row?.Message ?? '');
      return res
        .status(duplicate ? 409 : 400)
        .json({ message: row?.Message ?? 'Could not create the account.' });
    } catch (err) {
      return handleError(res, err);
    }
  });

  // ---- POST /api/auth/login -------------------------------------------------
  router.post('/login', loginLimiter, async (req, res) => {
    const body = req.body ?? {};
    const facultyId = asString(body.facultyId).trim();
    const password = asString(body.password);
    const remember = body.remember === true;

    if (!facultyId || !password) {
      return res.status(400).json({ message: 'Please enter your Faculty ID and password.' });
    }
    if (facultyId.length > 30 || password.length > 128) {
      return res.status(401).json({ message: 'Invalid Faculty ID or password.' });
    }

    try {
      const row = await db.login({ facultyId, password });
      if (!row?.Success) {
        const deactivated = /deactivated/i.test(row?.Message ?? '');
        return res
          .status(deactivated ? 403 : 401)
          .json({ message: row?.Message ?? 'Invalid Faculty ID or password.' });
      }

      const user = {
        id: row.Id,
        facultyId: row.FacultyId,
        firstName: row.FirstName,
        lastName: row.LastName,
        email: row.Email,
      };

      const token = jwt.sign(user, config.jwtSecret, {
        expiresIn: remember ? LONG_SESSION : SHORT_SESSION,
      });

      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.cookieSecure,
        // "Keep console active" -> persistent cookie; otherwise it ends with the browser session.
        ...(remember ? { maxAge: LONG_SESSION_MS } : {}),
      });
      return res.json({ message: row.Message, user });
    } catch (err) {
      return handleError(res, err);
    }
  });

  // ---- POST /api/auth/logout ------------------------------------------------
  router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
    });
    res.json({ message: 'Signed out.' });
  });

  // ---- GET /api/auth/me -----------------------------------------------------
  router.get('/me', requireAuth(config), (req, res) => {
    const { id, facultyId, firstName, lastName, email } = req.user;
    res.json({ user: { id, facultyId, firstName, lastName, email } });
  });

  return router;
}
