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
4. Faculty have one role: every faculty account can use every page, including Settings. Existing databases lose the old `Role` column when `SHUSH.sql` runs.
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
| Dashboard: summary, device status, recent alerts, maintenance mode | `/console/dashboard` | Faculty |
| Table layout: floor plan, seats, live status. **Edit layout** to move and resize tables | `/console/layout` | Faculty |
| Rewards: most frequent, quietest, quiet streak (this week or month) | `/console/rewards` | Faculty |
| History: alerts, maintenance and sessions, with Excel and CSV export | `/console/history` | Faculty |
| Settings: device alert thresholds | `/console/settings` | Faculty |

The top bar has notifications (recent alerts and maintenance ending soon) and the profile menu with sign out.

API routes: `GET /api/dashboard`, `GET /api/layout`, `GET|POST /api/maintenance`, `POST /api/maintenance/:id/end`, `GET /api/notifications`, `GET /api/rewards?period=week|month`, `GET /api/history`, and the Settings routes under `/api/settings/...` (device thresholds, tables, layout, working hours), all for any signed-in faculty.

Run the server tests with `npm test --prefix server`.

### Student check-in

- Start page at `/` offers only **Student check-in**. Faculty reach their sign-in with **Ctrl+Shift+F** on the start page or the student sign-in page.
- Sign up at `/student/signup`: student number (`21-0001`, the dash is added automatically), last name, first name, optional middle initial, and section such as `BSIT-3D`, `BSCS-1D` or `BSEE-2D`.
- Sign in at `/student/login`: enter the student number, confirm the name shown in the pop-up, and sign in.
- At `/student/table`: tap a table with a free seat and confirm it in the pop-up. From 768px up a **Cards | Floor plan** toggle switches to the real floor plan (see below). After confirming, the student returns to sign-in. Signing in again ends the session. A session also ends automatically after 2 hours. The **Sign out** button only signs the student out of this device; a seat stays active until the session ends.
- Student sessions are written to the same tables the faculty pages read, so the dashboard, table layout, rewards and history update from real visits.

Students use their own cookie (`shush_student`) and cannot open faculty pages, and faculty cookies do not work on student routes.

### Editing the floor plan

On **Table layout**, press **Edit layout** (768px and wider). Nothing changes for anyone else until you press **Save layout** and confirm.

- **Move:** drag a table (or focus it and use the arrow keys). Tables snap to the 12-column grid and cannot overlap; an invalid drop springs back.
- **Resize:** drag the right edge, bottom edge or corner (or Shift + arrow keys). Width is 1-10 and height is 1-4 cells.
- **Seat rule:** chairs sit on the two longer sides. Each cell added to or removed from the long side adds or removes 2 chairs: `seatsAfter = seatsBefore + 2 * (max(newW,newH) - max(oldW,oldH))`. Changing only the short side keeps the seats. A resize below 1 seat, below the students seated now, or above 20 seats is refused. Exact seat counts can still be set in **Settings**.
- **Undo / Reset / Cancel:** Undo steps back, Reset returns to the saved layout, Cancel asks before discarding.
- **Database:** saving calls `dbo.usp_Layout_Save` (granted to `shush_app` in `create_app_login.sql`). It uses `OPENJSON`, so it needs SQL Server 2016 or newer and database compatibility level 130 or higher. Re-run `SHUSH.sql` and `create_app_login.sql` after updating.

### Student floor plan

At `/student/table`, from 768px up, students can switch from **Cards** to **Floor plan**. It shows tables at the positions and sizes saved on the faculty page, with taken chairs filled. Floor plan is the default from 1024px up, the choice is remembered for the browser tab, and below 768px only Cards show. **Open tables only** dims tables that are not open. Students never receive device or noise data; `GET /api/student/tables` only adds each table's `grid`.

### History export

On **History**, **Export** offers two files for the rows currently shown (same filters):

- **Excel report (.xlsx):** colored and formatted, with summary boxes, a frozen filterable header, real date and time values, a color-coded Type column, a "Daily summary" sheet, and print setup (landscape, one page wide, repeating header, page numbers). The `exceljs` library loads only when this option is picked.
- **CSV (.csv):** plain data with a UTF-8 BOM (Excel shows characters correctly), CRLF line ends and the columns Date, Time, Type, Table, Summary, Details, Sample data, Timestamp (UTC). Cells that start with `=`, `+`, `-` or `@` are quoted safely.

File names: `shush-history-<type>-<YYYY-MM-DD>.xlsx` / `.csv`.

### Table management

On **Settings**, faculty can add a table by its number and seat count. Column and row are optional; if left empty, the table is placed in the next free space (it can be moved afterwards with **Edit layout**). They can also change a table's seats (never below the number currently seated), and remove the sample data once real data is in use.

## Not built yet

- "Forgot password?" is a placeholder; there is no reset flow or email sending.
- Device data ingest (heartbeats, alerts) is not built yet. Until it is, the console shows sample data for the seeded devices.
- Maintenance mode is recorded and shown, but alerts are not suppressed until device ingest exists.
- Threshold changes are saved, but devices only pick them up once device sync exists.
- Student sign-in uses the student number only (no password), so anyone who knows a number can sign in as that student. A PIN is a sensible next step.
- Each student signs in on their own and takes one seat. A table holds as many students as it has seats.
- Quietest Visitor needs device noise readings, so real sessions only appear in Most Frequent and Quiet Streak until devices report.
