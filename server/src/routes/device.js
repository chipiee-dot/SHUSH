// HARDWARE ENTRY POINT. Devices (ESP32 boards, one per table) send their noise readings here.
// The route, the key check and the input checks are done. The reading logic itself is NOT written yet:
// it goes in the stored procedure dbo.usp_Device_Reading (database/SHUSH.sql). Until then this answers 501.
// See HARDWARE-INTEGRATION.md for the full contract.
import crypto from 'node:crypto';
import { Router } from 'express';
import { sendDatabaseError, toInt, wrap } from './helpers.js';

const MAX_DEVICE_CODE = 20;
const MAX_LEVEL = 4095; // ESP32 ADC is 12-bit

// Constant-time comparison so the key cannot be guessed from response times.
function keyMatches(given, expected) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createDeviceRouter(db, config) {
  const router = Router();

  // POST /api/device/readings
  // Header: x-device-key: <DEVICE_API_KEY from server/.env>
  // Body:   { "deviceCode": "SHUSH-T03", "level": 1450 }
  // Reply:  { "message": "...", "threshold": 1600, "status": "QUIET" }  (the device can store the new threshold)
  router.post(
    '/readings',
    wrap(async (req, res) => {
      if (!config.deviceApiKey) {
        return res.status(503).json({ message: 'The device API is off. Set DEVICE_API_KEY in server/.env to turn it on.' });
      }
      if (!keyMatches(req.get('x-device-key'), config.deviceApiKey)) {
        return res.status(401).json({ message: 'Invalid device key.' });
      }

      const deviceCode = String(req.body?.deviceCode ?? '');
      if (!deviceCode || deviceCode.length > MAX_DEVICE_CODE) {
        return res.status(400).json({ message: 'Send a deviceCode of up to 20 characters.' });
      }
      const level = toInt(req.body?.level);
      if (level === null || level > MAX_LEVEL) {
        return res.status(400).json({ message: `level must be a whole number from 0 to ${MAX_LEVEL}.` });
      }

      const result = await db.recordDeviceReading({ deviceCode, level, receivedAt: new Date() });
      if (!result?.success) {
        const message = result?.message ?? 'Could not save the reading.';
        const status = /not implemented/i.test(message) ? 501 : /does not exist/i.test(message) ? 404 : 400;
        return res.status(status).json({ message });
      }
      return res.json({ message: result.message, threshold: result.threshold ?? null, status: result.status ?? null });
    })
  );

  // TODO (hardware/backend team), if needed: add more device routes here, for example
  //   GET  /api/device/config/:deviceCode   (the device asks for its threshold without sending a reading)
  //   POST /api/device/register             (attach a device code to a table)

  router.use((err, req, res, next) => {
    console.error('[device]', err);
    return sendDatabaseError(res, err);
  });

  return router;
}
