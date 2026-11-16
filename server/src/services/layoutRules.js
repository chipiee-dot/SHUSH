// Checks a floor-plan save before it reaches the database. The stored procedure (usp_Layout_Save)
// repeats every rule, so this only gives faster, clearer answers; the database stays the last word.
import { GRID_COLUMNS, overlaps } from './tablePlacement.js';

export const MAX_LAYOUT_CHANGES = 100;
export const MAX_ROWS = 100;
export const MAX_SIZE = 12;
export const MAX_SEATS = 20;

const bad = (status, message) => ({ ok: false, status, message });
const isInt = (n) => typeof n === 'number' && Number.isInteger(n);

/**
 * changes: [{ tableNo, col, row, width, height, seats? }] (changed tables only)
 * currentRows: rows from db.getLayout() (tableNo, gridCol, gridRow, gridWidth, gridHeight, occupied)
 * Returns { ok: true } or { ok: false, status, message }. 400 = bad input, 409 = conflicts with the floor plan.
 */
export function validateLayoutChanges(changes, currentRows) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return bad(400, 'Send a list of tables to save.');
  }
  if (changes.length > MAX_LAYOUT_CHANGES) {
    return bad(400, `Save at most ${MAX_LAYOUT_CHANGES} tables at a time.`);
  }

  const current = new Map(currentRows.map((r) => [r.tableNo, r]));
  const seen = new Set();

  // 1) Shape and bounds (400)
  for (const c of changes) {
    if (!c || typeof c !== 'object') return bad(400, 'Each table needs a number, column, row, width and height.');
    const { tableNo, col, row, width, height, seats } = c;
    if (![tableNo, col, row, width, height].every(isInt)) {
      return bad(400, 'Table number, column, row, width and height must be whole numbers.');
    }
    if (seen.has(tableNo)) return bad(400, `Table ${tableNo} appears more than once.`);
    seen.add(tableNo);
    if (!current.has(tableNo)) return bad(400, `Table ${tableNo} does not exist.`);
    if (
      col < 0 || row < 0 ||
      width < 1 || width > MAX_SIZE || height < 1 || height > MAX_SIZE ||
      col + width > GRID_COLUMNS || row + height > MAX_ROWS
    ) {
      return bad(400, `Table ${tableNo} would be outside the floor plan grid.`);
    }
    if (seats !== undefined && seats !== null && (!isInt(seats) || seats < 1 || seats > MAX_SEATS)) {
      return bad(400, `Seats must be between 1 and ${MAX_SEATS}.`);
    }
  }

  // 2) Not below the students seated right now (409)
  for (const c of changes) {
    const occupied = current.get(c.tableNo).occupied ?? 0;
    if (c.seats !== undefined && c.seats !== null && c.seats < occupied) {
      return bad(409, `Table ${c.tableNo} has ${occupied} students seated, so it cannot have fewer than ${occupied} seats.`);
    }
  }

  // 3) No overlaps in the final layout (409). Checking the final set lets two tables swap places.
  const final = currentRows.map((r) => ({
    tableNo: r.tableNo, col: r.gridCol, row: r.gridRow, width: r.gridWidth, height: r.gridHeight,
  }));
  for (const c of changes) {
    const t = final.find((f) => f.tableNo === c.tableNo);
    Object.assign(t, { col: c.col, row: c.row, width: c.width, height: c.height });
  }
  for (let i = 0; i < final.length; i += 1) {
    for (let j = i + 1; j < final.length; j += 1) {
      if (overlaps(final[i], final[j])) {
        const [a, b] = [final[i].tableNo, final[j].tableNo].sort((x, y) => x - y);
        return bad(409, `Table ${a} and Table ${b} would overlap: that spot on the floor plan is already taken.`);
      }
    }
  }

  return { ok: true };
}
