# Changed files

Copy over the same paths in the SHUSH project (folders already match).

## 1. Session timer ("Log out of your session?")
- `client/src/pages/student/StudentLogin.jsx`
- Shows time in library, time left with a live draining bar, and the end time.

## 2. Remove Device (Settings)
- Settings > Edit table > **Remove device** disconnects only the device. The table and its records stay.
- Re-entering the same device code later reconnects it with its history.
- `client/src/pages/faculty/Settings.jsx`, `client/src/api.js`,
  `server/src/routes/settings.js`, `server/src/db.js`,
  `database/SHUSH.sql`, `database/create_app_login.sql`,
  `server/src/server.js`, `server/scripts/doctor.js`, `server/test/api.test.js`

## 3. Delete table button (restored)
- Settings > Edit table > **Delete table**: `Settings.jsx`
- Table layout > table details panel > **Delete table**: `TableLayout.jsx`, `TableDrawer.jsx`

## After copying (required)
1. In SSMS run `database/SHUSH.sql`, then `database/create_app_login.sql` (database version is now 3).
2. Restart the server.
