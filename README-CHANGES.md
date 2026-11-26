# Changed files

Copy over the same paths in the SHUSH project (folders already match). **Run the updated `database/SHUSH.sql`
once (schema version 4) and `database/create_app_login.sql`**, then restart the server and run `npm run doctor`.

## Rewards periods and certificates
- A rewards period closes when faculty press **End period** (Rewards page), or by itself one calendar month
  after it started. There is no background job: an overdue period closes the next time someone opens the
  Rewards page or a student page.
- Closing a period issues a certificate to the #1 Most Frequent Visitor and the #1 Quietest Visitor
  (sessions of 30 minutes or more). No Quietest certificate if nobody qualifies. The counts, and the quiet
  streak, start again from zero in the new period.
- Faculty: Rewards > **Export** opens a modal with two buttons: **Certificates** (pick Frequent or Quietest,
  then Print or Download PNG; uses the last closed period) and **Current period stats**.
- Students: a "Your certificates" card appears on their page once they have one; it opens a modal with
  Print and Download PNG.
- If the database has not been updated, the Rewards page still works and the Export / End period buttons stay hidden.

Files:
- Database: `database/SHUSH.sql` (section 31, tables `RewardPeriod`, `Certificate`, 5 procedures),
  `database/create_app_login.sql`
- Server: `server/src/db.js`, `server/src/services/rewards.js`, `server/src/services/rewardPeriods.js` (new),
  `server/src/routes/faculty.js`, `server/src/routes/student.js`, `server/src/server.js`,
  `server/scripts/doctor.js`, tests `server/test/rewardPeriods.test.js` (new), `api.test.js`, `student.test.js`
- Client: `client/src/lib/certificate.js` (new), `client/src/lib/logoPaths.js` (new),
  `client/src/components/CertificateView.jsx`, `RewardsExportModal.jsx`, `StudentCertificates.jsx` (new),
  `client/src/components/Logo.jsx`, `client/src/pages/faculty/Rewards.jsx`,
  `client/src/pages/student/StudentTable.jsx`, `client/src/api.js`, `client/index.html` (Playfair Display and
  Great Vibes fonts), `client/src/index.css` (print styles)

---

## Earlier changes

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
