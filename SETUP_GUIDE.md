# SHUSH Setup Guide

## Connection Setup Documentation

This document explains how the SHUSH application (Client → Server → Database) was connected and configured.

---

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│  React Client   │────────▶│  Express Server │────────▶│  SQL Server     │
│  (Port 5173)    │  HTTP   │  (Port 3001)    │  mssql  │  (SQLEXPRESS)   │
│                 │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
     Vite Dev                  Node.js API              Database (SHUSH)
```

---

## Step 1: Install Dependencies

The project has a monorepo structure with separate `package.json` files for root, client, and server.

### Commands Run:
```powershell
# Root dependencies (concurrently for running both dev servers)
npm install

# Server dependencies (Express, mssql, dotenv, etc.)
npm install --prefix server

# Client dependencies (React, Vite, Tailwind, etc.)
npm install --prefix client
```

### What This Does:
- **Root**: Installs `concurrently` to run both servers simultaneously
- **Server**: Installs Express.js, mssql driver, JWT libraries, bcrypt, etc.
- **Client**: Installs React, Vite, React Router, Tailwind CSS, and UI libraries

---

## Step 2: Database Setup

### 2.1 Verify SQL Server Installation

First, checked if SQL Server was running:

```powershell
Get-Service -Name "MSSQL*"
```

**Result**: SQL Server Express instance `MSSQL$SQLEXPRESS` was found and running.

### 2.2 Create Database Schema

Ran the main database script to create tables and stored procedures:

```powershell
sqlcmd -S localhost\SQLEXPRESS -E -i "database\SHUSH.sql"
```

**What This Creates**:
- `SHUSH` database
- Tables:
  - `Faculty` - Faculty user accounts with hashed passwords
  - `Student` - Student accounts
  - `LibraryTable` - Physical tables in the library
  - `Device` - Noise monitoring devices
  - `Session` - Student check-in/check-out sessions
  - `Alert` - Noise alerts from devices
  - `Maintenance` - Maintenance mode tracking
- Stored Procedures:
  - `usp_SignUp` - Faculty registration with password hashing
  - `usp_Login` - Faculty authentication
  - `usp_Student_Register` - Student registration
  - `usp_Session_Start/End` - Check-in/check-out logic
  - And many more for dashboard, history, rewards, etc.

### 2.3 Create Application Login

Created a dedicated SQL Server login for the Node.js application:

```powershell
sqlcmd -S localhost\SQLEXPRESS -E -i "database\create_app_login.sql"
```

**What This Creates**:
- SQL Server login: `shush_app`
- Password: `ChangeThis!Str0ngPassw0rd`
- Permissions: **EXECUTE-only** on stored procedures (security best practice)
- The app cannot directly read/write tables - only through stored procedures

### 2.4 Load Sample Data

Loaded demo data for testing:

```powershell
sqlcmd -S localhost\SQLEXPRESS -E -i "database\sample_data.sql"
```

**What This Adds**:
- 8 library tables
- 6 sample noise monitoring devices
- ~30 days of sample sessions and alerts
- All labeled as "Sample data" for easy identification

### 2.5 Test Database Connection

Verified the `shush_app` login works:

```powershell
sqlcmd -S localhost\SQLEXPRESS -U shush_app -P "ChangeThis!Str0ngPassw0rd" -Q "SELECT @@VERSION" -d SHUSH
```

**Result**: ✅ Connection successful with SQL Server 2025 Express Edition

---

## Step 3: Server Configuration

### 3.1 Generate JWT Secret

Generated a secure random string for JWT token signing:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Result**: `f6b10cf235f0f039e6542a9c1b939dba7c63abfaa8448ba91ef41495bd042a5fbcb4ade81a0507bd63dfc16ffa00664b`

### 3.2 Create .env File

Created `server/.env` from `.env.example` with these key configurations:

```env
# Database Connection - Named Instance (SQLEXPRESS)
DB_SERVER=localhost
DB_PORT=                    # Empty - using named instance
DB_INSTANCE=SQLEXPRESS      # Your SQL Server instance name
DB_DATABASE=SHUSH
DB_USER=shush_app
DB_PASSWORD=ChangeThis!Str0ngPassw0rd

# Security - Trust server certificate for local development
DB_ENCRYPT=true
DB_TRUST_SERVER_CERT=true   # Required for local SQL Server without SSL cert

# Server Configuration
PORT=3001
JWT_SECRET=f6b10cf235f0f039e6542a9c1b939dba7c63abfaa8448ba91ef41495bd042a5fbcb4ade81a0507bd63dfc16ffa00664b
COOKIE_SECURE=false         # false for HTTP (dev), true for HTTPS (prod)

# Library Settings
LIBRARY_UTC_OFFSET_MINUTES=480  # Philippines time (UTC+8)
DEVICE_OFFLINE_SECONDS=120      # Device considered offline after 2 minutes
```

### Why This Configuration Matters:

1. **DB_INSTANCE vs DB_PORT**:
   - Named instances (like SQLEXPRESS) use `DB_INSTANCE` and leave `DB_PORT` empty
   - Default instances use `DB_PORT=1433` and leave `DB_INSTANCE` empty

2. **DB_TRUST_SERVER_CERT=true**:
   - Local SQL Server doesn't have SSL certificates
   - Required for the `mssql` Node.js driver to connect
   - ⚠️ Only use for localhost development

3. **JWT_SECRET**:
   - Signs session tokens for faculty authentication
   - Must be long and random (96 hex characters = 384 bits)
   - Never commit this to version control in production

---

## Step 4: How the Connection Works

### Client → Server (HTTP/REST API)

**Location**: `client/src/api.js`

```javascript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = {
  // Faculty Authentication
  signup: (data) => fetch(`${API_BASE}/auth/signup`, { ... }),
  login: (data) => fetch(`${API_BASE}/auth/login`, { ... }),
  
  // Student Authentication  
  studentRegister: (data) => fetch(`${API_BASE}/student/register`, { ... }),
  
  // Dashboard Data
  getDashboard: () => fetch(`${API_BASE}/dashboard`, { ... }),
  
  // And many more endpoints...
};
```

**Key Features**:
- Client runs on `http://localhost:5173` (Vite dev server)
- All API requests go to `http://localhost:3001/api`
- Credentials included for cookie-based sessions
- CORS enabled in Express for cross-origin requests during development

### Server → Database (mssql Driver)

**Location**: `server/src/config.js` and `server/src/db.js`

#### Configuration (`config.js`)
```javascript
import dotenv from 'dotenv';
dotenv.config();

export const dbConfig = {
  server: process.env.DB_SERVER,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
  options: {
    instanceName: process.env.DB_INSTANCE || undefined,
    database: process.env.DB_DATABASE,
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
  },
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    }
  }
};
```

#### Database Connection (`db.js`)
```javascript
import sql from 'mssql';
import { dbConfig } from './config.js';

// Connection pool (reuses connections efficiently)
let pool = null;

export async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    console.log('Connected to SQL Server database "SHUSH"');
  }
  return pool;
}

// Example: Call stored procedure
export async function login(facultyId, password) {
  const pool = await getPool();
  const result = await pool.request()
    .input('FacultyId', sql.NVarChar(30), facultyId)
    .input('Password', sql.NVarChar(128), password)
    .execute('dbo.usp_Login');
  
  return result.recordset[0];
}
```

**Security Features**:
- Connection pooling for performance
- Parameterized stored procedure calls (SQL injection prevention)
- Application only has EXECUTE permission (can't directly query tables)
- Passwords hashed with SHA2-512 + salt in SQL Server

---

## Step 5: Running the Application

### Start Development Servers

From the project root:

```powershell
npm run dev
```

This runs (via `concurrently`):
```json
{
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"npm run dev --prefix server\" \"npm run dev --prefix client\""
  }
}
```

**What Happens**:
1. **Server** (`npm run dev --prefix server`):
   - Starts Node.js with `--watch` flag (auto-restart on file changes)
   - Loads environment variables from `.env`
   - Connects to SQL Server
   - Starts Express server on `http://localhost:3001`
   - Serves API endpoints at `/api/*`

2. **Client** (`npm run dev --prefix client`):
   - Starts Vite dev server on `http://localhost:5173`
   - Hot Module Replacement (HMR) for instant updates
   - Proxies API requests to server (configured in `vite.config.js`)

### Expected Console Output

```
[server] SHUSH server listening on http://localhost:3001
[server] Connected to SQL Server database "SHUSH"
[client] 
[client]   VITE v5.x.x  ready in xxx ms
[client] 
[client]   ➜  Local:   http://localhost:5173/
[client]   ➜  Network: use --host to expose
```

---

## API Endpoints Overview

### Authentication (Faculty)
- `POST /api/auth/signup` - Register new faculty account
- `POST /api/auth/login` - Faculty login (sets httpOnly cookie)
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/me` - Get current faculty info from session

### Authentication (Students)
- `POST /api/student/register` - Register student
- `POST /api/student/login` - Student login (separate cookie)
- `POST /api/student/logout` - Clear student session

### Faculty Console
- `GET /api/dashboard` - Summary stats, device status, recent alerts
- `GET /api/layout` - Table layout with real-time seat occupancy
- `GET /api/rewards?period=week|month` - Top students (frequent, quietest, streaks)
- `GET /api/history` - Alerts, maintenance, sessions with filters
- `GET /api/notifications` - Recent alerts and maintenance

### Students
- `GET /api/student/tables` - Available tables with seat counts
- `POST /api/student/checkin` - Start a session at a table
- `POST /api/student/checkout` - End the current session

### Settings (Faculty)
- `GET /api/settings/devices` - Device list with thresholds
- `PUT /api/settings/devices/:id` - Update device alert thresholds
- `POST /api/settings/tables` - Add a new table
- `PUT /api/settings/layout` - Save table positions/sizes

---

## Troubleshooting

### Issue: "Cannot find package 'vite'" or "Cannot find package 'dotenv'"

**Cause**: Dependencies not installed in client/server folders

**Solution**:
```powershell
npm install --prefix client
npm install --prefix server
```

---

### Issue: "Failed to connect to localhost:1433"

**Cause**: Using port 1433 for a named instance (SQLEXPRESS)

**Solution**: In `.env`, set:
```env
DB_PORT=
DB_INSTANCE=SQLEXPRESS
```

---

### Issue: "Login failed for user 'shush_app'"

**Causes**:
1. SQL Server not set to Mixed Mode (SQL + Windows Authentication)
2. Wrong password in `.env`
3. Login not created

**Solutions**:

1. **Enable Mixed Mode**:
   - Open SQL Server Management Studio (SSMS)
   - Right-click server → Properties → Security
   - Select "SQL Server and Windows Authentication mode"
   - Restart SQL Server service

2. **Verify Password**:
   - Check `server/.env` has: `DB_PASSWORD=ChangeThis!Str0ngPassw0rd`
   - Match the password in `database/create_app_login.sql`

3. **Recreate Login**:
   ```powershell
   sqlcmd -S localhost\SQLEXPRESS -E -i "database\create_app_login.sql"
   ```

---

### Issue: "TCP/IP connection refused"

**Cause**: TCP/IP protocol disabled in SQL Server

**Solution**:
1. Open **SQL Server Configuration Manager**
2. SQL Server Network Configuration → Protocols for SQLEXPRESS
3. Right-click **TCP/IP** → Enable
4. Restart SQL Server service:
   ```powershell
   Restart-Service -Name "MSSQL`$SQLEXPRESS"
   ```

---

### Issue: CORS errors in browser console

**Cause**: Client and server on different ports

**Solution**: Already configured in `server/src/app.js`:
```javascript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

If using different ports, update the `origin` value.

---

## Production Deployment Checklist

When deploying to production, update these settings:

### Server `.env`
```env
# Use your production database server
DB_SERVER=your-prod-server.database.windows.net
DB_PORT=1433
DB_INSTANCE=

# Generate NEW JWT secret (never reuse dev secret)
JWT_SECRET=<new-random-96-character-hex-string>

# Enable secure cookies over HTTPS
COOKIE_SECURE=true
TRUST_PROXY=true

# Don't trust server certificate in production (use real SSL)
DB_TRUST_SERVER_CERT=false
```

### Build and Serve
```powershell
# Build React app
npm run build

# Serve both API and static files from Express
npm start
```

In production, Express serves the built React app from `client/dist` on the same port (3001), eliminating CORS concerns.

---

## Summary

✅ **Dependencies Installed**: Root, server, and client packages
✅ **Database Created**: SHUSH database with all tables and procedures
✅ **SQL Login Created**: `shush_app` with execute-only permissions
✅ **Sample Data Loaded**: Demo tables, devices, and sessions
✅ **.env Configured**: Database connection, JWT secret, security settings
✅ **Connection Verified**: Client → Server → Database working

**Access Points**:
- Client: http://localhost:5173
- Server API: http://localhost:3001/api
- Health Check: http://localhost:3001/api/health

The application is now fully connected and ready to use! 🚀
