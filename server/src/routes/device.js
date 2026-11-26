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
            let currentThreshold = 70; // Default High
            let currentLow = 50;       // Default Low

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
                await db.run('usp_Device_Reading', [
                    ['DeviceCode', sql.NVarChar(20), deviceCode],
                    ['Level', sql.Int, level],
                    ['ReceivedAt', sql.DateTime2(0), new Date()]
                ]);

                // 3. Get the new threshold from the existing Layout procedure
                const layoutSets = await db.run('usp_Layout_Get');
                const devices = layoutSets[0] || [];

                const myDevice = devices.find(d => d.DeviceCode === deviceCode || d.deviceCode === deviceCode);

                if (myDevice) {
                    const dbThreshold = myDevice.Threshold ?? myDevice.threshold;
                    if (dbThreshold != null) {
                        currentThreshold = dbThreshold;
                    }
                }

                currentLow = currentThreshold - Math.round(currentThreshold * 0.3);
                if (currentLow < 10) currentLow = 10;

                // 4. Save Alert
                if (status === 'ALERT' && !isMaintenance) {
                    await db.run('usp_Alert_Log', [
                        ['DeviceCode', sql.NVarChar(20), deviceCode],
                        ['Level', sql.Int, level],
                        ['AlertedAt', sql.DateTime2(0), new Date()]
                    ]);
                }

            } catch (err) {
                console.error('[device] DB Error:', err.message);
            }

            return res.json({
                success: true,
                maintenance: isMaintenance,
                threshold: currentThreshold,
                low: currentLow
            });
        })
    );

    router.use((err, req, res, next) => {
        console.error('[device]', err);
        return sendDatabaseError(res, err);
    });

    return router;
}