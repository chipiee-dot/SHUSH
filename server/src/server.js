import { config, envProblems } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';
import { explainDbError } from './services/dbHints.js';

// The server needs Node 18.11+ (node --watch, node --test, the fetch API). Older versions fail with confusing errors.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 18 || (major === 18 && minor < 11)) {
    console.error(`SHUSH needs Node.js 18.11 or newer. You are running ${process.version}. Install the current LTS from https://nodejs.org and try again.`);
    process.exit(1);
}

// Expected by this version of the code. Bump it together with usp_Schema_Version in database/SHUSH.sql.
const EXPECTED_SCHEMA_VERSION = 4;

for (const problem of envProblems) console.warn(`[setup] ${problem}`);

const db = createDb(config.db);
const app = createApp({ db, config });


const server = app.listen(config.port, () => {
    console.log(`SHUSH server listening on http://localhost:${config.port}`);
    checkDatabase();
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${config.port} is already in use. Close the other SHUSH server (or the app using that port), or set another PORT in server/.env.`);
    } else {
        console.error(`Could not start the server: ${err.message}`);
    }
    process.exit(1);
});

async function checkDatabase() {
    try {
        await db.ping();
        console.log(`Connected to SQL Server database "${config.db.database}".`);
    } catch (err) {
        console.error(`Could not connect to SQL Server: ${err.message}`);
        console.error(`  -> ${explainDbError(err, config.db)}`);
        console.error('  The server keeps running and retries on the next request. Run "npm run doctor" for a full check.');
        return;
    }

    try {
        const version = await db.getSchemaVersion();
        if (version !== EXPECTED_SCHEMA_VERSION) {
            console.warn(`[setup] The database is out of date (version ${version ?? 'unknown'}, expected ${EXPECTED_SCHEMA_VERSION}). In SSMS run database/SHUSH.sql and then database/create_app_login.sql again.`);
        }
    } catch (err) {
        console.warn(`[setup] The database is out of date or missing permissions (${err.message}). In SSMS run database/SHUSH.sql and then database/create_app_login.sql again.`);
    }
}

// Listen on 0.0.0.0 so external devices (like the ESP32) can connect
app.listen(config.port, '0.0.0.0', () => {
    console.log(`SHUSH server listening on http://0.0.0.0:${config.port}`);
    db.ping()
        .then(() => console.log(`Connected to SQL Server database "${dbConfig.database}".`))
        .catch((err) => {
            console.error(`Could not connect to SQL Server: ${err.message}`);
        });
});