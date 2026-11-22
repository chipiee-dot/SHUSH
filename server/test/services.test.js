import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, parseLocalDate, startOfLocalDay, startOfLocalMonth, startOfLocalWeek } from '../src/services/time.js';
import { buildLayout, deriveTableStatus, isDeviceOnline } from '../src/services/tableStatus.js';
import { computeRewards } from '../src/services/rewards.js';
import { computeWorkingHoursAnalytics } from '../src/services/noiseAnalytics.js';
import { buildStudentsOverview } from '../src/services/studentsOverview.js';
import { validateLayoutChanges } from '../src/services/layoutRules.js';

const PH = 480; // UTC+8
const iso = (d) => d.toISOString();

test('local day, week and month start on the library clock', () => {
  // Wed 11 Nov 2026, 20:00 UTC = Thu 12 Nov 04:00 Philippines time
  const now = new Date('2026-11-11T20:00:00Z');
  assert.equal(iso(startOfLocalDay(now, PH)), '2026-11-11T16:00:00.000Z');
  // Week starts Monday 9 Nov local = Sunday 8 Nov 16:00 UTC
  assert.equal(iso(startOfLocalWeek(now, PH)), '2026-11-08T16:00:00.000Z');
  assert.equal(iso(startOfLocalMonth(now, PH)), '2026-10-31T16:00:00.000Z');
});

test('parseLocalDate accepts real dates only', () => {
  assert.equal(iso(parseLocalDate('2026-11-11', PH)), '2026-11-10T16:00:00.000Z');
  assert.equal(parseLocalDate('2026-02-30', PH), null);
  assert.equal(parseLocalDate('11/11/2026', PH), null);
  assert.equal(parseLocalDate(['2026-11-11'], PH), null);
  assert.equal(iso(addDays(parseLocalDate('2026-11-11', PH), 1)), '2026-11-11T16:00:00.000Z');
});

test('device is online only if it reported recently (sample devices always are)', () => {
  const now = new Date('2026-11-11T04:00:00Z');
  assert.equal(isDeviceOnline({ lastSeenAt: '2026-11-11T03:59:00Z', isSample: false }, now, 120_000), true);
  assert.equal(isDeviceOnline({ lastSeenAt: '2026-11-11T03:00:00Z', isSample: false }, now, 120_000), false);
  assert.equal(isDeviceOnline({ lastSeenAt: null, isSample: false }, now, 120_000), false);
  assert.equal(isDeviceOnline({ lastSeenAt: null, isSample: true }, now, 120_000), true);
});

test('table status: maintenance beats everything, then device state', () => {
  assert.equal(deriveTableStatus({ hasDevice: true, underMaintenance: true, deviceOnline: true, deviceStatus: 'ALERT' }), 'MAINTENANCE');
  assert.equal(deriveTableStatus({ hasDevice: false, underMaintenance: false, deviceOnline: false }), 'NO_DEVICE');
  assert.equal(deriveTableStatus({ hasDevice: true, underMaintenance: false, deviceOnline: false, deviceStatus: 'QUIET' }), 'OFFLINE');
  assert.equal(deriveTableStatus({ hasDevice: true, underMaintenance: false, deviceOnline: true, deviceStatus: 'LOUD' }), 'LOUD');
});

test('buildLayout applies all-table and single-table maintenance', () => {
  const now = new Date('2026-11-11T04:00:00Z');
  const base = { occupied: 0, seatCount: 4, gridCol: 0, gridRow: 0, gridWidth: 2, gridHeight: 2, threshold: 1600, lastLevel: 1000, lastSeenAt: now, isSample: false };
  const rows = [
    { ...base, tableNo: 1, deviceCode: 'SHUSH-T01', lastStatus: 'QUIET', occupied: 3 },
    { ...base, tableNo: 2, deviceCode: 'SHUSH-T02', lastStatus: 'QUIET' },
    { ...base, tableNo: 3, deviceCode: null, lastStatus: null },
  ];
  const single = buildLayout(rows, [{ tableNo: 2, allTables: false }], { now, offlineAfterMs: 120_000 });
  assert.deepEqual(single.map((t) => t.status), ['QUIET', 'MAINTENANCE', 'NO_DEVICE']);
  assert.deepEqual(single[0].occupancy, { seated: 3, seats: 4 });

  const all = buildLayout(rows, [{ tableNo: null, allTables: true }], { now, offlineAfterMs: 120_000 });
  assert.ok(all.every((t) => t.status === 'MAINTENANCE' || t.status === 'NO_DEVICE'));
});

const session = (over) => ({
  studentId: 1, fullName: 'A', sessionId: 1, tableNo: 1,
  startedAt: '2026-11-10T02:00:00Z', endedAt: '2026-11-10T02:45:00Z',
  avgLevel: 1000, hadAlert: false, isSample: false, ...over,
});

test('rewards: frequency, quietest (30+ min only) and quiet streak', () => {
  const now = new Date('2026-11-11T04:00:00Z');
  const periodStart = new Date('2026-11-08T16:00:00Z'); // this week
  const rows = [
    // Ana: 3 sessions this week, one alert in between, then two quiet ones
    session({ studentId: 1, fullName: 'Ana', sessionId: 1, startedAt: '2026-11-09T01:00:00Z', endedAt: '2026-11-09T01:50:00Z', avgLevel: 900 }),
    session({ studentId: 1, fullName: 'Ana', sessionId: 2, startedAt: '2026-11-09T03:00:00Z', endedAt: '2026-11-09T03:50:00Z', avgLevel: 950, hadAlert: true }),
    session({ studentId: 1, fullName: 'Ana', sessionId: 3, startedAt: '2026-11-10T01:00:00Z', endedAt: '2026-11-10T01:40:00Z', avgLevel: 1000 }),
    session({ studentId: 1, fullName: 'Ana', sessionId: 4, startedAt: '2026-11-10T03:00:00Z', endedAt: '2026-11-10T03:45:00Z', avgLevel: 1100 }),
    // Ben: one short session (under 30 min) that is quiet but should not count for quietest
    session({ studentId: 2, fullName: 'Ben', sessionId: 5, startedAt: '2026-11-10T05:00:00Z', endedAt: '2026-11-10T05:10:00Z', avgLevel: 500 }),
    // Cy: one long, loud session; still in progress one should be ignored
    session({ studentId: 3, fullName: 'Cy', sessionId: 6, startedAt: '2026-11-10T06:00:00Z', endedAt: '2026-11-10T06:40:00Z', avgLevel: 1500, isSample: true }),
    session({ studentId: 3, fullName: 'Cy', sessionId: 7, startedAt: '2026-11-11T02:00:00Z', endedAt: null, avgLevel: null }),
  ];
  const r = computeRewards(rows, { periodStart, now, minSessionMinutes: 30 });

  assert.deepEqual(r.mostFrequent.map((e) => [e.name, e.value]), [['Ana', 4], ['Ben', 1], ['Cy', 1]]);
  assert.deepEqual(r.quietest.map((e) => [e.name, e.value]), [['Ana', 988], ['Cy', 1500]]);
  assert.equal(r.quietest.find((e) => e.name === 'Cy').isSample, true);
  // Ana's streak resets at the alert, so only the last two sessions count
  assert.deepEqual(r.quietStreak.map((e) => [e.name, e.value]), [['Ana', 2], ['Ben', 1], ['Cy', 1]]);
  assert.equal(r.hasSampleData, true);
});

test('rewards: quiet streak is 0 (not listed) when the latest session had an alert', () => {
  const r = computeRewards(
    [session({ studentId: 9, fullName: 'Dee', hadAlert: true })],
    { periodStart: new Date('2026-01-01T00:00:00Z'), now: new Date('2026-11-11T00:00:00Z') }
  );
  assert.deepEqual(r.quietStreak, []);
});

// ---- Floor-plan layout save ----
const plan = [
  { tableNo: 1, gridCol: 0, gridRow: 0, gridWidth: 2, gridHeight: 2, occupied: 3 },
  { tableNo: 2, gridCol: 2, gridRow: 0, gridWidth: 2, gridHeight: 2, occupied: 0 },
  { tableNo: 3, gridCol: 4, gridRow: 0, gridWidth: 2, gridHeight: 2, occupied: 0 },
];
const move = (tableNo, col, row, extra = {}) => ({ tableNo, col, row, width: 2, height: 2, ...extra });

test('layout: a valid move is accepted', () => {
  assert.deepEqual(validateLayoutChanges([move(3, 0, 6)], plan), { ok: true });
});

test('layout: moving onto another table is a 409', () => {
  const r = validateLayoutChanges([move(2, 0, 0)], plan);
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
});

test('layout: two tables can swap places in one save', () => {
  assert.deepEqual(validateLayoutChanges([move(2, 0, 0), move(1, 2, 0)], plan), { ok: true });
});

test('layout: column + width past 12 is a 400', () => {
  assert.equal(validateLayoutChanges([move(3, 11, 0)], plan).status, 400);
});

test('layout: a row past 99 is a 400', () => {
  assert.equal(validateLayoutChanges([move(3, 0, 99)], plan).status, 400);
  assert.deepEqual(validateLayoutChanges([move(3, 0, 98)], plan), { ok: true });
});

test('layout: a table must stay 2 rows tall', () => {
  assert.equal(validateLayoutChanges([move(3, 0, 6, { height: 3 })], plan).status, 400);
  assert.equal(validateLayoutChanges([move(3, 0, 6, { height: 1 })], plan).status, 400);
  assert.deepEqual(validateLayoutChanges([move(3, 0, 6, { width: 3 })], plan), { ok: true }); // wider is fine
});

test('layout: seats above 20 are a 400', () => {
  assert.equal(validateLayoutChanges([move(3, 0, 6, { seats: 21 })], plan).status, 400);
});

test('layout: seats below the students seated now are a 409', () => {
  const r = validateLayoutChanges([move(1, 0, 6, { seats: 2 })], plan);
  assert.equal(r.status, 409);
  assert.deepEqual(validateLayoutChanges([move(1, 0, 6, { seats: 3 })], plan), { ok: true });
});

test('layout: duplicate and unknown tables are a 400', () => {
  assert.equal(validateLayoutChanges([move(3, 0, 6), move(3, 0, 8)], plan).status, 400);
  assert.equal(validateLayoutChanges([move(9, 0, 6)], plan).status, 400);
});

test('layout: bad input shapes are a 400', () => {
  assert.equal(validateLayoutChanges(undefined, plan).status, 400);
  assert.equal(validateLayoutChanges([], plan).status, 400);
  assert.equal(validateLayoutChanges([move(3, 1.5, 6)], plan).status, 400);
  assert.equal(validateLayoutChanges(Array.from({ length: 101 }, () => move(3, 0, 6)), plan).status, 400);
});

// ---- Working-hours noise analytics ----
test('noise analytics: buckets working hours in local time and contrasts peak vs quietest', () => {
  // Library is UTC+8. 2026-11-11 local working hours:
  // 08:00 local = 00:00Z, 14:00 local = 06:00Z, 17:00 local = 09:00Z.
  const periodStart = new Date('2026-11-10T16:00:00Z'); // 2026-11-11 00:00 local
  const now = new Date('2026-11-11T12:00:00Z'); // 2026-11-11 20:00 local

  const sessions = [
    // 08:15 - 08:50 local (quiet morning hour)
    { sessionId: 1, startedAt: '2026-11-11T00:15:00Z', endedAt: '2026-11-11T00:50:00Z', avgLevel: 900, isSample: false },
    // Duplicate sessionId should only be counted once
    { sessionId: 1, startedAt: '2026-11-11T00:15:00Z', endedAt: '2026-11-11T00:50:00Z', avgLevel: 900, isSample: false },
    // 14:10 - 14:55 local (peak noisy afternoon hour)
    { sessionId: 2, startedAt: '2026-11-11T06:10:00Z', endedAt: '2026-11-11T06:55:00Z', avgLevel: 1800, isSample: true },
    // 14:20 - 14:40 local
    { sessionId: 3, startedAt: '2026-11-11T06:20:00Z', endedAt: '2026-11-11T06:40:00Z', avgLevel: 1600, isSample: false },
    // Off-hours (06:00 - 07:00 local = 22:00Z - 23:00Z prev day) must be ignored
    { sessionId: 4, startedAt: '2026-11-10T22:00:00Z', endedAt: '2026-11-10T23:00:00Z', avgLevel: 2500, isSample: false },
    // Off-hours (19:00 - 19:30 local = 11:00Z - 11:30Z) must be ignored
    { sessionId: 5, startedAt: '2026-11-11T11:00:00Z', endedAt: '2026-11-11T11:30:00Z', avgLevel: 2600, isSample: false },
  ];

  const alerts = [
    // Two alerts at 14:xx local (06:xx UTC)
    { occurredAt: '2026-11-11T06:25:00Z', isSample: false },
    { occurredAt: '2026-11-11T06:45:00Z', isSample: true },
    // Off-hours alert at 20:00 local (12:00Z) or 07:30 local (23:30Z prev day) ignored
    { occurredAt: '2026-11-10T23:30:00Z', isSample: false },
  ];

  const result = computeWorkingHoursAnalytics({ sessions, alerts }, { periodStart, now, offsetMinutes: PH });

  assert.equal(result.hours.length, 10); // 8 AM..5 PM
  assert.equal(result.hours[0].label, '8 AM');
  assert.equal(result.hours[9].label, '5 PM');

  assert.equal(result.peakHour.hour, 14);
  assert.equal(result.peakHour.avgLevel, 1700);
  assert.equal(result.peakHour.alertCount, 2);
  assert.equal(result.peakHour.sessionCount, 2);

  assert.equal(result.quietestHour.hour, 8);
  assert.equal(result.quietestHour.avgLevel, 900);
  assert.equal(result.quietestHour.alertCount, 0);
  assert.equal(result.quietestHour.sessionCount, 1);

  assert.equal(result.overallAvgLevel, 1300); // (900 + 1700) / 2
  assert.equal(result.totalAlerts, 2);
  assert.equal(result.totalSessions, 3);
  assert.deepEqual(result.contrast, { levelDelta: 800, quietPct: 47, alertDelta: 2 });
  assert.equal(result.hasSampleData, true);
});

test('noise analytics: handles multi-hour sessions and empty data cleanly', () => {
  const periodStart = new Date('2026-11-10T16:00:00Z');
  const now = new Date('2026-11-11T16:00:00Z');

  // Empty data
  const empty = computeWorkingHoursAnalytics({ sessions: [], alerts: [] }, { periodStart, now, offsetMinutes: PH });
  assert.equal(empty.hours.length, 10);
  assert.equal(empty.peakHour, null);
  assert.equal(empty.quietestHour, null);
  assert.equal(empty.contrast, null);
  assert.equal(empty.overallAvgLevel, 0);
  assert.equal(empty.totalAlerts, 0);
  assert.equal(empty.totalSessions, 0);

  // Multi-hour session spanning 10:30 - 12:15 local (02:30Z - 04:15Z) -> hours 10, 11, 12
  // Plus a single-hour session at 12:00 - 13:00 local (04:00Z - 05:00Z) -> hour 12 only
  const multi = computeWorkingHoursAnalytics(
    {
      sessions: [
        { sessionId: 10, startedAt: '2026-11-11T02:30:00Z', endedAt: '2026-11-11T04:15:00Z', avgLevel: 1000 },
        { sessionId: 11, startedAt: '2026-11-11T04:00:00Z', endedAt: '2026-11-11T05:00:00Z', avgLevel: 1400 },
      ],
      alerts: [],
    },
    { periodStart, now, offsetMinutes: PH }
  );

  const byHour = Object.fromEntries(multi.hours.map((h) => [h.hour, h]));
  assert.equal(byHour[10].avgLevel, 1000);
  assert.equal(byHour[11].avgLevel, 1000);
  assert.equal(byHour[12].avgLevel, 1200); // (1000 + 1400) / 2
  assert.equal(byHour[13].sessionCount, 0); // 12:00-13:00 ends right on 13:00 boundary
  assert.equal(multi.totalSessions, 2);
  assert.equal(multi.peakHour.hour, 12);
  assert.equal(multi.quietestHour.hour, 10);
});

test('noise analytics: supports table filter, custom hours, excludeWeekends and ambient hourlyReadings', () => {
  // 2026-11-13 is Friday (UTC+8), 2026-11-14 is Saturday (UTC+8).
  const periodStart = new Date('2026-11-12T16:00:00Z'); // Fri 2026-11-13 00:00 local
  const now = new Date('2026-11-14T16:00:00Z'); // Sat 2026-11-14 24:00 local

  const sessions = [
    // Table 1 on Friday 18:10 - 18:45 local (10:10Z - 10:45Z)
    { sessionId: 20, tableNo: 1, startedAt: '2026-11-13T10:10:00Z', endedAt: '2026-11-13T10:45:00Z', avgLevel: 1550 },
    // Table 2 on Friday 18:10 - 18:45 local (must be excluded when tableNo: 1)
    { sessionId: 21, tableNo: 2, startedAt: '2026-11-13T10:10:00Z', endedAt: '2026-11-13T10:45:00Z', avgLevel: 2100 },
    // Table 1 on Saturday 10:00 - 11:00 local (02:00Z - 03:00Z) -> excluded when excludeWeekends: true
    { sessionId: 22, tableNo: 1, startedAt: '2026-11-14T02:00:00Z', endedAt: '2026-11-14T03:00:00Z', avgLevel: 2300 },
  ];

  const hourlyReadings = [
    // Ambient readings on Table 1 at Friday 07:00 local (23:00Z Thu) with NO active student session
    { hourUtc: '2026-11-12T23:00:00Z', tableNo: 1, avgLevel: 820, readingCount: 24, isSample: false },
    // Ambient readings on Table 2 at Friday 07:00 local (filtered out when tableNo: 1)
    { hourUtc: '2026-11-12T23:00:00Z', tableNo: 2, avgLevel: 1900, readingCount: 15, isSample: false },
    // Ambient readings on Table 1 on Saturday 09:00 local (01:00Z Sat) -> excluded when excludeWeekends: true
    { hourUtc: '2026-11-14T01:00:00Z', tableNo: 1, avgLevel: 2200, readingCount: 10, isSample: false },
  ];

  const alerts = [
    { occurredAt: '2026-11-13T10:20:00Z', tableNo: 1, isSample: false },
    { occurredAt: '2026-11-13T10:25:00Z', tableNo: 2, isSample: false },
  ];

  const result = computeWorkingHoursAnalytics(
    { sessions, alerts, hourlyReadings },
    {
      periodStart,
      now,
      offsetMinutes: PH,
      workStartHour: 7,
      workEndHour: 19,
      excludeWeekends: true,
      tableNo: 1,
    }
  );

  assert.equal(result.hours.length, 13); // 7 AM..7 PM
  assert.equal(result.hours[0].label, '7 AM');
  assert.equal(result.hours[12].label, '7 PM');
  assert.equal(result.tableNo, 1);
  assert.deepEqual(result.workHours, { start: 7, end: 19, excludeWeekends: true });

  // Peak should be 18:00 (6p) on Table 1 Friday, NOT Saturday or Table 2
  assert.equal(result.peakHour.hour, 18);
  assert.equal(result.peakHour.avgLevel, 1550);
  assert.equal(result.peakHour.alertCount, 1);
  assert.equal(result.peakHour.sessionCount, 1);

  // Quietest should be 07:00 (7a) from ambient hourlyReadings with 0 student sessions
  assert.equal(result.quietestHour.hour, 7);
  assert.equal(result.quietestHour.avgLevel, 820);
  assert.equal(result.quietestHour.sessionCount, 0);
  assert.equal(result.quietestHour.readingCount, 24);

  assert.equal(result.totalSessions, 1);
  assert.equal(result.totalReadings, 24);
  assert.equal(result.totalAlerts, 1);
  assert.deepEqual(result.contrast, { levelDelta: 730, quietPct: 47, alertDelta: 1 });
});

// ---- Students overview ----
test('students overview enriches active sessions, completed visits, directory and summary', () => {
  const now = new Date('2026-11-22T10:00:00Z');
  const dayStart = new Date('2026-11-22T00:00:00Z');

  const tables = [
    {
      tableNo: 1,
      seats: 4,
      status: 'ALERT',
      occupancy: { seated: 1, seats: 4 },
      device: { code: 'SHUSH-T01', level: 1740, threshold: 1600, online: true },
    },
    {
      tableNo: 2,
      seats: 2,
      status: 'QUIET',
      occupancy: { seated: 0, seats: 2 },
      device: { code: 'SHUSH-T02', level: 920, threshold: 1600, online: true },
    },
  ];

  const students = [
    { studentId: 1, studentNo: '21-0001', fullName: 'Reyes, Ana', section: 'BSIT-3D', registeredAt: '2026-11-01T00:00:00Z', isSample: false },
    { studentId: 2, studentNo: '21-0002', fullName: 'Cruz, Ben', section: 'BSCS-1D', registeredAt: '2026-11-02T00:00:00Z', isSample: true },
    { studentId: 3, studentNo: '21-0003', fullName: 'Santos, Lea', section: 'BSEE-2D', registeredAt: '2026-11-03T00:00:00Z', isSample: false },
  ];

  const sessions = [
    // Active session today for Ana at Table 1 (30 min ago)
    {
      sessionId: 101,
      studentId: 1,
      studentNo: '21-0001',
      fullName: 'Reyes, Ana',
      section: 'BSIT-3D',
      tableNo: 1,
      startedAt: '2026-11-22T09:30:00Z',
      endedAt: null,
      avgLevel: null,
      hadAlert: false,
      isSample: false,
    },
    // Completed session today for Ana at Table 2
    {
      sessionId: 100,
      studentId: 1,
      studentNo: '21-0001',
      fullName: 'Reyes, Ana',
      section: 'BSIT-3D',
      tableNo: 2,
      startedAt: '2026-11-22T02:00:00Z',
      endedAt: '2026-11-22T02:45:00Z',
      avgLevel: 980,
      hadAlert: false,
      isSample: false,
    },
    // Completed session yesterday for Ben at Table 1 with alert
    {
      sessionId: 99,
      studentId: 2,
      studentNo: '21-0002',
      fullName: 'Cruz, Ben',
      section: 'BSCS-1D',
      tableNo: 1,
      startedAt: '2026-11-21T04:00:00Z',
      endedAt: '2026-11-21T05:00:00Z',
      avgLevel: 1650,
      hadAlert: true,
      isSample: true,
    },
  ];

  const overview = buildStudentsOverview({ sessions, students, tables, now, dayStart });

  assert.equal(overview.sample, true);
  assert.deepEqual(overview.summary, {
    seatedNow: 1,
    tablesOccupied: 1,
    tablesTotal: 2,
    visitsToday: 2,
    uniqueStudentsToday: 1,
    totalRegistered: 3,
    sections: ['BSCS-1D', 'BSEE-2D', 'BSIT-3D'],
  });

  assert.equal(overview.activeSessions.length, 1);
  assert.equal(overview.activeSessions[0].name, 'Reyes, Ana');
  assert.equal(overview.activeSessions[0].tableStatus, 'ALERT');
  assert.equal(overview.activeSessions[0].deviceLevel, 1740);
  assert.equal(overview.activeSessions[0].durationMinutes, 30);

  assert.equal(overview.completedSessions.length, 2);
  assert.equal(overview.completedSessions[0].durationMinutes, 45);
  assert.equal(overview.completedSessions[1].hadAlert, true);

  assert.equal(overview.directory.length, 3);
  // Active student is sorted first
  assert.equal(overview.directory[0].studentId, 1);
  assert.equal(overview.directory[0].activeSession.tableNo, 1);
  assert.equal(overview.directory[0].totalSessions, 2);
  assert.equal(overview.directory[0].totalMinutes, 75);
  assert.equal(overview.directory[0].quietStreak, 1);
  assert.equal(overview.directory[0].favoriteTableNo, 1);
  assert.equal(overview.directory[0].avgNoiseLevel, 980);
  const ben = overview.directory.find((d) => d.studentId === 2);
  assert.equal(ben.quietStreak, 0);
  assert.equal(ben.totalMinutes, 60);
  assert.equal(ben.favoriteTableNo, 1);
  const lea = overview.directory.find((d) => d.studentId === 3);
  assert.equal(lea.activeSession, null);
  assert.equal(lea.totalSessions, 0);
  assert.equal(lea.totalMinutes, 0);
  assert.equal(lea.quietStreak, 0);
  assert.equal(lea.favoriteTableNo, null);
  assert.equal(lea.avgNoiseLevel, null);
});
