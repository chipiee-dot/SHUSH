import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { sendDatabaseError, toInt, wrap } from './helpers.js';
import { findFreeSpot } from '../services/tablePlacement.js';

const MAX_THRESHOLD = 4095; // ESP32 ADC is 12-bit
const MAX_DEVICE_CODE = 20;

// Device settings are for administrators only. The server checks this on every request.
export function createSettingsRouter(db, config) {
  const router = Router();
  const adminOnly = [requireAuth(config), requireRole('Admin')];

  router.get(
    '/devices',
    adminOnly,
    wrap(async (req, res) => {
      const rows = await db.getLayout();
      const devices = rows
        .filter((row) => row.deviceCode)
        .map((row) => ({
          tableNo: row.tableNo,
          deviceCode: row.deviceCode,
          threshold: row.threshold,
          lastLevel: row.lastLevel ?? null,
          lastSeenAt: row.lastSeenAt ?? null,
          isSample: Boolean(row.isSample),
        }));
      res.json({ devices, thresholdRange: [0, MAX_THRESHOLD] });
    })
  );

  router.put(
    '/devices/:deviceCode',
    adminOnly,
    wrap(async (req, res) => {
      const deviceCode = String(req.params.deviceCode ?? '');
      if (!deviceCode || deviceCode.length > MAX_DEVICE_CODE) {
        return res.status(400).json({ message: 'Unknown device.' });
      }
      const threshold = toInt(req.body?.threshold);
      if (threshold === null || threshold > MAX_THRESHOLD) {
        return res
          .status(400)
          .json({ message: `Threshold must be a whole number from 0 to ${MAX_THRESHOLD}.` });
      }

      const result = await db.setDeviceThreshold({ deviceCode, threshold });
      if (!result?.success) {
        const notFound = /does not exist/i.test(result?.message ?? '');
        return res.status(notFound ? 404 : 400).json({ message: result?.message ?? 'Could not save.' });
      }
      return res.json({ message: result.message });
    })
  );

  // ---- Tables: list, add, change seats ------------------------------------

  router.get(
    '/tables',
    adminOnly,
    wrap(async (req, res) => {
      const rows = await db.getLayout();
      res.json({
        tables: rows.map((row) => ({
          tableNo: row.tableNo,
          seats: row.seatCount,
          occupied: row.occupied ?? 0,
          grid: { col: row.gridCol, row: row.gridRow, width: row.gridWidth, height: row.gridHeight },
          hasDevice: Boolean(row.deviceCode),
          isSample: Boolean(row.tableIsSample),
        })),
      });
    })
  );

  // Add a table. Give a column and row to place it, or leave both empty to place it automatically.
  router.post(
    '/tables',
    adminOnly,
    wrap(async (req, res) => {
      const body = req.body ?? {};
      const tableNo = toInt(body.tableNo);
      if (tableNo === null || tableNo < 1 || tableNo > 999) {
        return res.status(400).json({ message: 'Table number must be between 1 and 999.' });
      }
      const seatCount = toInt(body.seats);
      if (seatCount === null || seatCount < 1 || seatCount > 20) {
        return res.status(400).json({ message: 'Seats must be between 1 and 20.' });
      }

      const hasCol = body.col !== undefined && body.col !== null && body.col !== '';
      const hasRow = body.row !== undefined && body.row !== null && body.row !== '';
      let spot;
      if (hasCol || hasRow) {
        const col = toInt(body.col);
        const row = toInt(body.row);
        if (!hasCol || !hasRow) {
          return res.status(400).json({ message: 'Enter both column and row, or leave both empty.' });
        }
        if (col === null || row === null) {
          return res.status(400).json({ message: 'Column and row must be whole numbers.' });
        }
        spot = { col, row, width: 2, height: 2 };
      } else {
        const rows = await db.getLayout();
        spot = findFreeSpot(rows.map((r) => ({ grid: { col: r.gridCol, row: r.gridRow, width: r.gridWidth, height: r.gridHeight } })));
        if (!spot) {
          return res.status(409).json({ message: 'There is no free space on the floor plan.' });
        }
      }

      const result = await db.addTable({
        tableNo,
        seatCount,
        gridCol: spot.col,
        gridRow: spot.row,
        gridWidth: spot.width,
        gridHeight: spot.height,
      });
      if (!result?.success) {
        return res.status(400).json({ message: result?.message ?? 'Could not add the table.' });
      }
      return res.status(201).json({ message: result.message, tableNo });
    })
  );

  router.put(
    '/tables/:tableNo',
    adminOnly,
    wrap(async (req, res) => {
      const tableNo = toInt(req.params.tableNo);
      const seatCount = toInt(req.body?.seats);
      if (tableNo === null) return res.status(400).json({ message: 'Unknown table.' });
      if (seatCount === null || seatCount < 1 || seatCount > 20) {
        return res.status(400).json({ message: 'Seats must be between 1 and 20.' });
      }
      const result = await db.setTableSeats({ tableNo, seatCount });
      if (!result?.success) {
        const notFound = /does not exist/i.test(result?.message ?? '');
        return res.status(notFound ? 404 : 400).json({ message: result?.message ?? 'Could not save.' });
      }
      return res.json({ message: result.message });
    })
  );

  // Removes everything marked as sample data. Real records are kept.
  router.post(
    '/sample-data/clear',
    adminOnly,
    wrap(async (req, res) => {
      const result = await db.clearSampleData();
      if (!result?.success) return res.status(400).json({ message: result?.message ?? 'Could not remove sample data.' });
      return res.json({ message: result.message });
    })
  );

  router.use((err, req, res, next) => {
    console.error('[settings]', err);
    return sendDatabaseError(res, err);
  });

  return router;
}
