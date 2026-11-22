// Working-hours library noise analytics.
//
// Aggregates completed sessions (AvgLevel), hourly rolled-up sensor readings
// (including ambient periods with no active student session), and alerts into
// local working-hour buckets so the dashboard can contrast peak noisiest hours
// against the quietest hours.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const HISTORY_SESSION_RE = /Average level\s+(\d+)\s+over\s+(\d+)\s+min/i;

const DEFAULT_WORKING_HOURS = { startHour: 8, endHour: 17, excludeWeekends: false };
let runtimeWorkingHours = { ...DEFAULT_WORKING_HOURS };

export function getRuntimeWorkingHours() {
  return { ...runtimeWorkingHours };
}

export function setRuntimeWorkingHours(patch = {}) {
  const startHour = Number.isInteger(patch.startHour) ? patch.startHour : runtimeWorkingHours.startHour;
  const endHour = Number.isInteger(patch.endHour) ? patch.endHour : runtimeWorkingHours.endHour;
  const excludeWeekends =
    patch.excludeWeekends !== undefined ? Boolean(patch.excludeWeekends) : runtimeWorkingHours.excludeWeekends;
  runtimeWorkingHours = { startHour, endHour, excludeWeekends };
  return getRuntimeWorkingHours();
}

const toLocal = (date, offsetMinutes) => new Date(date.getTime() + offsetMinutes * MINUTE_MS);

function shortHourLabel(hour) {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
}

function fullHourLabel(hour) {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
}

function slotWindowLabel(hour) {
  return `${fullHourLabel(hour)} \u2013 ${fullHourLabel((hour + 1) % 24)}`;
}

function parseTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWeekendDay(utcDay) {
  return utcDay === 0 || utcDay === 6;
}

function normalizeSessions(rawSessions = [], fallbackNow) {
  const seenIds = new Set();
  const seenFallback = new Set();
  const normalized = [];

  for (const row of rawSessions) {
    if (!row) continue;

    const tableNo = row.tableNo !== undefined && row.tableNo !== null ? Number(row.tableNo) : null;

    if (row.sessionId !== undefined && row.sessionId !== null) {
      if (seenIds.has(row.sessionId)) continue;
      seenIds.add(row.sessionId);

      const avgLevel = Number(row.avgLevel);
      const startedAt = parseTimestamp(row.startedAt);
      const endedAt = parseTimestamp(row.endedAt) ?? fallbackNow;
      if (!startedAt || !Number.isFinite(avgLevel) || avgLevel <= 0) continue;

      normalized.push({
        tableNo: Number.isFinite(tableNo) ? tableNo : null,
        startedAt,
        endedAt: endedAt < startedAt ? startedAt : endedAt,
        avgLevel,
        isSample: Boolean(row.isSample),
      });
      continue;
    }

    // Fallback support for session rows coming from usp_History_Get.
    if (row.kind === 'session' || typeof row.detail === 'string') {
      const match = HISTORY_SESSION_RE.exec(String(row.detail ?? ''));
      const startedAt = parseTimestamp(row.startedAt ?? row.occurredAt);
      if (!match || !startedAt) continue;

      const avgLevel = Number(match[1]);
      const durationMinutes = Number(match[2]);
      if (!Number.isFinite(avgLevel) || avgLevel <= 0 || !Number.isFinite(durationMinutes)) continue;

      const key = `${startedAt.getTime()}|${row.tableNo ?? ''}|${avgLevel}|${durationMinutes}`;
      if (seenFallback.has(key)) continue;
      seenFallback.add(key);

      normalized.push({
        tableNo: Number.isFinite(tableNo) ? tableNo : null,
        startedAt,
        endedAt: new Date(startedAt.getTime() + Math.max(0, durationMinutes) * MINUTE_MS),
        avgLevel,
        isSample: Boolean(row.isSample),
      });
    }
  }

  return normalized;
}

export function computeWorkingHoursAnalytics(
  { sessions = [], alerts = [], hourlyReadings = [] } = {},
  {
    periodStart,
    now = new Date(),
    offsetMinutes = 480,
    workStartHour = 8,
    workEndHour = 17,
    excludeWeekends = false,
    tableNo = null,
  } = {}
) {
  const nowDate = parseTimestamp(now) ?? new Date();
  const startDate = parseTimestamp(periodStart) ?? new Date(0);
  const startMs = startDate.getTime();
  const nowMs = nowDate.getTime();
  const targetTable =
    tableNo !== null && tableNo !== undefined && Number.isFinite(Number(tableNo))
      ? Number(tableNo)
      : null;

  const bucketsByHour = new Map();
  const buckets = [];
  for (let hour = workStartHour; hour <= workEndHour; hour += 1) {
    const bucket = {
      hour,
      label: shortHourLabel(hour),
      slotLabel: slotWindowLabel(hour),
      levelSum: 0,
      levelSamples: 0,
      avgLevel: 0,
      alertCount: 0,
      sessionCount: 0,
      readingCount: 0,
    };
    buckets.push(bucket);
    bucketsByHour.set(hour, bucket);
  }

  let totalSessions = 0;
  let hasSampleData = false;

  const cleanSessions = normalizeSessions(sessions, nowDate);
  for (const session of cleanSessions) {
    if (targetTable !== null && session.tableNo !== targetTable) continue;

    const rawStartMs = session.startedAt.getTime();
    const rawEndMs = session.endedAt.getTime();
    if (rawEndMs < startMs || rawStartMs > nowMs) continue;

    const clampedStartMs = Math.max(rawStartMs, startMs);
    const clampedEndMs = Math.min(rawEndMs, nowMs);
    if (clampedEndMs < clampedStartMs) continue;

    const localStartMs = clampedStartMs + offsetMinutes * MINUTE_MS;
    const localEndMs = clampedEndMs + offsetMinutes * MINUTE_MS;
    const startBlock = Math.floor(localStartMs / HOUR_MS) * HOUR_MS;
    const endBlock =
      localEndMs > localStartMs
        ? Math.floor((localEndMs - 1) / HOUR_MS) * HOUR_MS
        : startBlock;

    let overlappedWorkingHour = false;
    for (let block = startBlock; block <= endBlock; block += HOUR_MS) {
      const localBlock = new Date(block);
      if (excludeWeekends && isWeekendDay(localBlock.getUTCDay())) continue;

      const hour = localBlock.getUTCHours();
      const bucket = bucketsByHour.get(hour);
      if (!bucket) continue;

      bucket.levelSum += session.avgLevel;
      bucket.levelSamples += 1;
      bucket.sessionCount += 1;
      overlappedWorkingHour = true;
    }

    if (overlappedWorkingHour) {
      totalSessions += 1;
      if (session.isSample) hasSampleData = true;
    }
  }

  for (const reading of hourlyReadings) {
    if (!reading) continue;
    const rTable = reading.tableNo !== undefined && reading.tableNo !== null ? Number(reading.tableNo) : null;
    if (targetTable !== null && rTable !== targetTable) continue;

    const hourAt = parseTimestamp(reading.hourUtc ?? reading.occurredAt);
    if (!hourAt) continue;
    const hourMs = hourAt.getTime();
    if (hourMs < startMs || hourMs > nowMs) continue;

    const localHour = toLocal(hourAt, offsetMinutes);
    if (excludeWeekends && isWeekendDay(localHour.getUTCDay())) continue;

    const bucket = bucketsByHour.get(localHour.getUTCHours());
    if (!bucket) continue;

    const avgLevel = Number(reading.avgLevel);
    if (!Number.isFinite(avgLevel) || avgLevel < 0) continue;

    const count = Math.max(1, Number(reading.readingCount) || 1);
    bucket.levelSum += avgLevel;
    bucket.levelSamples += 1;
    bucket.readingCount += count;
    if (reading.isSample) hasSampleData = true;
  }

  for (const alert of alerts) {
    if (!alert) continue;
    const aTable = alert.tableNo !== undefined && alert.tableNo !== null ? Number(alert.tableNo) : null;
    if (targetTable !== null && aTable !== targetTable) continue;

    const at = parseTimestamp(alert.triggeredAt ?? alert.occurredAt);
    if (!at) continue;
    const atMs = at.getTime();
    if (atMs < startMs || atMs > nowMs) continue;

    const localAlert = toLocal(at, offsetMinutes);
    if (excludeWeekends && isWeekendDay(localAlert.getUTCDay())) continue;

    const hour = localAlert.getUTCHours();
    const bucket = bucketsByHour.get(hour);
    if (!bucket) continue;

    bucket.alertCount += 1;
    if (alert.isSample) hasSampleData = true;
  }

  const hours = buckets.map((b) => ({
    hour: b.hour,
    label: b.label,
    slotLabel: b.slotLabel,
    avgLevel: b.levelSamples > 0 ? Math.round(b.levelSum / b.levelSamples) : 0,
    alertCount: b.alertCount,
    sessionCount: b.sessionCount,
    readingCount: b.readingCount,
  }));

  const activeBuckets = hours.filter((b) => b.sessionCount > 0 || b.readingCount > 0 || b.alertCount > 0);
  const scoredBuckets = hours.filter((b) => b.sessionCount > 0 || b.readingCount > 0);

  let peakHour = null;
  if (activeBuckets.length > 0) {
    peakHour = [...activeBuckets].sort(
      (a, b) =>
        b.avgLevel - a.avgLevel ||
        b.alertCount - a.alertCount ||
        b.sessionCount - a.sessionCount ||
        b.readingCount - a.readingCount ||
        a.hour - b.hour
    )[0];
  }

  let quietestHour = null;
  if (peakHour) {
    const quietPool = (scoredBuckets.length > 0 ? scoredBuckets : activeBuckets).filter(
      (b) => b.hour !== peakHour.hour
    );
    if (quietPool.length > 0) {
      quietestHour = [...quietPool].sort(
        (a, b) =>
          a.avgLevel - b.avgLevel ||
          a.alertCount - b.alertCount ||
          a.hour - b.hour
      )[0];
    }
  }

  const overallAvgLevel =
    scoredBuckets.length > 0
      ? Math.round(scoredBuckets.reduce((sum, b) => sum + b.avgLevel, 0) / scoredBuckets.length)
      : 0;
  const totalAlerts = hours.reduce((sum, b) => sum + b.alertCount, 0);
  const totalReadings = hours.reduce((sum, b) => sum + b.readingCount, 0);

  const contrast =
    peakHour && quietestHour
      ? {
          levelDelta: Math.max(0, peakHour.avgLevel - quietestHour.avgLevel),
          quietPct:
            peakHour.avgLevel > 0
              ? Math.round(((peakHour.avgLevel - quietestHour.avgLevel) / peakHour.avgLevel) * 100)
              : 0,
          alertDelta: peakHour.alertCount - quietestHour.alertCount,
        }
      : null;

  return {
    workHours: { start: workStartHour, end: workEndHour, excludeWeekends: Boolean(excludeWeekends) },
    tableNo: targetTable,
    hours,
    peakHour,
    quietestHour,
    overallAvgLevel,
    totalAlerts,
    totalSessions,
    totalReadings,
    contrast,
    hasSampleData,
  };
}
