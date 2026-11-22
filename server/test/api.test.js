import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';

const SECRET = 'test-secret';
const config = {
  jwtSecret: SECRET,
  cookieSecure: false,
  trustProxy: false,
  clientDist: '/nonexistent',
  utcOffsetMinutes: 480,
  deviceOfflineAfterMs: 120_000,
};

// Stand-in for the database: same method names, canned data.
const now = new Date();
const fakeDb = {
  lastHistoryArgs: null,
  lastLayout: null,
  ping: async () => {},
  closeStaleSessions: async () => {},
  getLayout: async () => [
    { tableNo: 1, seatCount: 4, gridCol: 0, gridRow: 0, gridWidth: 2, gridHeight: 2, deviceCode: 'SHUSH-T01', threshold: 1600, lastStatus: 'ALERT', lastLevel: 1725, lastSeenAt: now, isSample: true, occupied: 3, sessionStartedAt: now },
    { tableNo: 2, seatCount: 2, gridCol: 2, gridRow: 0, gridWidth: 2, gridHeight: 2, deviceCode: null, threshold: null, lastStatus: null, lastLevel: null, lastSeenAt: null, isSample: false, occupied: 0, sessionStartedAt: null },
  ],
  getDashboardSummary: async () => ({ sessionsToday: 5, studentsToday: 9, alertsToday: 2 }),
  getRecentAlerts: async () => [{ id: 1, tableNo: 1, deviceCode: 'SHUSH-T01', level: 1725, threshold: 1600, triggeredAt: now, isSample: true }],
  getActiveMaintenance: async () => [],
  startMaintenance: async (args) => ({ success: true, message: 'Maintenance started.', id: 7, args }),
  endMaintenance: async () => ({ success: false, message: 'That maintenance period is not active.' }),
  setDeviceThreshold: async ({ deviceCode }) =>
    deviceCode === 'SHUSH-T01'
      ? { success: true, message: 'Threshold saved.' }
      : { success: false, message: 'That device does not exist.' },
  saveLayout: async (changes) => {
    fakeDb.lastLayout = changes;
    return { success: true, message: `Layout saved. ${changes.length} table(s) updated.` };
  },
  getRewardSessions: async () => [],
  getHistory: async (args) => {
    fakeDb.lastHistoryArgs = args;
    return [];
  },
  getStudentsOverview: async () => ({
    sessions: [
      {
        sessionId: 12,
        studentId: 5,
        studentNo: '21-0001',
        fullName: 'Reyes, Ana',
        section: 'BSIT-3D',
        tableNo: 1,
        startedAt: now,
        endedAt: null,
        avgLevel: null,
        hadAlert: false,
        isSample: true,
      },
    ],
    students: [
      {
        studentId: 5,
        studentNo: '21-0001',
        fullName: 'Reyes, Ana',
        section: 'BSIT-3D',
        registeredAt: now,
        isSample: true,
      },
    ],
  }),
  endSession: async ({ studentId }) =>
    studentId === 5
      ? { success: true, message: 'Session ended.' }
      : { success: false, message: 'You do not have a table in use.' },
};

let server;
let base;
const cookieFor = (role) =>
  `shush_session=${jwt.sign({ id: 1, facultyId: 'FAC-2024-0001', firstName: 'Jane', lastName: 'Doe', email: 'j@x.com', role }, SECRET)}`;
const FACULTY = cookieFor('Faculty');
const ADMIN = cookieFor('Admin');

async function call(method, path, { cookie, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

before(async () => {
  const app = createApp({ db: fakeDb, config });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('faculty console needs a signed-in session', async () => {
  assert.equal((await call('GET', '/api/dashboard')).status, 401);
  assert.equal((await call('GET', '/api/layout')).status, 401);
});

test('dashboard summarises tables, devices and alerts', async () => {
  const { status, body } = await call('GET', '/api/dashboard', { cookie: FACULTY });
  assert.equal(status, 200);
  assert.equal(body.summary.tablesTotal, 2);
  assert.equal(body.summary.tablesOccupied, 1);
  assert.equal(body.summary.activeAlerts, 1);
  assert.equal(body.summary.devicesTotal, 1);
  assert.equal(body.summary.devicesOnline, 1);
  assert.equal(body.summary.sessionsToday, 5);
  assert.equal(body.sample, true);
  assert.equal(body.alerts[0].deviceCode, 'SHUSH-T01');
});

test('layout reports each table with occupancy and status', async () => {
  const { body } = await call('GET', '/api/layout', { cookie: FACULTY });
  assert.deepEqual(body.tables.map((t) => t.status), ['ALERT', 'NO_DEVICE']);
  assert.deepEqual(body.tables[0].occupancy, { seated: 3, seats: 4 });
  assert.deepEqual(body.tables[0].grid, { col: 0, row: 0, width: 2, height: 2 });
});

test('maintenance validates input and starts a window', async () => {
  const bad = await call('POST', '/api/maintenance', { cookie: FACULTY, body: { tableNo: 'all', reason: 'x', durationMinutes: 30 } });
  assert.equal(bad.status, 400);
  const badDuration = await call('POST', '/api/maintenance', { cookie: FACULTY, body: { tableNo: 'all', reason: 'Cleaning', durationMinutes: 9999 } });
  assert.equal(badDuration.status, 400);
  const badTable = await call('POST', '/api/maintenance', { cookie: FACULTY, body: { tableNo: 'two', reason: 'Cleaning', durationMinutes: 30 } });
  assert.equal(badTable.status, 400);

  const ok = await call('POST', '/api/maintenance', { cookie: FACULTY, body: { tableNo: 3, reason: '  Sensor check ', durationMinutes: 30 } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.id, 7);
});

test('ending a window that is not active returns 404', async () => {
  const { status } = await call('POST', '/api/maintenance/3/end', { cookie: FACULTY });
  assert.equal(status, 404);
});

test('settings are admin only', async () => {
  assert.equal((await call('GET', '/api/settings/devices', { cookie: FACULTY })).status, 403);
  assert.equal((await call('PUT', '/api/settings/devices/SHUSH-T01', { cookie: FACULTY, body: { threshold: 1500 } })).status, 403);
  assert.equal((await call('GET', '/api/settings/devices')).status, 401);
});

test('admin can read and change a device threshold, with validation', async () => {
  const list = await call('GET', '/api/settings/devices', { cookie: ADMIN });
  assert.equal(list.status, 200);
  assert.equal(list.body.devices[0].deviceCode, 'SHUSH-T01');

  assert.equal((await call('PUT', '/api/settings/devices/SHUSH-T01', { cookie: ADMIN, body: { threshold: 5000 } })).status, 400);
  assert.equal((await call('PUT', '/api/settings/devices/SHUSH-T01', { cookie: ADMIN, body: { threshold: 1.5 } })).status, 400);
  assert.equal((await call('PUT', '/api/settings/devices/SHUSH-T01', { cookie: ADMIN, body: { threshold: 1500 } })).status, 200);
  assert.equal((await call('PUT', '/api/settings/devices/SHUSH-T99', { cookie: ADMIN, body: { threshold: 1500 } })).status, 404);
});

test('history validates filters and passes a whole-day range to the database', async () => {
  assert.equal((await call('GET', '/api/history?kind=nope', { cookie: FACULTY })).status, 400);
  assert.equal((await call('GET', '/api/history?from=2026-02-30', { cookie: FACULTY })).status, 400);
  assert.equal((await call('GET', '/api/history?from=2026-01-01&to=2020-01-01', { cookie: FACULTY })).status, 400);
  assert.equal((await call('GET', '/api/history?from=2020-01-01&to=2026-01-01', { cookie: FACULTY })).status, 400);

  const ok = await call('GET', '/api/history?kind=alert&from=2026-11-01&to=2026-11-11&tableNo=1', { cookie: FACULTY });
  assert.equal(ok.status, 200);
  assert.equal(fakeDb.lastHistoryArgs.kind, 'alert');
  assert.equal(fakeDb.lastHistoryArgs.tableNo, 1);
  // "to" is inclusive: it runs to the start of the following library day
  assert.equal(fakeDb.lastHistoryArgs.to.toISOString(), '2026-11-11T16:00:00.000Z');
});

test('rewards accepts only the known periods', async () => {
  const { status, body } = await call('GET', '/api/rewards?period=week', { cookie: FACULTY });
  assert.equal(status, 200);
  assert.equal(body.period, 'week');
  assert.deepEqual(body.mostFrequent, []);
});

test('noise analytics validates period and returns working-hour buckets', async () => {
  const bad = await call('GET', '/api/analytics/noise?period=year', { cookie: FACULTY });
  assert.equal(bad.status, 400);

  const badTable = await call('GET', '/api/analytics/noise?period=week&tableNo=abc', { cookie: FACULTY });
  assert.equal(badTable.status, 400);

  const { status, body } = await call('GET', '/api/analytics/noise?period=week&tableNo=1', { cookie: FACULTY });
  assert.equal(status, 200);
  assert.equal(body.period, 'week');
  assert.equal(body.tableNo, 1);
  assert.equal(body.hours.length, 10);
  assert.equal(body.hours[0].label, '8 AM');
  assert.equal(body.hours[9].label, '5 PM');
});

test('working hours settings require admin role and validate hour range', async () => {
  assert.equal((await call('GET', '/api/settings/working-hours', { cookie: FACULTY })).status, 403);
  assert.equal((await call('PUT', '/api/settings/working-hours', { cookie: FACULTY, body: { startHour: 7, endHour: 19, excludeWeekends: true } })).status, 403);

  const invalid = await call('PUT', '/api/settings/working-hours', { cookie: ADMIN, body: { startHour: 18, endHour: 8, excludeWeekends: false } });
  assert.equal(invalid.status, 400);

  const saved = await call('PUT', '/api/settings/working-hours', { cookie: ADMIN, body: { startHour: 7, endHour: 19, excludeWeekends: true } });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.workingHours, { startHour: 7, endHour: 19, excludeWeekends: true });

  const fetched = await call('GET', '/api/settings/working-hours', { cookie: ADMIN });
  assert.equal(fetched.status, 200);
  assert.deepEqual(fetched.body.workingHours, { startHour: 7, endHour: 19, excludeWeekends: true });

  await call('PUT', '/api/settings/working-hours', { cookie: ADMIN, body: { startHour: 8, endHour: 17, excludeWeekends: false } });
});

test('students endpoint lists active sessions and can end a student session', async () => {
  assert.equal((await call('GET', '/api/students')).status, 401);

  const res = await call('GET', '/api/students', { cookie: FACULTY });
  assert.equal(res.status, 200);
  assert.equal(res.body.summary.seatedNow, 1);
  assert.equal(res.body.activeSessions[0].tableNo, 1);
  assert.equal(res.body.activeSessions[0].tableStatus, 'ALERT');
  assert.equal(res.body.directory[0].studentNo, '21-0001');

  assert.equal((await call('POST', '/api/students/abc/end-session', { cookie: FACULTY })).status, 400);
  assert.equal((await call('POST', '/api/students/999/end-session', { cookie: FACULTY })).status, 404);
  assert.equal((await call('POST', '/api/students/5/end-session', { cookie: FACULTY })).status, 200);
});

test('saving the layout needs sign-in and is validated', async () => {
  const body = { tables: [{ tableNo: 2, col: 0, row: 6, width: 2, height: 2 }] };
  assert.equal((await call('PUT', '/api/settings/layout', { body })).status, 401);
  assert.equal((await call('PUT', '/api/settings/layout', { cookie: FACULTY, body })).status, 200);

  const ok = await call('PUT', '/api/settings/layout', { cookie: ADMIN, body });
  assert.equal(ok.status, 200);
  assert.deepEqual(fakeDb.lastLayout, body.tables);

  // Table 2 onto Table 1 (columns 0-1, rows 0-1)
  const overlap = await call('PUT', '/api/settings/layout', {
    cookie: ADMIN, body: { tables: [{ tableNo: 2, col: 0, row: 0, width: 2, height: 2 }] },
  });
  assert.equal(overlap.status, 409);

  // Column 11 with width 2 runs off the 12-column grid
  const outside = await call('PUT', '/api/settings/layout', {
    cookie: ADMIN, body: { tables: [{ tableNo: 2, col: 11, row: 0, width: 2, height: 2 }] },
  });
  assert.equal(outside.status, 400);
});
