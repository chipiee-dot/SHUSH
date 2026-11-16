// Floor-plan rules shared by the editor. Pure functions, no DOM, so they can be tested with `node --test`.
// A placement is { col, row, width, height } on a 12-column grid (col 0 = left, row 0 = top).

export const GRID_COLUMNS = 12;
export const MAX_ROWS = 100;
export const MAX_SEATS = 20;
// Every table is exactly 2 grid rows tall; only the width can change. The server and database repeat this rule.
export const TABLE_HEIGHT = 2;
// What the editor lets you draw. The server stays the last word.
export const UI_LIMITS = { maxWidth: 10, maxHeight: TABLE_HEIGHT };

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** True when two placements share at least one cell. */
export const overlaps = (a, b) =>
  a.col < b.col + b.width && a.col + a.width > b.col &&
  a.row < b.row + b.height && a.row + a.height > b.row;

/**
 * Pulls a placement inside the grid. Position is always clamped; size is clamped only when limits ask for it.
 * limits: { columns = 12, rows = 100, maxWidth, maxHeight }
 */
export function clampPlacement(p, limits = {}) {
  const { columns = GRID_COLUMNS, rows = MAX_ROWS, maxWidth = columns, maxHeight = rows } = limits;
  const width = clamp(p.width, 1, Math.min(maxWidth, columns));
  const height = clamp(p.height, 1, Math.min(maxHeight, rows));
  return {
    ...p,
    width,
    height,
    col: clamp(p.col, 0, columns - width),
    row: clamp(p.row, 0, rows - height),
  };
}

/** True when the placement is inside the grid and touches none of the other placements. */
export function isFree(placement, others, limits = {}) {
  const { columns = GRID_COLUMNS, rows = MAX_ROWS } = limits;
  const inside =
    placement.col >= 0 && placement.row >= 0 &&
    placement.width >= 1 && placement.height >= 1 &&
    placement.col + placement.width <= columns && placement.row + placement.height <= rows;
  return inside && !others.some((o) => overlaps(placement, o));
}

/**
 * The grid cell under a point. x and y are pixels from the top-left of the first cell;
 * metrics: { stepX, stepY } = cell size plus gap. Points left of or above the grid give negative cells.
 */
export function cellFromPoint(x, y, metrics) {
  const { stepX, stepY } = metrics;
  if (!(stepX > 0) || !(stepY > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return { col: 0, row: 0 };
  return { col: Math.floor(x / stepX), row: Math.floor(y / stepY) };
}

/**
 * Seats after a resize. Chairs sit on the two longer sides, so every cell added to (or removed from) the
 * long side adds (or removes) 2 chairs; changing only the short side changes nothing.
 * Returns the new seat count, or null when the resize is refused: fewer than max(1, occupied) or more than 20 seats.
 */
export function seatsAfterResize({ oldW, oldH, newW, newH, seats, occupied = 0 }) {
  const next = seats + 2 * (Math.max(newW, newH) - Math.max(oldW, oldH));
  if (next < Math.max(1, occupied) || next > MAX_SEATS) return null;
  return next;
}

/**
 * Checks a size for a table. origin is the placement (with seats) the resize started from, others are the
 * other tables' placements. valid is false when the size is outside the editor limits, leaves the grid,
 * touches another table, or breaks the seat rules. Height must always be TABLE_HEIGHT (2). seats is the resulting seat count (null if refused).
 */
export function resizeOutcome({ origin, width, height, others, occupied = 0, rows = MAX_ROWS }) {
  const seats = seatsAfterResize({
    oldW: origin.width, oldH: origin.height, newW: width, newH: height, seats: origin.seats, occupied,
  });
  const sizeOk = width >= 1 && width <= UI_LIMITS.maxWidth && height === TABLE_HEIGHT;
  const placement = { col: origin.col, row: origin.row, width, height };
  const valid = sizeOk && seats !== null && isFree(placement, others, { columns: GRID_COLUMNS, rows });
  return { valid, seats };
}

/**
 * Only the tables that changed, ready for api.saveLayout.
 * server and draft are objects keyed by table number: { [tableNo]: { col, row, width, height, seats } }.
 * seats is sent only for tables whose seat count changed, so a plain move never overwrites it.
 */
export function diffPlacements(server, draft) {
  const changes = [];
  for (const key of Object.keys(draft)) {
    const before = server[key];
    const after = draft[key];
    if (!before) continue;
    const moved = before.col !== after.col || before.row !== after.row || before.width !== after.width || before.height !== after.height;
    const reseated = before.seats !== after.seats;
    if (!moved && !reseated) continue;
    const change = { tableNo: Number(key), col: after.col, row: after.row, width: after.width, height: after.height };
    if (reseated) change.seats = after.seats;
    changes.push(change);
  }
  return changes.sort((a, b) => a.tableNo - b.tableNo);
}
