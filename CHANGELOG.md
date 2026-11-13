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
