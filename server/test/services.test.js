import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, parseLocalDate, startOfLocalDay, startOfLocalMonth, startOfLocalWeek } from '../src/services/time.js';
import { buildLayout, deriveTableStatus, isDeviceOnline } from '../src/services/tableStatus.js';
import { computeRewards } from '../src/services/rewards.js';

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
  const base = { groupSize: null, seatCount: 4, gridCol: 0, gridRow: 0, gridWidth: 2, gridHeight: 2, threshold: 1600, lastLevel: 1000, lastSeenAt: now, isSample: false };
  const rows = [
    { ...base, tableNo: 1, deviceCode: 'SHUSH-T01', lastStatus: 'QUIET', groupSize: 3 },
    { ...base, tableNo: 2, deviceCode: 'SHUSH-T02', lastStatus: 'QUIET' },
    { ...base, tableNo: 3, deviceCode: null, lastStatus: null },
  ];
  const single = buildLayout(rows, [{ tableNo: 2, allTables: false }], { now, offlineAfterMs: 120_000 });
  assert.deepEqual(single.map((t) => t.status), ['QUIET', 'MAINTENANCE', 'NO_DEVICE']);
  assert.deepEqual(single[0].occupancy, { groupSize: 3, seats: 4 });

  const all = buildLayout(rows, [{ tableNo: null, allTables: true }], { now, offlineAfterMs: 120_000 });
  assert.ok(all.every((t) => t.status === 'MAINTENANCE' || t.status === 'NO_DEVICE'));
});

const session = (over) => ({
  studentId: 1, fullName: 'A', sessionId: 1, tableNo: 1, groupSize: 2,
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
