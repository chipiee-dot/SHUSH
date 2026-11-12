import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { buildLayout } from '../services/tableStatus.js';
import { MAX_SESSION_HOURS } from '../services/limits.js';
import { computeRewards } from '../services/rewards.js';
import {
  addDays,
  parseLocalDate,
  startOfLocalDay,
  startOfLocalMonth,
  startOfLocalWeek,
} from '../services/time.js';
import { sendDatabaseError, toInt, wrap } from './helpers.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ALERT_LOOKBACK_MS = DAY;
const ALERT_TILES = 10; // alerts shown on the dashboard
const NOTIFICATION_ALERTS = 20;
const ENDING_SOON_MS = 30 * 60 * 1000;

const MIN_MAINTENANCE_MINUTES = 5;
const MAX_MAINTENANCE_MINUTES = 12 * 60;
const REASON_MIN = 3;
const REASON_MAX = 200;

const HISTORY_KINDS = ['alert', 'maintenance', 'session'];
const HISTORY_DEFAULT_DAYS = 7;
const HISTORY_MAX_DAYS = 366;
const HISTORY_ROWS = 500;

const REWARD_PERIODS = {
  week: startOfLocalWeek,
  month: startOfLocalMonth,
};
const REWARD_MIN_SESSION_MINUTES = 30;

export function createFacultyRouter(db, config) {
  const router = Router();
  const auth = requireAuth(config);
  const offset = config.utcOffsetMinutes;
  const offlineAfterMs = config.deviceOfflineAfterMs;

  async function loadLayout(now) {
    await db.closeStaleSessions(now, MAX_SESSION_HOURS);
    const [rows, windows] = await Promise.all([db.getLayout(), db.getActiveMaintenance(now)]);
    return {
      tables: buildLayout(rows, windows, { now, offlineAfterMs }),
      maintenance: windows,
      sample: rows.some((row) => row.isSample),
    };
  }

  // ---- Dashboard ------------------------------------------------------------
  router.get(
    '/dashboard',
    auth,
    wrap(async (req, res) => {
      const now = new Date();
      const dayStart = startOfLocalDay(now, offset);
      const [layout, counts, alerts] = await Promise.all([
        loadLayout(now),
        db.getDashboardSummary(dayStart),
        db.getRecentAlerts(new Date(now.getTime() - ALERT_LOOKBACK_MS), ALERT_TILES),
      ]);

      const devices = layout.tables.filter((table) => table.device);
      res.json({
        generatedAt: now,
        sample: layout.sample,
        summary: {
          tablesTotal: layout.tables.length,
          tablesOccupied: layout.tables.filter((t) => t.occupancy.groupSize > 0).length,
          activeAlerts: layout.tables.filter((t) => t.status === 'ALERT').length,
          devicesTotal: devices.length,
          devicesOnline: devices.filter((t) => t.device.online).length,
          sessionsToday: counts?.sessionsToday ?? 0,
          studentsToday: counts?.studentsToday ?? 0,
          alertsToday: counts?.alertsToday ?? 0,
        },
        devices,
        alerts,
        maintenance: layout.maintenance,
      });
    })
  );

  // ---- Table layout ---------------------------------------------------------
  router.get(
    '/layout',
    auth,
    wrap(async (req, res) => {
      const now = new Date();
      const layout = await loadLayout(now);
      res.json({ generatedAt: now, ...layout });
    })
  );

  // ---- Maintenance mode -----------------------------------------------------
  router.get(
    '/maintenance',
    auth,
    wrap(async (req, res) => {
      res.json({ maintenance: await db.getActiveMaintenance(new Date()) });
    })
  );

  router.post(
    '/maintenance',
    auth,
    wrap(async (req, res) => {
      const body = req.body ?? {};
      const now = new Date();

      // "all" or a missing value means every table.
      let tableNo = null;
      if (body.tableNo !== undefined && body.tableNo !== null && body.tableNo !== 'all') {
        tableNo = toInt(body.tableNo);
        if (tableNo === null || tableNo < 1) {
          return res.status(400).json({ message: 'Choose a table or All tables.' });
        }
      }

      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
        return res
          .status(400)
          .json({ message: `Enter a reason between ${REASON_MIN} and ${REASON_MAX} characters.` });
      }

      const minutes = toInt(body.durationMinutes);
      if (minutes === null || minutes < MIN_MAINTENANCE_MINUTES || minutes > MAX_MAINTENANCE_MINUTES) {
        return res.status(400).json({ message: 'Duration must be between 5 minutes and 12 hours.' });
      }

      const result = await db.startMaintenance({
        tableNo,
        reason,
        startsAt: now,
        endsAt: new Date(now.getTime() + minutes * 60 * 1000),
        createdBy: req.user.facultyId,
      });
      if (!result?.success) {
        return res.status(400).json({ message: result?.message ?? 'Could not start maintenance.' });
      }
      return res.status(201).json({ message: result.message, id: result.id });
    })
  );

  router.post(
    '/maintenance/:id/end',
    auth,
    wrap(async (req, res) => {
      const id = toInt(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: 'Invalid maintenance period.' });
      }
      const result = await db.endMaintenance({ id, now: new Date() });
      if (!result?.success) {
        return res.status(404).json({ message: result?.message ?? 'That maintenance period is not active.' });
      }
      return res.json({ message: result.message });
    })
  );

  // ---- Notifications (top bar bell) -----------------------------------------
  router.get(
    '/notifications',
    auth,
    wrap(async (req, res) => {
      const now = new Date();
      const [alerts, windows] = await Promise.all([
        db.getRecentAlerts(new Date(now.getTime() - ALERT_LOOKBACK_MS), NOTIFICATION_ALERTS),
        db.getActiveMaintenance(now),
      ]);
      const maintenanceEnding = windows.filter(
        (w) => new Date(w.endsAt).getTime() - now.getTime() <= ENDING_SOON_MS
      );
      res.json({ alerts, maintenanceEnding });
    })
  );

  // ---- Rewards ---------------------------------------------------------------
  router.get(
    '/rewards',
    auth,
    wrap(async (req, res) => {
      const period = req.query.period === 'week' ? 'week' : 'month';
      const now = new Date();
      const periodStart = REWARD_PERIODS[period](now, offset);
      const rows = await db.getRewardSessions();
      res.json({
        period,
        periodStart,
        ...computeRewards(rows, {
          periodStart,
          now,
          minSessionMinutes: REWARD_MIN_SESSION_MINUTES,
        }),
      });
    })
  );

  // ---- History (reports) -----------------------------------------------------
  router.get(
    '/history',
    auth,
    wrap(async (req, res) => {
      const now = new Date();
      const kind = req.query.kind === undefined || req.query.kind === 'all' ? null : req.query.kind;
      if (kind !== null && !HISTORY_KINDS.includes(kind)) {
        return res.status(400).json({ message: 'Unknown history type.' });
      }

      let tableNo = null;
      if (req.query.tableNo !== undefined && req.query.tableNo !== '' && req.query.tableNo !== 'all') {
        tableNo = toInt(req.query.tableNo);
        if (tableNo === null) {
          return res.status(400).json({ message: 'Choose a table or All tables.' });
        }
      }

      const today = startOfLocalDay(now, offset);
      const from = req.query.from
        ? parseLocalDate(req.query.from, offset)
        : addDays(today, -(HISTORY_DEFAULT_DAYS - 1));
      const toParsed = req.query.to ? parseLocalDate(req.query.to, offset) : today;
      if (!from || !toParsed) {
        return res.status(400).json({ message: 'Dates must look like YYYY-MM-DD.' });
      }
      const to = addDays(toParsed, 1); // the end date is included
      if (to <= from) {
        return res.status(400).json({ message: 'The end date must be on or after the start date.' });
      }
      if (to - from > HISTORY_MAX_DAYS * DAY) {
        return res.status(400).json({ message: 'Choose a range of one year or less.' });
      }

      const rows = await db.getHistory({ from, to, kind, tableNo, top: HISTORY_ROWS });
      return res.json({ rows, truncated: rows.length >= HISTORY_ROWS, from, to });
    })
  );

  // Errors from the procedures end up in the app's error handler; keep DB-down as 503.
  router.use((err, req, res, next) => {
    console.error('[faculty]', err);
    return sendDatabaseError(res, err);
  });

  return router;
}
