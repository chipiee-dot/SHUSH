import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { findFreeSpot } from '../src/services/tablePlacement.js';
import { normalizeStudentNo, validateStudentSignup } from '../src/services/validators.js';

const SECRET = 'test-secret';
const config = { jwtSecret: SECRET, cookieSecure: false, trustProxy: false, clientDist: '/nonexistent', utcOffsetMinutes: 480, deviceOfflineAfterMs: 120000 };

// A small in-memory stand-in for the stored procedures.
const students = [{ id: 1, studentNo: '21-0001', firstName: 'Juan', lastName: 'Dela Cruz', middleInitial: 'M', section: 'BSIT-3D', fullName: 'Dela Cruz, Juan M.' }];
let sessions = [];
let tables = [
  { tableNo: 1, seatCount: 4, gridCol: 0, gridRow: 0, gridWidth: 2, gridHeight: 2 },
  { tableNo: 2, seatCount: 2, gridCol: 2, gridRow: 0, gridWidth: 2, gridHeight: 2 },
];
const occupied = (tableNo) => sessions.filter((s) => s.tableNo === tableNo && !s.endedAt).reduce((n, s) => n + s.groupSize, 0);

const fakeDb = {
  ping: async () => {},
  closeStaleSessions: async () => {},
  getActiveMaintenance: async () => [],
  getLayout: async () => tables.map((t) => ({ ...t, deviceCode: null, threshold: null, lastStatus: null, lastLevel: null, lastSeenAt: null, isSample: false, tableIsSample: false, occupied: occupied(t.tableNo), groupSize: null, sessionStartedAt: null })),
  findStudent: async (no) => students.find((s) => s.studentNo === no) ?? null,
  registerStudent: async (d) => {
    if (students.some((s) => s.studentNo === d.studentNo)) return { success: false, message: 'That student number is already registered.' };
    students.push({ id: students.length + 1, ...d, fullName: `${d.lastName}, ${d.firstName}` });
    return { success: true, message: 'Account created successfully.' };
  },
  getActiveStudentSession: async (id) => {
    const s = sessions.find((x) => x.studentId === id && !x.endedAt);
    return s ? { sessionId: s.id, tableNo: s.tableNo, groupSize: s.groupSize, startedAt: s.startedAt } : null;
  },
  startSession: async ({ studentId, tableNo, groupSize, now }) => {
    if (sessions.some((s) => s.studentId === studentId && !s.endedAt)) return { success: false, message: 'You already have a table. End your current session first.' };
    const t = tables.find((x) => x.tableNo === tableNo);
    if (!t) return { success: false, message: 'That table does not exist.' };
    if (t.seatCount - occupied(tableNo) < groupSize) return { success: false, message: `Table ${tableNo} does not have ${groupSize} free seats.` };
    const id = sessions.length + 1;
    sessions.push({ id, studentId, tableNo, groupSize, startedAt: now, endedAt: null });
    return { success: true, message: 'Session started.', sessionId: id };
  },
  endSession: async ({ studentId, now }) => {
    const s = sessions.find((x) => x.studentId === studentId && !x.endedAt);
    if (!s) return { success: false, message: 'You do not have a table in use.' };
    s.endedAt = now;
    return { success: true, message: 'Session ended.' };
  },
  addTable: async (t) => {
    if (tables.some((x) => x.tableNo === t.tableNo)) return { success: false, message: `Table ${t.tableNo} already exists.` };
    tables.push({ tableNo: t.tableNo, seatCount: t.seatCount, gridCol: t.gridCol, gridRow: t.gridRow, gridWidth: t.gridWidth, gridHeight: t.gridHeight });
    return { success: true, message: `Table ${t.tableNo} added.` };
  },
  setTableSeats: async ({ tableNo, seatCount }) => {
    const t = tables.find((x) => x.tableNo === tableNo);
    if (!t) return { success: false, message: 'That table does not exist.' };
    if (seatCount < occupied(tableNo)) return { success: false, message: `Table ${tableNo} has ${occupied(tableNo)} people seated, so it cannot have fewer than ${occupied(tableNo)} seats.` };
    t.seatCount = seatCount;
    return { success: true, message: `Table ${tableNo} now has ${seatCount} seats.` };
  },
  clearSampleData: async () => ({ success: true, message: 'Sample data removed. Real records were kept.' }),
  getRewardSessions: async () => [],
  getDashboardSummary: async () => ({ sessionsToday: 0, studentsToday: 0, alertsToday: 0 }),
  getRecentAlerts: async () => [],
};

const faculty = (role) => `shush_session=${jwt.sign({ id: 1, facultyId: 'FAC-2024-0001', firstName: 'Jane', lastName: 'Doe', email: 'j@x.com', role }, SECRET)}`;
const student = () => `shush_student=${jwt.sign({ id: 1, studentNo: '21-0001', firstName: 'Juan', lastName: 'Dela Cruz', middleInitial: 'M', section: 'BSIT-3D', role: 'Student' }, SECRET)}`;

let server, base;
async function call(method, path, { cookie, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null), setCookie: res.headers.get('set-cookie') };
}

before(async () => {
  server = createApp({ db: fakeDb, config }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('student number and section rules', () => {
  assert.equal(normalizeStudentNo('210001'), '21-0001');
  assert.equal(normalizeStudentNo('21-0001'), '21-0001');
  assert.equal(normalizeStudentNo('2100'), null);
  assert.equal(validateStudentSignup({ studentNo: '22-0002', lastName: 'Reyes', firstName: 'Ana', section: 'bscs-1d' }).value.section, 'BSCS-1D');
  assert.match(validateStudentSignup({ studentNo: '22-0002', lastName: 'Reyes', firstName: 'Ana', section: 'BSIT3D' }).error, /BSIT-3D/);
  assert.match(validateStudentSignup({ studentNo: '22-0002', lastName: 'Reyes', firstName: 'Ana', middleInitial: 'Ann', section: 'BSIT-3D' }).error, /single letter/);
});

test('sign up validates and rejects duplicates', async () => {
  const bad = await call('POST', '/api/student/signup', { body: { studentNo: '2200', lastName: 'Reyes', firstName: 'Ana', section: 'BSIT-3D' } });
  assert.equal(bad.status, 400);
  const ok = await call('POST', '/api/student/signup', { body: { studentNo: '22-0002', lastName: 'Reyes', firstName: 'Ana', middleInitial: 'b.', section: 'BSCS-1D' } });
  assert.equal(ok.status, 201);
  const dup = await call('POST', '/api/student/signup', { body: { studentNo: '22-0002', lastName: 'Reyes', firstName: 'Ana', section: 'BSCS-1D' } });
  assert.equal(dup.status, 409);
});

test('login is two steps: lookup shows the name, then login sets a student cookie', async () => {
  assert.equal((await call('POST', '/api/student/lookup', { body: { studentNo: '99-9999' } })).status, 404);
  const found = await call('POST', '/api/student/lookup', { body: { studentNo: '21-0001' } });
  assert.equal(found.status, 200);
  assert.equal(found.body.student.name, 'Juan M. Dela Cruz');
  assert.equal(found.body.student.section, 'BSIT-3D');

  const login = await call('POST', '/api/student/login', { body: { studentNo: '210001' } });
  assert.equal(login.status, 200);
  assert.match(login.setCookie, /shush_student=/);
});

test('student routes need a student cookie, and faculty cookies do not work there', async () => {
  assert.equal((await call('GET', '/api/student/me')).status, 401);
  assert.equal((await call('GET', '/api/student/me', { cookie: faculty('Admin') })).status, 401);
  assert.equal((await call('GET', '/api/dashboard', { cookie: student() })).status, 401);
});

test('tables show free seats, and a session is started and ended', async () => {
  const list = await call('GET', '/api/student/tables?groupSize=3', { cookie: student() });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.tables.map((t) => t.fits), [true, false]);
  assert.equal(list.body.tables[0].device, undefined, 'device data is not shared with students');

  const start = await call('POST', '/api/student/session', { cookie: student(), body: { tableNo: 1, groupSize: 3 } });
  assert.equal(start.status, 201);

  const again = await call('POST', '/api/student/session', { cookie: student(), body: { tableNo: 1, groupSize: 1 } });
  assert.equal(again.status, 400);
  assert.match(again.body.message, /already have a table/);

  const me = await call('GET', '/api/student/me', { cookie: student() });
  assert.equal(me.body.session.tableNo, 1);

  const end = await call('POST', '/api/student/session/end', { cookie: student() });
  assert.equal(end.status, 200);
  assert.equal((await call('POST', '/api/student/session/end', { cookie: student() })).status, 404);
});

test('a full table is refused with a clear message', async () => {
  const res = await call('POST', '/api/student/session', { cookie: student(), body: { tableNo: 2, groupSize: 5 } });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /Table 2 does not have 5 free seats/);
});

test('admins can add a table by number and change its seats; students and faculty cannot', async () => {
  const add = await call('POST', '/api/settings/tables', { cookie: faculty('Admin'), body: { tableNo: 9, seats: 4 } });
  assert.equal(add.status, 201);
  assert.ok(tables.find((t) => t.tableNo === 9), 'table 9 was added');

  assert.equal((await call('POST', '/api/settings/tables', { cookie: faculty('Faculty'), body: { tableNo: 10, seats: 4 } })).status, 403);
  assert.equal((await call('POST', '/api/settings/tables', { cookie: student(), body: { tableNo: 10, seats: 4 } })).status, 401);

  assert.equal((await call('POST', '/api/settings/tables', { cookie: faculty('Admin'), body: { tableNo: 0, seats: 4 } })).status, 400);
  assert.equal((await call('POST', '/api/settings/tables', { cookie: faculty('Admin'), body: { tableNo: 10, seats: 25 } })).status, 400);
  assert.equal((await call('POST', '/api/settings/tables', { cookie: faculty('Admin'), body: { tableNo: 10, seats: 4, col: 3 } })).status, 400);

  const seats = await call('PUT', '/api/settings/tables/9', { cookie: faculty('Admin'), body: { seats: 6 } });
  assert.equal(seats.status, 200);
  assert.equal(tables.find((t) => t.tableNo === 9).seatCount, 6);
});

test('seats cannot drop below the number already seated', async () => {
  sessions.push({ id: 99, studentId: 7, tableNo: 1, groupSize: 3, startedAt: new Date(), endedAt: null });
  const res = await call('PUT', '/api/settings/tables/1', { cookie: faculty('Admin'), body: { seats: 2 } });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /3 people seated/);
  sessions = sessions.filter((s) => s.id !== 99);
});

test('free spot finder avoids overlaps', () => {
  const spot = findFreeSpot([{ grid: { col: 0, row: 0, width: 2, height: 2 } }]);
  assert.deepEqual(spot, { col: 2, row: 0, width: 2, height: 2 });
  const full = findFreeSpot(Array.from({ length: 6 }, (_, i) => ({ grid: { col: (i % 6) * 2, row: 0, width: 2, height: 2 } })));
  assert.deepEqual(full, { col: 0, row: 2, width: 2, height: 2 });
});
