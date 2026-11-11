// Finds a free 2x2 spot on the 12-column floor plan for a new table.
// Used when an admin adds a table without typing a position.

export const GRID_COLUMNS = 12;
export const DEFAULT_SIZE = 2;

const overlaps = (a, b) =>
  a.col < b.col + b.width && a.col + a.width > b.col &&
  a.row < b.row + b.height && a.row + a.height > b.row;

export function findFreeSpot(tables, { width = DEFAULT_SIZE, height = DEFAULT_SIZE } = {}) {
  const taken = tables.map((t) => ({
    col: t.grid.col,
    row: t.grid.row,
    width: t.grid.width,
    height: t.grid.height,
  }));
  for (let row = 0; row < 100; row += 1) {
    for (let col = 0; col + width <= GRID_COLUMNS; col += 1) {
      const candidate = { col, row, width, height };
      if (!taken.some((t) => overlaps(t, candidate))) return { col, row, width, height };
    }
  }
  return null;
}
