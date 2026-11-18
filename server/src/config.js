import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../.env') });

const env = process.env;
const isProd = env.NODE_ENV === 'production';

const bool = (value, fallback) =>
    value === undefined || value === '' ? fallback : String(value).toLowerCase() === 'true';

const num = (value, fallback) =>
    value === undefined || value === '' || Number.isNaN(Number(value)) ? fallback : Number(value);

let jwtSecret = env.JWT_SECRET;
if (!jwtSecret) {
    if (isProd) {
        throw new Error('JWT_SECRET must be set when NODE_ENV=production.');
    }
    jwtSecret = crypto.randomBytes(48).toString('hex');
    console.warn(
        '[config] JWT_SECRET is not set - using a temporary one. ' +
        'Everyone will be signed out whenever the server restarts.'
    );
}

export const config = {
    port: Number(env.PORT) || 3001,
    isProd,
    jwtSecret,
    cookieSecure: bool(env.COOKIE_SECURE, false),
    trustProxy: bool(env.TRUST_PROXY, false),
    clientDist: path.resolve(here, '../../client/dist'),

    // The library's clock, used for "today", "this week" and "this month".
    // Times are stored in UTC. 480 = Philippines (UTC+8).
    utcOffsetMinutes: num(env.LIBRARY_UTC_OFFSET_MINUTES, 480),

    // Shared secret the devices send in the x-device-key header. Empty = the device API is switched off.
    deviceApiKey: env.DEVICE_API_KEY || '',

    // A device that has not reported for this long is shown as offline.
    deviceOfflineAfterMs: num(env.DEVICE_OFFLINE_SECONDS, 120) * 1000,

    db: {
        // TCP/IP mode: host + port only. 
        // .split('\\')[0] forcefully removes \SQLEXPRESS if it gets pasted in by mistake.
        server: (env.DB_SERVER || '127.0.0.1').split('\\')[0],
        port: Number(env.DB_PORT) || 1433,
        database: env.DB_DATABASE || 'SHUSH',
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        connectionTimeout: 15000,
        requestTimeout: 15000,
        pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
        options: {
            encrypt: bool(env.DB_ENCRYPT, true),
            trustServerCertificate: bool(env.DB_TRUST_SERVER_CERT, true),
            enableArithAbort: true,
        },
    },
};