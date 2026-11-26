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

            let isMaintenance = false;

            try {
                // 1. Check Maintenance
                const sets = await db.run('usp_Maintenance_Active', [
                    ['Now', sql.DateTime2(0), new Date()]
                ]);
                const activeMaintenance = sets[0] || [];

                isMaintenance = activeMaintenance.some(m => {
                    const appliesToAll = (m.AllTables === true || m.AllTables === 1);
                    const appliesToMe = m.DeviceCode === deviceCode;
                    return appliesToAll || appliesToMe;
                });

                // 2. Save Reading
                await db.recordDeviceReading({ deviceCode, level, receivedAt: new Date() });

                // 3. Save Alert (Only if NOT in maintenance)
                if (status === 'ALERT' && !isMaintenance) {
                    await db.run('usp_Alert_Log', [
                        ['DeviceCode', sql.NVarChar(20), deviceCode],
                        ['Level', sql.Int, level],
                        ['AlertedAt', sql.DateTime2(0), new Date()]
                    ]);
                    console.log(`[device] Successfully logged ALERT for ${deviceCode}`);
                }

            } catch (err) {
                console.error('[device] DB Error:', err.message);
            }

            // 4. Reply to ESP32 instantly with the maintenance status
            return res.json({
                success: true,
                maintenance: isMaintenance
            });
        })
    );

    router.use((err, req, res, next) => {
        console.error('[device]', err);
        return sendDatabaseError(res, err);
    });

    return router;
}