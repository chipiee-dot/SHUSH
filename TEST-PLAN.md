# SHUSH orange-gold-cloud: test plan

## Commands
```bash
npm run build --prefix client
npm test --prefix server
node --test client/src/lib/*.test.js
npm run dev        # then open http://localhost:5173
```

## Sweeps (each must return nothing)
```bash
grep -rn "#1b2d5a\|#152549\|#16254a\|#14234b\|#d6cfbe\|#f1ede3\|#f7f5ed\|#ece7da\|#273b6b\|#152754\|#111f3e\|#0f1b3a\|#5b4bdb\|#6a5be6" client/src
grep -rnE "(^|[^a-z])(emerald|sky|blue|indigo|violet|purple|slate)-" client/src
grep -rn "Quiet-Zone Console\|System Online\|18 Nodes Active\|landing-pill\|status-dot" client/src
```

## Responsive QA (record pass/fail)
| Screen | 1440 | 1366 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- | --- |
| Welcome `/` | card ~1080px, no pill | fits | fits | stacks | no h-scroll |
| Faculty login `/login` | card ~1180px, no badge | fits | fits | stacks | no h-scroll |
| Faculty signup `/signup` | ~1120px, 42/58 | fits | fits | stacks | no h-scroll |
| Student login `/student/login` | two columns ~896px | fits | hero hides | stacked | no h-scroll |
| Student signup `/student/signup` | ~896px | fits | fits | stacked | no h-scroll |
| Student table `/student/table` | tiles clear | fits | fits | 2-col | 1-col |
| Faculty console | orange rail | fits | rail collapses | mobile nav | mobile nav |

Also: Tab shows orange focus rings everywhere; `prefers-reduced-motion` stops animations; no console errors.

Hex sweep: `grep -rnE "#[0-9a-fA-F]{6}" client/src --include=*.jsx` should show only the two rail-gradient colors in `FacultyShell.jsx`.

## Floor-plan editing (faculty)
1. `/console/layout` (768px+): **Edit layout** shows dashed guides. Drag a table to an empty spot (gold ghost, snaps in); onto another table (red ghost, springs back).
2. Drag an edge or corner: chairs follow the long side (+2 per added cell); a table taller than wide has chairs on the left and right.
3. Undo, Reset and Cancel work; **Save layout** asks for confirmation. Reload: positions, sizes and seats persist; Settings shows the new seat counts.
4. At 390px the button is replaced by a "needs a larger screen" note.

## Student floor plan
1. Save a new layout, then open `/student/table` at 1024px+: **Floor plan** is shown and matches the faculty layout. Taken chairs are filled; a full table is dimmed and dashed; clicking an open table opens "Confirm your table".
2. Toggle to Cards and reload: the choice is remembered for the tab. At 390px: Cards only, no toggle.
3. DevTools Network: `/api/student/tables` contains `grid` and no device fields.

## History export
1. **Export** opens a menu; Esc and an outside click close it.
2. **Excel report:** opens without a warning; orange title bar, summary boxes, orange header with filters, zebra rows, color-coded Type, frozen header; the "Daily summary" sheet shows per-day counts. Print preview: landscape, header repeats, footer shows page numbers.
3. Change the filters (type, table, range) and export again: the file matches what is on screen.
4. **CSV:** opens in Excel with correct characters and the new columns; a summary starting with `=` is still quoted safely.
5. With no rows, both options show "There is nothing to export for these filters."
6. `npm run build --prefix client`: a separate `exceljs` chunk appears and the main bundle stays about the same.

