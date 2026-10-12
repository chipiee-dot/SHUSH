import { config } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';

const db = createDb(config.db);
const app = createApp({ db, config });

app.listen(config.port, () => {
  console.log(`SHUSH server listening on http://localhost:${config.port}`);
  // Check the database right away so connection problems show up in the console.
  db.ping()
    .then(() => console.log(`Connected to SQL Server database "${config.db.database}".`))
    .catch((err) => {
      console.error(`Could not connect to SQL Server: ${err.message}`);
      console.error('Check server/.env and that SQL Server accepts TCP/IP + SQL logins (see README).');
    });
});
