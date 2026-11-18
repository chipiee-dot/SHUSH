import { config } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';

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
        serverName: 'localhost',
    },
};

const db = createDb(dbConfig);
const app = createApp({ db, config });

app.listen(config.port, () => {
    console.log(`SHUSH server listening on http://localhost:${config.port}`);
    db.ping()
        .then(() => console.log(`Connected to SQL Server database "${dbConfig.database}".`))
        .catch((err) => {
            console.error(`Could not connect to SQL Server: ${err.message}`);
        });
});