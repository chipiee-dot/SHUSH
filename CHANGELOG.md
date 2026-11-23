# SHUSH orange-gold-cloud: changelog

- Phase 1: `client/tailwind.config.js`, `client/src/index.css`, `client/index.html`. Add orange-gold-cloud design tokens, Tailwind palette, and global base styles.
- Phase 2: `Card`, `Stat`, `Alert`, `StatusPill`, `SampleBadge`, `ConfirmDialog`, `GlowButton`, `Logo`, `PageHeader`, `StudentNumberInput` (all in `client/src/components/`), `client/src/lib/format.js`. Recolor shared UI primitives to the orange-gold-cloud palette.
- Phase 3: `client/src/pages/StartPage.jsx`, `StartPage.css`. Remove the welcome pill, widen the landing card, and apply the cloud theme.
- Phase 4: `client/src/pages/Login.jsx`. Remove the login status badge, widen the card, and recolor the faculty login to orange-gold.
- Phase 5: `client/src/pages/SignUp.jsx`. Widen and rebalance the faculty signup card and recolor it to orange-gold.
- Phase 6: `StudentShell.jsx`, `bokeh.css`, `client/src/pages/student/StudentLogin.jsx`. Widen the student shell and rebuild student login as a two-column orange-gold layout.
- Phase 7: `client/src/pages/student/StudentSignUp.jsx`, `StudentTable.jsx`. Widen student signup and recolor the table picker to orange-gold.
- Phase 8: `AppShell.css`, `FacultyShell.jsx`, `faculty/Dashboard.jsx`, `faculty/TableLayout.jsx`. Switch the faculty rail to orange and recolor the dashboard and table layout.
- Phase 9: `faculty/Rewards.jsx`, `History.jsx`, `Settings.jsx`, `MaintenanceCard.jsx`, `NotificationsMenu.jsx`, `ProfileMenu.jsx`. Recolor rewards, history, settings, menus, and the maintenance card to orange-gold.
- Phase 10: `client/src/App.jsx` (splash screen), `client/src/pages/Console.jsx`. Final sweep: remove the last navy/beige/slate leftovers. Apply the orange-gold-cloud theme, remove the two legacy labels, and widen the welcome and auth layouts.

## Feature phases 1-8

- Phase 1: `client/index.html`, `client/public/*`, `useFacultyShortcut.js`, `StartPage.jsx`, `StudentLogin.jsx`, `ProfileMenu.jsx`, `.gitignore`. Tab icon, Ctrl+Shift+F on student sign-in, faculty sign-out confirmation.
- Phase 2: `StudentTable.jsx`, `StudentTableTile.jsx`, `student-table.css`, `SeatRing.jsx`, `motion.css`. Student table page makeover.
- Phase 3: `StudentShell.jsx`, `StudentLogin.jsx`, `StudentSignUp.jsx`, `StudentTable.jsx`, `ConfirmTableDialog.jsx`, `SuccessCheck.jsx`. Student sign-in, sign-up, seated view and dialog polish.
- Phase 4: `database/SHUSH.sql`, `create_app_login.sql`, `server/src/db.js`, `routes/settings.js`, `services/layoutRules.js`. Floor-plan save (`usp_Layout_Save`, `PUT /api/settings/layout`).
- Phase 5: `TableLayout.jsx`, `TableTile.jsx`, `useLayoutEditor.js`, `lib/layoutRules.js`, `table-layout.css`. Drag tables to move them.
- Phase 6: same files as Phase 5. Resize tables; chairs follow the long side.
- Phase 7: `server/src/routes/student.js`, `StudentTable.jsx`, `StudentTableTile.jsx`, `StudentFloorPlan.jsx`, `student-table.css`. Student floor-plan view.
- Phase 8: `History.jsx`, `lib/exportHistory.js`, `client/package.json` (adds `exceljs`). Styled Excel report, cleaner CSV, docs.


## Stability and speed

- Setup: `server/.env.example` (was missing), `npm install` now installs all three packages, `npm run doctor`, plain start-up messages for the common database errors, a database version check (`usp_Schema_Version`), `.gitignore` for `client/dist` and `.env.*`.
- Speed: pages load on demand (first download about 60% smaller), gzip and long-lived caching for the built site, stale-session cleanup is sargable, indexed and runs at most every 10 seconds, two warm database connections, refreshing pauses in hidden tabs, Vite file polling is off unless `VITE_POLLING=true`.
