import { Router } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { buildLayout, isUnderMaintenance } from '../services/tableStatus.js';
import { MAX_GROUP_SIZE, MAX_SESSION_HOURS } from '../services/limits.js';
import { normalizeStudentNo, validateStudentSignup } from '../services/validators.js';
import { sendDatabaseError, toInt, wrap } from './helpers.js';

export const STUDENT_COOKIE = 'shush_student';
const SESSION_HOURS = 8;
const SESSION_MS = SESSION_HOURS * 60 * 60 * 1000;

// Student sign-in uses only the student number, so the lookup is rate limited
// to slow down guessing.
const limiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message },
  });

function displayName(student) {
  const middle = student.middleInitial ? ` ${student.middleInitial}.` : '';
  return `${student.firstName}${middle} ${student.lastName}`;
}

function sessionInfo(current) {
  return current
    ? { sessionId: current.sessionId, tableNo: current.tableNo, groupSize: current.groupSize, startedAt: current.startedAt }
    : null;
}

function publicStudent(row) {
  return {
    id: row.id,
    studentNo: row.studentNo,
    firstName: row.firstName,
    lastName: row.lastName,
    middleInitial: row.middleInitial ?? null,
    section: row.section,
    name: displayName(row),
  };
}

export function createStudentRouter(db, config) {
  const router = Router();
  const offlineAfterMs = config.deviceOfflineAfterMs;

  function requireStudent(req, res, next) {
    const token = req.cookies?.[STUDENT_COOKIE];
    if (!token) return res.status(401).json({ message: 'Please sign in with your student number.' });
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      if (payload.role !== 'Student') throw new Error('not a student');
      req.student = payload;
      return next();
    } catch {
      res.clearCookie(STUDENT_COOKIE);
      return res.status(401).json({ message: 'Your session has ended. Please sign in again.' });
    }
  }

  const signupLimit = limiter(60 * 60 * 1000, 30, 'Too many sign-up attempts. Please try again later.');
  const lookupLimit = limiter(15 * 60 * 1000, 60, 'Too many attempts. Please wait a few minutes.');

  // ---- Sign up ---------------------------------------------------------------
  router.post(
    '/signup',
    signupLimit,
    wrap(async (req, res) => {
      const checked = validateStudentSignup(req.body ?? {});
      if (checked.error) return res.status(400).json({ message: checked.error });

      const result = await db.registerStudent(checked.value);
      if (!result?.success) {
        const duplicate = /already registered/i.test(result?.message ?? '');
        return res.status(duplicate ? 409 : 400).json({ message: result?.message ?? 'Could not create the account.' });
      }
      return res.status(201).json({ message: result.message });
    })
  );

  // ---- Sign in, step 1: find the student so the name can be confirmed ---------
  router.post(
    '/lookup',
    lookupLimit,
    wrap(async (req, res) => {
      const studentNo = normalizeStudentNo(req.body?.studentNo);
      if (!studentNo) return res.status(400).json({ message: 'Student number must look like 21-0001.' });

      const row = await db.findStudent(studentNo);
      if (!row) {
        return res.status(404).json({ message: 'We could not find that student number. Please sign up first.' });
      }
      await db.closeStaleSessions(new Date(), MAX_SESSION_HOURS);
      const current = await db.getActiveStudentSession(row.id);
      return res.json({ student: publicStudent(row), session: sessionInfo(current) });
    })
  );

  // ---- Sign in, step 2: after the student confirms their name ---------------
  router.post(
    '/login',
    lookupLimit,
    wrap(async (req, res) => {
      const studentNo = normalizeStudentNo(req.body?.studentNo);
      if (!studentNo) return res.status(400).json({ message: 'Student number must look like 21-0001.' });

      const row = await db.findStudent(studentNo);
      if (!row) return res.status(404).json({ message: 'We could not find that student number.' });

      const student = publicStudent(row);
      const token = jwt.sign(
        { id: student.id, studentNo: student.studentNo, firstName: student.firstName, lastName: student.lastName, middleInitial: student.middleInitial, section: student.section, role: 'Student' },
        config.jwtSecret,
        { expiresIn: `${SESSION_HOURS}h` }
      );
      res.cookie(STUDENT_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.cookieSecure,
        maxAge: SESSION_MS,
      });
      await db.closeStaleSessions(new Date(), MAX_SESSION_HOURS);
      const current = await db.getActiveStudentSession(row.id);
      return res.json({ student, session: sessionInfo(current) });
    })
  );

  router.post('/logout', (req, res) => {
    res.clearCookie(STUDENT_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure });
    res.json({ message: 'Signed out.' });
  });

  // ---- Who am I and where am I seated ---------------------------------------
  router.get(
    '/me',
    requireStudent,
    wrap(async (req, res) => {
      const now = new Date();
      await db.closeStaleSessions(now, MAX_SESSION_HOURS);
      const current = await db.getActiveStudentSession(req.student.id);
      const { id, studentNo, firstName, lastName, middleInitial, section } = req.student;
      const student = publicStudent({ id, studentNo, firstName, lastName, middleInitial, section });
      res.json({
        student,
        session: current
          ? { sessionId: current.sessionId, tableNo: current.tableNo, groupSize: current.groupSize, startedAt: current.startedAt }
          : null,
      });
    })
  );

  // ---- Tables that fit the group ---------------------------------------------
  // Shows seats free and whether the table is open. Device readings are not shared with students.
  router.get(
    '/tables',
    requireStudent,
    wrap(async (req, res) => {
      const groupSize = toInt(req.query.groupSize) ?? 1;
      if (groupSize < 1 || groupSize > MAX_GROUP_SIZE) {
        return res.status(400).json({ message: `Group size must be between 1 and ${MAX_GROUP_SIZE}.` });
      }
      const now = new Date();
      await db.closeStaleSessions(now, MAX_SESSION_HOURS);
      const [rows, windows] = await Promise.all([db.getLayout(), db.getActiveMaintenance(now)]);
      const tables = buildLayout(rows, windows, { now, offlineAfterMs }).map((t) => {
        const free = t.seats - t.occupancy.groupSize;
        const underMaintenance = isUnderMaintenance(t.tableNo, windows);
        return {
          tableNo: t.tableNo,
          seats: t.seats,
          free,
          underMaintenance,
          fits: !underMaintenance && free >= groupSize,
        };
      });
      res.json({ groupSize, tables });
    })
  );

  // ---- Start and end a session -------------------------------------------------
  router.post(
    '/session',
    requireStudent,
    wrap(async (req, res) => {
      const tableNo = toInt(req.body?.tableNo);
      const groupSize = toInt(req.body?.groupSize);
      if (tableNo === null || tableNo < 1) return res.status(400).json({ message: 'Choose a table.' });
      if (groupSize === null || groupSize < 1 || groupSize > MAX_GROUP_SIZE) {
        return res.status(400).json({ message: `Group size must be between 1 and ${MAX_GROUP_SIZE}.` });
      }
      const result = await db.startSession({ studentId: req.student.id, tableNo, groupSize, now: new Date() });
      if (!result?.success) return res.status(400).json({ message: result?.message ?? 'Could not start the session.' });
      return res.status(201).json({ message: result.message, sessionId: result.sessionId });
    })
  );

  router.post(
    '/session/end',
    requireStudent,
    wrap(async (req, res) => {
      const result = await db.endSession({ studentId: req.student.id, now: new Date() });
      if (!result?.success) return res.status(404).json({ message: result?.message ?? 'You do not have a table in use.' });
      return res.json({ message: result.message });
    })
  );

  router.use((err, req, res, next) => {
    console.error('[student]', err);
    return sendDatabaseError(res, err);
  });

  // Anything else under /api/student
  router.use((req, res) => res.status(404).json({ message: 'Not found.' }));

  return router;
}
