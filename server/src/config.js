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

    utcOffsetMinutes: num(env.LIBRARY_UTC_OFFSET_MINUTES, 480),

    deviceApiKey: env.DEVICE_API_KEY || '',

    deviceOfflineAfterMs: num(env.DEVICE_OFFLINE_SECONDS, 120) * 1000,

    db: {
        server: env.DB_SERVER || 'localhost',
        ...(env.DB_PORT ? { port: Number(env.DB_PORT) } : env.DB_INSTANCE ? {} : { port: 1433 }),
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
            serverName: env.DB_SERVER || 'localhost',
            ...(!env.DB_PORT && env.DB_INSTANCE ? { instanceName: env.DB_INSTANCE } : {}),
        },
    },
};