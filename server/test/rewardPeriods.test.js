import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addLocalMonths, certificateName, createRewardPeriods, toCertificate } from '../src/services/rewardPeriods.js';
import { computeRewards } from '../src/services/rewards.js';

const OFFSET = 480; // the library is UTC+8

// A small in-memory stand-in for the reward-period procedures.
function memoryDb(sessions, students = {}) {
  const periods = [];
  const certs = [];
  const db = {
    periods,
    certs,
    getRewardSessions: async () => sessions,
    getCurrentRewardPeriod: async ({ defaultStart }) => {
      let current = periods.find((p) => !p.endedAt);
      if (!current) {
        current = { id: periods.length + 1, startedAt: periods.length ? periods[periods.length - 1].endedAt : defaultStart, endedAt: null };
        periods.push(current);
      }
      return { id: current.id, startedAt: current.startedAt };
    },
    closeRewardPeriod: async ({ periodId, endedAt, reason, endedBy, certificates }) => {
      const period = periods.find((p) => p.id === periodId);
      if (!period || period.endedAt) return { success: false, message: 'That rewards period is already closed.' };
      Object.assign(period, { endedAt, endReason: reason, endedBy });
      for (const c of certificates) {
        const who = students[c.studentId] ?? {};
        certs.push({ id: certs.length + 1, periodId, issuedAt: endedAt, ...c, ...who });
      }
      periods.push({ id: periods.length + 1, startedAt: endedAt, endedAt: null });
      return { success: true, message: 'Rewards period ended.', certificateCount: certificates.length };
    },
    listRewardPeriods: async () => periods.filter((p) => p.endedAt).map((p) => ({ ...p, certificateCount: certs.filter((c) => c.periodId === p.id).length })).reverse(),
    getCertificates: async (periodId) => {
      const closed = periods.filter((p) => p.endedAt);
      const period = periodId ? closed.find((p) => p.id === periodId) : closed[closed.length - 1];
      return { period: period ?? null, certificates: period ? certs.filter((c) => c.periodId === period.id) : [] };
    },
    getStudentCertificates: async (studentId) =>
      certs.filter((c) => c.studentId === studentId).map((c) => {
        const p = periods.find((x) => x.id === c.periodId);
        return { ...c, periodStartedAt: p.startedAt, periodEndedAt: p.endedAt, periodEndReason: p.endReason };
      }),
  };
  return db;
}

const session = (over) => ({
  studentId: 1, fullName: 'Ana', sessionId: 1, tableNo: 1,
  startedAt: '2026-11-10T02:00:00Z', endedAt: '2026-11-10T02:45:00Z',
  avgLevel: 1000, hadAlert: false, isSample: false, ...over,
});

// November 2026: Ana visits three times (loud), Ben once (quiet, 45 minutes), Cy once for only 10 minutes.
const NOVEMBER = [
  session({ studentId: 1, fullName: 'Ana', sessionId: 1, startedAt: '2026-11-03T02:00:00Z', endedAt: '2026-11-03T02:45:00Z', avgLevel: 1200 }),
  session({ studentId: 1, fullName: 'Ana', sessionId: 2, startedAt: '2026-11-10T02:00:00Z', endedAt: '2026-11-10T02:45:00Z', avgLevel: 1100 }),
  session({ studentId: 1, fullName: 'Ana', sessionId: 3, startedAt: '2026-11-17T02:00:00Z', endedAt: '2026-11-17T02:45:00Z', avgLevel: 1000 }),
  session({ studentId: 2, fullName: 'Ben', sessionId: 4, startedAt: '2026-11-12T02:00:00Z', endedAt: '2026-11-12T02:45:00Z', avgLevel: 500 }),
  session({ studentId: 3, fullName: 'Cy', sessionId: 5, startedAt: '2026-11-13T02:00:00Z', endedAt: '2026-11-13T02:10:00Z', avgLevel: 100 }),
];
const WHO = {
  1: { firstName: 'Ana', lastName: 'Reyes', middleInitial: 'B', studentNo: '21-0001', section: 'BSIT-3D' },
  2: { firstName: 'Ben', lastName: 'Cruz', studentNo: '21-0002', section: 'BSIT-3D' },
};

test('months are added in library time and clamp to the last day of a short month', () => {
  // Nov 1 00:00 (UTC+8) -> Dec 1 00:00
  assert.equal(addLocalMonths(new Date('2026-10-31T16:00:00Z'), 1, OFFSET).toISOString(), '2026-11-30T16:00:00.000Z');
  // Jan 31 -> Feb 28 (2026 is not a leap year)
  assert.equal(addLocalMonths(new Date('2026-01-30T16:00:00Z'), 1, OFFSET).toISOString(), '2026-02-27T16:00:00.000Z');
  // Dec -> Jan rolls the year
  assert.equal(addLocalMonths(new Date('2026-12-14T03:00:00Z'), 1, OFFSET).toISOString(), '2027-01-14T03:00:00.000Z');
});

test('the first period starts at the start of the month and closes one calendar month later', async () => {
  const db = memoryDb(NOVEMBER);
  const periods = createRewardPeriods({ db, offsetMinutes: OFFSET });
  const current = await periods.ensureCurrent(new Date('2026-11-26T07:00:00Z'));
  assert.equal(new Date(current.startedAt).toISOString(), '2026-10-31T16:00:00.000Z'); // Nov 1, 00:00 library time
  assert.equal(current.closesAt.toISOString(), '2026-11-30T16:00:00.000Z'); // Dec 1, 00:00 library time
  assert.equal(db.certs.length, 0, 'nothing is issued while the period is still running');
});

test('an overdue period closes by itself, certificates go to the #1 of each award, and counts restart', async () => {
  const db = memoryDb([
    ...NOVEMBER,
    session({ studentId: 3, fullName: 'Cy', sessionId: 6, startedAt: '2026-12-01T05:00:00Z', endedAt: '2026-12-01T05:45:00Z', avgLevel: 700 }), // December
  ], WHO);
  const periods = createRewardPeriods({ db, offsetMinutes: OFFSET });

  await periods.ensureCurrent(new Date('2026-11-26T07:00:00Z')); // November is running
  const current = await periods.ensureCurrent(new Date('2026-12-02T01:00:00Z')); // a day after it was due

  const closed = db.periods[0];
  assert.equal(closed.endReason, 'auto');
  assert.equal(closed.endedAt.toISOString(), '2026-11-30T16:00:00.000Z', 'dated to when it was due, not when someone looked');
  assert.deepEqual(
    db.certs.map((c) => [c.category, c.studentId, c.value, c.sessionCount]),
    [['frequent', 1, 3, 3], ['quietest', 2, 500, 1]],
    'Ana visited most; Ben was quietest. Cy had only a 10 minute session, which does not qualify'
  );
  assert.equal(new Date(current.startedAt).toISOString(), '2026-11-30T16:00:00.000Z', 'the next period starts where the last one ended');

  // The December session does not belong to the closed November period.
  const board = computeRewards(await db.getRewardSessions(), { periodStart: current.startedAt, now: new Date('2026-12-02T01:00:00Z') });
  assert.deepEqual(board.mostFrequent.map((e) => [e.name, e.value]), [['Cy', 1]]);

  // Asking again does not issue anything twice.
  await periods.ensureCurrent(new Date('2026-12-02T02:00:00Z'));
  assert.equal(db.certs.length, 2);
});

test('several missed months are closed one by one', async () => {
  const db = memoryDb(NOVEMBER, WHO);
  const periods = createRewardPeriods({ db, offsetMinutes: OFFSET });
  await periods.ensureCurrent(new Date('2026-11-26T07:00:00Z'));
  const current = await periods.ensureCurrent(new Date('2027-02-10T00:00:00Z'));
  assert.equal(db.periods.filter((p) => p.endedAt).length, 3, 'November, December and January are closed');
  assert.equal(db.certs.length, 2, 'only November had visits');
  assert.equal(new Date(current.startedAt).toISOString(), '2027-01-31T16:00:00.000Z'); // Feb 1, 00:00 library time
});

test('faculty can end the period early; the next one starts right then', async () => {
  const db = memoryDb(NOVEMBER, WHO);
  const periods = createRewardPeriods({ db, offsetMinutes: OFFSET });
  const now = new Date('2026-11-20T04:00:00Z');
  await periods.ensureCurrent(now);

  const result = await periods.endNow(now, 'FAC-2024-0001');
  assert.equal(result.ended, true);
  assert.equal(result.certificateCount, 2);
  assert.equal(db.periods[0].endReason, 'manual');
  assert.equal(db.periods[0].endedBy, 'FAC-2024-0001');
  assert.equal(new Date(result.current.startedAt).toISOString(), now.toISOString());
  assert.equal(result.current.closesAt.toISOString(), '2026-12-20T04:00:00.000Z', 'one calendar month after the new start');

  // The new period is empty, and pressing the button again straight away is refused.
  const board = computeRewards(NOVEMBER, { periodStart: result.current.startedAt, now });
  assert.deepEqual(board.mostFrequent, []);
  const again = await periods.endNow(new Date(now.getTime() + 10_000), 'FAC-2024-0001');
  assert.equal(again.ended, false);
  assert.match(again.message, /only just started/);
});

test('no certificate is issued for an award nobody qualified for', async () => {
  const db = memoryDb([session({ studentId: 3, fullName: 'Cy', startedAt: '2026-11-13T02:00:00Z', endedAt: '2026-11-13T02:10:00Z' })], { 3: { firstName: 'Cy', lastName: 'Lim' } });
  const periods = createRewardPeriods({ db, offsetMinutes: OFFSET });
  const now = new Date('2026-11-20T04:00:00Z');
  await periods.ensureCurrent(now);
  const result = await periods.endNow(now, 'FAC-1');
  assert.equal(result.certificateCount, 1);
  assert.deepEqual(db.certs.map((c) => c.category), ['frequent'], 'a 10 minute session is not enough for Quietest Visitor');

  const empty = memoryDb([]);
  const none = createRewardPeriods({ db: empty, offsetMinutes: OFFSET });
  await none.ensureCurrent(now);
  const ended = await none.endNow(now, 'FAC-1');
  assert.equal(ended.ended, true);
  assert.equal(ended.certificateCount, 0);
});

test('certificates are shaped for the client, with the student name written out', async () => {
  const db = memoryDb(NOVEMBER, WHO);
  const periods = createRewardPeriods({ db, offsetMinutes: OFFSET });
  const now = new Date('2026-11-20T04:00:00Z');
  await periods.ensureCurrent(now);
  await periods.endNow(now, 'FAC-1');

  const { period, certificates, periods: list } = await periods.certificatesFor();
  assert.equal(period.endReason, 'manual');
  assert.equal(list.length, 1);
  assert.deepEqual(certificates.map((c) => [c.number, c.category, c.name, c.value]), [
    ['SHUSH-00001', 'frequent', 'Ana B. Reyes', 3],
    ['SHUSH-00002', 'quietest', 'Ben Cruz', 500],
  ]);
  assert.equal(certificates[0].period.id, period.id);

  const mine = await periods.certificatesOfStudent(2);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].category, 'quietest');
  assert.equal(mine[0].period.endedAt.toISOString(), now.toISOString());
  assert.deepEqual(await periods.certificatesOfStudent(99), []);

  assert.equal(certificateName({ fullName: 'Dela Cruz, Juan M.' }), 'Dela Cruz, Juan M.', 'sample students without name parts keep their stored name');
  assert.equal(toCertificate({ id: 12, category: 'frequent', firstName: 'A', lastName: 'B' }).number, 'SHUSH-00012');
});

test('the quiet streak can be counted from the start of the rewards period', () => {
  const rows = [
    session({ studentId: 1, fullName: 'Ana', sessionId: 1, startedAt: '2026-10-20T02:00:00Z', endedAt: '2026-10-20T02:45:00Z' }),
    session({ studentId: 1, fullName: 'Ana', sessionId: 2, startedAt: '2026-11-05T02:00:00Z', endedAt: '2026-11-05T02:45:00Z' }),
    session({ studentId: 1, fullName: 'Ana', sessionId: 3, startedAt: '2026-11-06T02:00:00Z', endedAt: '2026-11-06T02:45:00Z' }),
  ];
  const base = { periodStart: new Date('2026-10-31T16:00:00Z'), now: new Date('2026-11-26T00:00:00Z') };
  assert.equal(computeRewards(rows, base).quietStreak[0].value, 3, 'all time when no start is given');
  assert.equal(computeRewards(rows, { ...base, streakStart: base.periodStart }).quietStreak[0].value, 2, 'restarts with the period');
});
