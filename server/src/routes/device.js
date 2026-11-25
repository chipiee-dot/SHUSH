import crypto from 'node:crypto';
import { Router } from 'express';
import { sendDatabaseError, toInt, wrap } from './helpers.js';
import sql from 'mssql';

const MAX_DEVICE_CODE = 20;
const MAX_LEVEL = 4095;

function keyMatches(given, expected) {
    const a = Buffer.from(String(given ?? ''));
    const b = Buffer.from(String(expected));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createDeviceRouter(db, config) {
    const router = Router();

    router.post(
        '/readings',
        wrap(async (req, res) => {
            if (!config.deviceApiKey) return res.status(503).json({ message: 'API off.' });
            if (!keyMatches(req.get('x-device-key'), config.deviceApiKey)) return res.status(401).json({ message: 'Invalid key.' });

            const deviceCode = String(req.body?.deviceCode ?? '');
            const level = toInt(req.body?.level);
            const status = String(req.body?.status ?? 'QUIET');

            // 1. REPLY TO ESP32 IMMEDIATELY (This fixes the lag!)
            res.json({ success: true });

            // 2. DO THE DATABASE WORK IN THE BACKGROUND
            (async () => {
                try {
                    await db.recordDeviceReading({ deviceCode, level, receivedAt: new Date() });

                    if (status === 'ALERT') {
                        await db.run('usp_Alert_Log', [
                            ['DeviceCode', sql.NVarChar(20), deviceCode],
                            ['Level', sql.Int, level],
                            ['AlertedAt', sql.DateTime2(0), new Date()]
                        ]);
                        console.log(`[device] Successfully logged ALERT for ${deviceCode} at level ${level}`);
                    }
                } catch (err) {
                    console.error('[device] Background DB Error:', err.message);
                }
            })();
        })
    );

    router.use((err, req, res, next) => {
        console.error('[device]', err);
        return sendDatabaseError(res, err);
    });

    return router;
}