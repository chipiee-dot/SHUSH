// Rewards periods and certificates.
//
// A period is the stretch of time the leaderboards count. It ends when faculty end it by hand or by itself one
// calendar month after it started. Ending a period issues a certificate to the #1 Most Frequent Visitor and the #1
// Quietest Visitor of that period, then the next period starts at that same moment (counts restart at zero).
//
// There is no background job: a period that is overdue is closed the next time someone asks for rewards or
// certificates (faculty rewards page, or a student opening their page). The certificates are still dated to the
// moment the period was due, not to the moment someone happened to look.

import { computeRewards } from './rewards.js';
import { startOfLocalMonth } from './time.js';

export const REWARD_MIN_SESSION_MINUTES = 30;
export const AUTO_CLOSE_MONTHS = 1;

const MAX_CATCH_UP = 24; // a period is never closed more than this many times in one request
const MIN_MANUAL_MS = 60 * 1000; // a period that just started cannot be ended again straight away
const MINUTE = 60 * 1000;

export const CERTIFICATE_CATEGORIES = ['frequent', 'quietest'];

const wholeSeconds = (date) => new Date(Math.floor(date.getTime() / 1000) * 1000);

/** Adds calendar months in library time. Jan 31 + 1 month is Feb 28/29, not March 3. */
export function addLocalMonths(date, months, offsetMinutes) {
  const local = new Date(date.getTime() + offsetMinutes * MINUTE);
  const day = local.getUTCDate();
  const target = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + months, 1,
    local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return new Date(target.getTime() - offsetMinutes * MINUTE);
}

/** "Mark Rafael Guades" from the student's parts; falls back to the stored full name. */
export function certificateName(row) {
  if (row.firstName && row.lastName) {
    const middle = row.middleInitial ? ` ${row.middleInitial}.` : '';
    return `${row.firstName}${middle} ${row.lastName}`;
  }
  return row.fullName ?? '';
}

const certificateNumber = (id) => `SHUSH-${String(id).padStart(5, '0')}`;

function periodInfo(row) {
  if (!row) return null;
  return {
    id: row.periodId ?? row.id,
    startedAt: row.periodStartedAt ?? row.startedAt,
    endedAt: row.periodEndedAt ?? row.endedAt,
    endReason: row.periodEndReason ?? row.endReason ?? null,
  };
}

/** The shape the client uses (faculty list and student list). */
export function toCertificate(row, period = null) {
  return {
    id: row.id,
    number: certificateNumber(row.id),
    category: row.category,
    studentId: row.studentId,
    studentNo: row.studentNo,
    name: certificateName(row),
    section: row.section ?? null,
    value: row.value,
    sessionCount: row.sessionCount,
    issuedAt: row.issuedAt,
    period: periodInfo(period ?? row),
  };
}

export function createRewardPeriods({ db, offsetMinutes, minSessionMinutes = REWARD_MIN_SESSION_MINUTES }) {
  const withCloseDate = (row) => ({
    id: row.id,
    startedAt: row.startedAt,
    closesAt: addLocalMonths(new Date(row.startedAt), AUTO_CLOSE_MONTHS, offsetMinutes),
  });

  /** The #1 of each award for sessions that started in [start, end). */
  async function winnersFor(start, end, rows) {
    const sessions = rows ?? (await db.getRewardSessions());
    const board = computeRewards(sessions, {
      periodStart: start,
      now: new Date(end.getTime() - 1),
      minSessionMinutes,
      top: 1,
    });
    const winners = [];
    if (board.mostFrequent[0]) {
      const w = board.mostFrequent[0];
      winners.push({ category: 'frequent', studentId: w.studentId, value: w.value, sessionCount: w.sessionCount });
    }
    if (board.quietest[0]) {
      const w = board.quietest[0];
      winners.push({ category: 'quietest', studentId: w.studentId, value: w.value, sessionCount: w.sessionCount });
    }
    return winners;
  }

  const readCurrent = (now) => db.getCurrentRewardPeriod({ now, defaultStart: startOfLocalMonth(now, offsetMinutes) });

  /**
   * Returns the current period ({ id, startedAt, closesAt }) after closing any period that is overdue
   * (one calendar month old), issuing its certificates on the way.
   */
  async function ensureCurrent(now = new Date()) {
    let current = await readCurrent(now);
    let rows = null;
    for (let i = 0; i < MAX_CATCH_UP; i += 1) {
      const dueAt = addLocalMonths(new Date(current.startedAt), AUTO_CLOSE_MONTHS, offsetMinutes);
      if (dueAt > now) break;
      rows = rows ?? (await db.getRewardSessions());
      const endedAt = wholeSeconds(dueAt);
      const certificates = await winnersFor(new Date(current.startedAt), endedAt, rows);
      // If someone else closed it first, the result says so and we simply read the new current period.
      await db.closeRewardPeriod({ periodId: current.id, endedAt, reason: 'auto', endedBy: null, certificates });
      current = await readCurrent(now);
    }
    return withCloseDate(current);
  }

  /**
   * Faculty end the period now. Returns { ended: true, closedPeriodId, current } or
   * { ended: false, message } when it cannot be ended (it only just started).
   */
  async function endNow(now, facultyId) {
    const current = await ensureCurrent(now);
    if (now.getTime() - new Date(current.startedAt).getTime() < MIN_MANUAL_MS) {
      return { ended: false, message: 'The rewards period only just started, so there is nothing to end yet.' };
    }
    const endedAt = wholeSeconds(now);
    const certificates = await winnersFor(new Date(current.startedAt), endedAt);
    const result = await db.closeRewardPeriod({
      periodId: current.id,
      endedAt,
      reason: 'manual',
      endedBy: facultyId ?? null,
      certificates,
    });
    if (!result?.success) return { ended: false, message: result?.message ?? 'Could not end the rewards period.' };
    return {
      ended: true,
      closedPeriodId: current.id,
      certificateCount: result.certificateCount ?? certificates.length,
      current: withCloseDate(await readCurrent(now)),
    };
  }

  /** Certificates of one closed period (default: the latest) plus the list of closed periods. */
  async function certificatesFor(periodId = null) {
    const [{ period, certificates }, periods] = await Promise.all([
      db.getCertificates(periodId),
      db.listRewardPeriods(),
    ]);
    return {
      period: periodInfo(period),
      certificates: certificates.map((row) => toCertificate(row, period)),
      periods: periods.map((p) => ({
        id: p.id,
        startedAt: p.startedAt,
        endedAt: p.endedAt,
        endReason: p.endReason,
        certificateCount: p.certificateCount,
      })),
    };
  }

  /** One student's own certificates, newest first. */
  async function certificatesOfStudent(studentId) {
    const rows = await db.getStudentCertificates(studentId);
    return rows.map((row) => toCertificate(row));
  }

  return { ensureCurrent, endNow, certificatesFor, certificatesOfStudent };
}
