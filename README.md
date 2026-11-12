# SHUSH

Library acoustic monitoring console. React front end, Node/Express API, SQL Server database.

```
SHUSH/
├── database/
│   ├── SHUSH.sql               # database, Faculty table, usp_SignUp, usp_Login
│   └── create_app_login.sql    # SQL login the Node server uses (EXECUTE-only)
├── server/                     # Node + Express + mssql
│   ├── .env.example            # copy to .env
│   └── src/
│       ├── server.js           # starts the server
│       ├── app.js              # middleware, routes, serves the built React app
│       ├── config.js           # reads .env
│       ├── db.js               # calls usp_SignUp / usp_Login
│       ├── routes/auth.js      # POST signup, login, logout; GET me
│       └── middleware/requireAuth.js
└── client/                     # React (Vite) + Tailwind
    └── src/
        ├── pages/              # SignUp.jsx, Login.jsx, Console.jsx
        ├── components/Alert.jsx
        ├── context/AuthContext.jsx
        └── api.js
```

## 1. Database (SSMS)

1. Run `database/SHUSH.sql` (creates the `SHUSH` database, tables and procedures). Safe to run again.
2. Edit the password in `database/create_app_login.sql`, then run it. This creates the `shush_app` login and grants it the procedures. Safe to run again.
3. Optional, for demos: run `database/sample_data.sql`. It adds 8 tables, 6 sample devices and about 30 days of sample sessions. Everything is labelled "Sample data".
4. To make someone an administrator (needed for Settings), run the `UPDATE` line at the top of the Faculty section in `SHUSH.sql` with their Faculty ID.
5. SQL Server must allow **SQL Server Authentication** (Server properties → Security → *SQL Server and Windows Authentication mode*; restart the service) and **TCP/IP** (SQL Server Configuration Manager → Network Configuration → TCP/IP → Enabled; restart).
   The Node driver cannot use Windows Authentication.

## 2. Configure the server

```
cd server
copy .env.example .env        # macOS/Linux: cp .env.example .env
```

Edit `server/.env`:

| Setting | What to put |
| --- | --- |
| `DB_SERVER` | `localhost` (or the machine name / IP) |
| `DB_PORT` | `1433` for a default instance — leave `DB_INSTANCE` empty |
| `DB_INSTANCE` | e.g. `SQLEXPRESS` for a named instance — then leave `DB_PORT` empty |
| `DB_USER` / `DB_PASSWORD` | `shush_app` and the password you set in step 1 |
| `JWT_SECRET` | a long random string (command is in the file) |
| `LIBRARY_UTC_OFFSET_MINUTES` | library time offset from UTC, `480` for Philippines (default) |
| `DEVICE_OFFLINE_SECONDS` | seconds without a report before a device shows offline (default `120`) |

`server/.env.example` lists every setting.

## 3. Install and run

Requires Node.js 18.11 or newer. From the `SHUSH` folder:

```
npm run setup      # installs root, server and client packages (once)
npm run dev        # API on :3001, React on :5173
```

Open **http://localhost:5173**. The server console prints `Connected to SQL Server database "SHUSH"` when the database connection works; you can also open http://localhost:3001/api/health.

### Single-server mode (no Vite)

```
npm run build      # builds client/dist
npm start          # serves the API and the built site on http://localhost:3001
```

## How it works

| Page / action | API call | Database |
| --- | --- | --- |
| Sign up form | `POST /api/auth/signup` | `dbo.usp_SignUp` |
| Sign in form | `POST /api/auth/login` | `dbo.usp_Login` |
| Console page | `GET /api/auth/me` | — (reads the session cookie) |
| Sign out | `POST /api/auth/logout` | — |

- Passwords are salted and hashed inside SQL Server; the app never stores them.
- A successful login sets an httpOnly cookie. "Keep console active on this workstation" makes it last 30 days instead of ending with the browser session.
- Failed logins are rate limited (10 per 15 minutes per IP).
- Set `COOKIE_SECURE=true` once the site is served over HTTPS.
- After a successful sign-in the faculty console opens at `/console/dashboard`.

### Faculty console

| Page | Route | Who |
| --- | --- | --- |
| Dashboard: summary, device status, recent alerts, maintenance mode | `/console/dashboard` | Faculty and admins |
| Table layout: floor plan, seats, live status | `/console/layout` | Faculty and admins |
| Rewards: most frequent, quietest, quiet streak (this week or month) | `/console/rewards` | Faculty and admins |
| History: alerts, maintenance and sessions, with CSV export | `/console/history` | Faculty and admins |
| Settings: device alert thresholds | `/console/settings` | Administrators only |

The top bar has notifications (recent alerts and maintenance ending soon) and the profile menu with sign out.

API routes: `GET /api/dashboard`, `GET /api/layout`, `GET|POST /api/maintenance`, `POST /api/maintenance/:id/end`, `GET /api/notifications`, `GET /api/rewards?period=week|month`, `GET /api/history`, and for administrators `GET|PUT /api/settings/devices`.

Run the server tests with `npm test --prefix server`.

### Student check-in

- Start page at `/` offers **Student check-in** and **Faculty console**.
- Sign up at `/student/signup`: student number (`21-0001`, the dash is added automatically), last name, first name, optional middle initial, and section such as `BSIT-3D`, `BSCS-1D` or `BSEE-2D`.
- Sign in at `/student/login`: enter the student number, confirm the name shown in the pop-up, and sign in.
- At `/student/table`: choose a group size, choose a table with enough free seats, and confirm. After confirming a table, the student returns to sign-in. Signing in again ends the session. A session also ends automatically after 2 hours.
- Student sessions are written to the same tables the faculty pages read, so the dashboard, table layout, rewards and history update from real visits.

Students use their own cookie (`shush_student`) and cannot open faculty pages, and faculty cookies do not work on student routes.

### Table management (administrators)

On **Settings**, administrators can add a table by its number and seat count. Column and row are optional; if left empty, the table is placed in the next free space. They can also change a table's seats (never below the number currently seated), and remove the sample data once real data is in use.

## Not built yet

- "Forgot password?" is a placeholder; there is no reset flow or email sending.
- Device data ingest (heartbeats, alerts) is not built yet. Until it is, the console shows sample data for the seeded devices.
- Maintenance mode is recorded and shown, but alerts are not suppressed until device ingest exists.
- Threshold changes are saved, but devices only pick them up once device sync exists.
- Student sign-in uses the student number only (no password), so anyone who knows a number can sign in as that student. A PIN is a sensible next step.
- Group members cannot join a session started by another student yet; the session records the group size only.
- Quietest Visitor needs device noise readings, so real sessions only appear in Most Frequent and Quiet Streak until devices report.
