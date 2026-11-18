import { config } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';

// We are FORCING the connection settings here.
// We use 'localhost' instead of '127.0.0.1' to prevent the TLS ServerName IP error.
const dbConfig = {
    server: 'localhost',
    port: 1433,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
    },
};

const db = createDb(dbConfig);
const app = createApp({ db, config });

app.listen(config.port, () => {
    console.log(`SHUSH server listening on http://localhost:${config.port}`);
    // Check the database right away so connection problems show up in the console.
    db.ping()
        .then(() => console.log(`Connected to SQL Server database "${dbConfig.database}".`))
        .catch((err) => {
            console.error(`Could not connect to SQL Server: ${err.message}`);
            console.error(`Tried ${dbConfig.server}:${dbConfig.port} (db="${dbConfig.database}", user="${dbConfig.user}").`);
        });
});