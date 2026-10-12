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

1. Run `database/SHUSH.sql` (creates the `SHUSH` database, table and procedures).
2. Edit the password in `database/create_app_login.sql`, then run it. This creates the `shush_app` login.
3. SQL Server must allow **SQL Server Authentication** (Server properties → Security → *SQL Server and Windows Authentication mode*; restart the service) and **TCP/IP** (SQL Server Configuration Manager → Network Configuration → TCP/IP → Enabled; restart).
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

## Not built yet

- "Forgot password?" is a placeholder; there is no reset flow or email sending.
