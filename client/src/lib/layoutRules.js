// Floor-plan rules shared by the editor. Pure functions, no DOM, so they can be tested with `node --test`.
// A placement is { col, row, width, height } on a 12-column grid (col 0 = left, row 0 = top).

export const GRID_COLUMNS = 12;
export const MAX_ROWS = 100;

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
 * Only the tables whose position or size changed, ready for api.saveLayout.
 * server and draft are objects keyed by table number: { [tableNo]: { col, row, width, height } }.
 */
export function diffPlacements(server, draft) {
  const changes = [];
  for (const key of Object.keys(draft)) {
    const before = server[key];
    const after = draft[key];
    if (!before) continue;
    if (before.col !== after.col || before.row !== after.row || before.width !== after.width || before.height !== after.height) {
      changes.push({ tableNo: Number(key), col: after.col, row: after.row, width: after.width, height: after.height });
    }
  }
  return changes.sort((a, b) => a.tableNo - b.tableNo);
}
