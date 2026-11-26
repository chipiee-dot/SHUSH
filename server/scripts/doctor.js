// `npm run doctor` : checks everything a teammate needs before `npm run dev`, and says what to fix.
// Uses only Node built-ins until it has confirmed the packages are installed.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverDir = path.join(root, 'server');
const clientDir = path.join(root, 'client');
let failures = 0;

const ok = (msg) => console.log(`  OK    ${msg}`);
const warn = (msg) => console.log(`  WARN  ${msg}`);
const fail = (msg, fix) => {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
  if (fix) console.log(`        -> ${fix}`);
};

console.log('\nSHUSH doctor\n');

// 1) Node version
const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 18 || (major === 18 && minor >= 11)) ok(`Node ${process.version}`);
else fail(`Node ${process.version} is too old`, 'Install the current LTS from https://nodejs.org (18.11 or newer).');

// 2) Packages
for (const [name, dir, probe] of [['root', root, 'concurrently'], ['server', serverDir, 'express'], ['client', clientDir, 'vite']]) {
  if (fs.existsSync(path.join(dir, 'node_modules', probe))) ok(`${name} packages installed`);
  else fail(`${name} packages are missing`, 'Run: npm install   (from the project folder; it installs all three).');
}

// 3) server/.env
const envFile = path.join(serverDir, '.env');
let dotenv = null;
let sql = null;
try {
  const requireFromServer = createRequire(path.join(serverDir, 'package.json'));
  dotenv = requireFromServer('dotenv');
  sql = requireFromServer('mssql');
} catch {
  // Packages missing: already reported above.
}
if (!fs.existsSync(envFile)) {
  fail('server/.env does not exist', 'Copy server/.env.example to server/.env, then set DB_PASSWORD (and JWT_SECRET).');
} else if (dotenv) {
  const env = dotenv.parse(fs.readFileSync(envFile));
  ok('server/.env found');
  for (const key of ['DB_USER', 'DB_PASSWORD', 'DB_DATABASE']) {
    if (!env[key]) fail(`${key} is empty in server/.env`, 'Fill it in. DB_USER and DB_PASSWORD must match database/create_app_login.sql.');
  }
  if (env.DB_PORT && env.DB_INSTANCE) warn('Both DB_PORT and DB_INSTANCE are set. DB_PORT wins; leave DB_INSTANCE empty to avoid confusion.');
  if (!env.DB_PORT && !env.DB_INSTANCE) warn('Neither DB_PORT nor DB_INSTANCE is set; the default port 1433 is used.');
  if (!env.JWT_SECRET) warn('JWT_SECRET is empty: everyone is signed out whenever the server restarts. Generate one: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');

  // 4) Database
  if (sql && env.DB_USER && env.DB_PASSWORD) {
    const { explainDbError } = await import('../src/services/dbHints.js');
    const bool = (v, d) => (v === undefined || v === '' ? d : String(v).toLowerCase() === 'true');
    const dbConfig = {
      server: env.DB_SERVER || 'localhost',
      ...(env.DB_PORT ? { port: Number(env.DB_PORT) } : env.DB_INSTANCE ? {} : { port: 1433 }),
      database: env.DB_DATABASE || 'SHUSH',
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      connectionTimeout: 8000,
      options: {
        encrypt: bool(env.DB_ENCRYPT, true),
        trustServerCertificate: bool(env.DB_TRUST_SERVER_CERT, true),
        serverName: env.DB_SERVER || 'localhost',
        ...(!env.DB_PORT && env.DB_INSTANCE ? { instanceName: env.DB_INSTANCE } : {}),
      },
    };
    let pool;
    try {
      pool = await new sql.ConnectionPool(dbConfig).connect();
      ok(`connected to SQL Server database "${dbConfig.database}" as ${dbConfig.user}`);
      try {
        const res = await pool.request().execute('dbo.usp_Schema_Version');
        const version = res.recordset?.[0]?.SchemaVersion;
        const expected = 4;
        if (version === expected) ok(`database version ${version} is up to date`);
        else fail(`database version is ${version ?? 'unknown'}, expected ${expected}`, 'In SSMS run database/SHUSH.sql and then database/create_app_login.sql again.');
      } catch (err) {
        fail(`database check failed: ${err.message}`, explainDbError(err, dbConfig));
      }
    } catch (err) {
      fail(`cannot connect to SQL Server: ${err.message}`, explainDbError(err, dbConfig));
    } finally {
      await pool?.close().catch(() => {});
    }
  }

  // 5) Port
  const port = Number(env.PORT) || 3001;
  await new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => {
      warn(`port ${port} is in use. If SHUSH is not already running, close the other program or change PORT in server/.env.`);
      resolve();
    });
    probe.once('listening', () => probe.close(() => { ok(`port ${port} is free`); resolve(); }));
    probe.listen(port);
  });
}

console.log(failures ? `\n${failures} problem(s) found. Fix the FAIL lines above, then run: npm run doctor\n` : '\nAll good. Start the app with: npm run dev\n');
process.exit(failures ? 1 : 0);
