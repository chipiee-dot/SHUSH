import { useCallback, useMemo, useRef, useState } from 'react';
import {
  GRID_COLUMNS,
  MAX_ROWS,
  TABLE_HEIGHT,
  UI_LIMITS,
  cellFromPoint,
  clampPlacement,
  diffPlacements,
  isFree,
  resizeOutcome,
} from '../lib/layoutRules.js';

const UNDO_LIMIT = 50;
const MIN_ROWS = 6;

// { [tableNo]: { col, row, width, height, seats } } from the tables the page loaded.
const snapshot = (tables) =>
  Object.fromEntries(
    tables.map((t) => [t.tableNo, { col: t.grid.col, row: t.grid.row, width: t.grid.width, height: t.grid.height, seats: t.seats }])
  );

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Every placement except the one for tableNo.
const othersOf = (draft, tableNo) =>
  Object.entries(draft)
    .filter(([no]) => Number(no) !== tableNo)
    .map(([, p]) => p);

/**
 * Owns everything about editing the floor plan: the draft placements, the undo stack, drag state and the
 * message for the live region. Nothing is sent to the server here; the page saves `changes` itself.
 * canvasRef points at the grid element, which is measured at the start of each drag.
 */
export default function useLayoutEditor({ tables, canvasRef }) {
  const [editing, setEditing] = useState(false);
  const [base, setBase] = useState({}); // the saved layout when editing began
  const [draft, setDraft] = useState({});
  const [undoStack, setUndoStack] = useState([]);
  const [message, setMessage] = useState('');
  const [drag, setDrag] = useState(null); // { tableNo, col, row, width, height, valid } for the ghost
  const [resize, setResize] = useState(null); // { tableNo, width, height, seats, valid, ghost } while a handle is dragged

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const undoRef = useRef(undoStack);
  undoRef.current = undoStack;
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const occupiedRef = useRef({});
  occupiedRef.current = Object.fromEntries(tables.map((t) => [t.tableNo, t.occupancy?.seated ?? 0]));

  // Guides cover the lowest table plus two spare rows, so tables can be dragged further down.
  const rowCount = useMemo(() => {
    const bottom = Object.values(draft).reduce((max, p) => Math.max(max, p.row + p.height), 0);
    return Math.min(MAX_ROWS, Math.max(MIN_ROWS, bottom + 2));
  }, [draft]);
  const rowCountRef = useRef(rowCount);
  rowCountRef.current = rowCount;

  // Tables added or removed elsewhere while editing are ignored: only tables in the draft are drawn and saved.
  const visibleTables = useMemo(() => tables.filter((t) => draft[t.tableNo]), [tables, draft]);
  const changes = useMemo(() => {
    const live = new Set(tables.map((t) => t.tableNo));
    return diffPlacements(base, draft).filter((c) => live.has(c.tableNo));
  }, [base, draft, tables]);

  const pushUndo = useCallback((previous) => {
    setUndoStack((stack) => [...stack.slice(-(UNDO_LIMIT - 1)), previous]);
  }, []);

  const start = useCallback(() => {
    const snap = snapshot(tables);
    setBase(snap);
    setDraft(snap);
    setUndoStack([]);
    setMessage('');
    setDrag(null);
    setResize(null);
    dragRef.current = null;
    resizeRef.current = null;
    setEditing(true);
  }, [tables]);

  const stop = useCallback(() => {
    setEditing(false);
    setDraft({});
    setBase({});
    setUndoStack([]);
    setDrag(null);
    setResize(null);
    dragRef.current = null;
    resizeRef.current = null;
  }, []);

  // Moves a table to a cell if that spot is free. Used by drops and by the arrow keys.
  const commitMove = useCallback(
    (tableNo, col, row) => {
      const current = draftRef.current[tableNo];
      if (!current) return false;
      const target = { ...current, col, row };
      if (!isFree(target, othersOf(draftRef.current, tableNo), { columns: GRID_COLUMNS, rows: MAX_ROWS })) return false;
      if (col === current.col && row === current.row) return true;
      pushUndo(draftRef.current);
      setDraft({ ...draftRef.current, [tableNo]: target });
      setMessage(`Table ${tableNo} moved to column ${col + 1}, row ${row + 1}.`);
      return true;
    },
    [pushUndo]
  );

  const nudge = useCallback(
    (tableNo, dCol, dRow) => {
      const current = draftRef.current[tableNo];
      if (!current) return;
      if (!commitMove(tableNo, current.col + dCol, current.row + dRow)) {
        setMessage(`Table ${tableNo} cannot move there.`);
      }
    },
    [commitMove]
  );

  // ---- Pointer drag ----

  // Reads the cell size from the rendered grid, so nothing about the row height is hard-coded here.
  const measureCanvas = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    const gapX = parseFloat(cs.columnGap) || 0;
    const gapY = parseFloat(cs.rowGap) || 0;
    const rowHeight = parseFloat(cs.gridAutoRows) || 104;
    const inner = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    return { stepX: (inner - (GRID_COLUMNS - 1) * gapX) / GRID_COLUMNS + gapX, stepY: rowHeight + gapY };
  }, [canvasRef]);

  const startDrag = useCallback(
    (tableNo) => {
      const origin = draftRef.current[tableNo];
      const metrics = measureCanvas();
      if (!metrics || !origin) return null;
      const { stepX, stepY } = metrics;
      dragRef.current = { tableNo, origin, stepX, stepY, target: origin, valid: true, shown: null };
      return { stepX, stepY };
    },
    [measureCanvas]
  );

  // dx, dy: how far the pointer has moved since the drag started, in pixels.
  const dragTo = useCallback((tableNo, dx, dy) => {
    const d = dragRef.current;
    if (!d || d.tableNo !== tableNo) return;
    const { origin, stepX, stepY } = d;
    // The tile's top-left, nudged into the middle of its first cell, picks the nearest cell.
    const cell = cellFromPoint(origin.col * stepX + dx + stepX / 2, origin.row * stepY + dy + stepY / 2, { stepX, stepY });
    const raw = { ...origin, col: cell.col, row: cell.row };
    const limits = { columns: GRID_COLUMNS, rows: rowCountRef.current };
    const shownAt = clampPlacement(raw, limits);
    const valid = isFree(raw, othersOf(draftRef.current, tableNo), limits);
    d.target = shownAt;
    d.valid = valid;
    const last = d.shown;
    if (!last || last.col !== shownAt.col || last.row !== shownAt.row || last.valid !== valid) {
      d.shown = { col: shownAt.col, row: shownAt.row, valid };
      setDrag({ tableNo, col: shownAt.col, row: shownAt.row, width: origin.width, height: origin.height, valid });
    }
  }, []);

  // Ends the drag and says where the tile should settle. The draft is not changed until commitMove.
  const endDrag = useCallback((tableNo) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || d.tableNo !== tableNo) return null;
    const { target, origin, stepX, stepY, valid } = d;
    return { valid, col: target.col, row: target.row, snapDx: (target.col - origin.col) * stepX, snapDy: (target.row - origin.row) * stepY };
  }, []);

  const cancelDrag = useCallback(() => {
    dragRef.current = null;
    setDrag(null);
  }, []);

  // ---- Resize (handles and Shift+arrows) ----
  // Seats follow the long side (see seatsAfterResize). A size that is blocked or refused is never applied:
  // the tile stays at the last allowed size and the ghost turns red.

  const startResize = useCallback(
    (tableNo) => {
      const origin = draftRef.current[tableNo];
      const metrics = measureCanvas();
      if (!metrics || !origin) return false;
      resizeRef.current = { tableNo, origin, ...metrics, last: { width: origin.width, height: origin.height, seats: origin.seats }, shown: null };
      return true;
    },
    [measureCanvas]
  );

  // axis: 'e' (right edge). Only the width can change: the height is always TABLE_HEIGHT, so dy is ignored.
  // dx, dy: pixels moved since the drag started.
  const resizeTo = useCallback((tableNo, axis, dx, dy) => {
    const r = resizeRef.current;
    if (!r || r.tableNo !== tableNo) return;
    const { origin, stepX, stepY } = r;
    const width = axis.includes('e') ? origin.width + Math.round(dx / stepX) : origin.width;
    const height = TABLE_HEIGHT;
    const out = resizeOutcome({ origin, width, height, others: othersOf(draftRef.current, tableNo), occupied: occupiedRef.current[tableNo] ?? 0 });
    if (out.valid) r.last = { width, height, seats: out.seats };
    // The ghost shows the size being asked for, kept inside the grid so it never adds columns.
    const ghost = {
      col: origin.col,
      row: origin.row,
      width: clamp(width, 1, Math.min(UI_LIMITS.maxWidth, GRID_COLUMNS - origin.col)),
      height: clamp(height, 1, Math.min(UI_LIMITS.maxHeight, MAX_ROWS - origin.row)),
      valid: out.valid,
    };
    const key = `${r.last.width}x${r.last.height}:${ghost.width}x${ghost.height}:${out.valid}`;
    if (r.shown !== key) {
      r.shown = key;
      setResize({ tableNo, width: r.last.width, height: r.last.height, seats: r.last.seats, valid: out.valid, ghost });
    }
  }, []);

  // Ends the handle drag. With commit, the last allowed size becomes part of the draft.
  const endResize = useCallback(
    (tableNo, commit) => {
      const r = resizeRef.current;
      resizeRef.current = null;
      setResize(null);
      if (!commit || !r || r.tableNo !== tableNo) return;
      const { origin, last } = r;
      if (last.width === origin.width && last.height === origin.height) return;
      pushUndo(draftRef.current);
      setDraft({ ...draftRef.current, [tableNo]: { ...origin, ...last } });
      setMessage(`Table ${tableNo} resized to ${last.width} by ${last.height}, ${last.seats} seats.`);
    },
    [pushUndo]
  );

  // Shift+Left/Right: one cell narrower/wider, same limits as the handle. Shift+Up/Down does nothing: height is fixed.
  const resizeBy = useCallback(
    (tableNo, dWidth, dHeight) => {
      const current = draftRef.current[tableNo];
      if (!current) return;
      if (dWidth === 0) {
        if (dHeight !== 0) setMessage(`Table ${tableNo} is always ${TABLE_HEIGHT} rows tall. Only its width can change.`);
        return;
      }
      const width = current.width + dWidth;
      const height = TABLE_HEIGHT;
      const out = resizeOutcome({ origin: current, width, height, others: othersOf(draftRef.current, tableNo), occupied: occupiedRef.current[tableNo] ?? 0 });
      if (!out.valid) {
        setMessage(`Table ${tableNo} cannot be resized to ${width} by ${height}.`);
        return;
      }
      pushUndo(draftRef.current);
      setDraft({ ...draftRef.current, [tableNo]: { ...current, width, height, seats: out.seats } });
      setMessage(`Table ${tableNo} resized to ${width} by ${height}, ${out.seats} seats.`);
    },
    [pushUndo]
  );

  // The placement to draw: the draft, with the live size while a handle is being dragged.
  const placementOf = (tableNo) => {
    const p = draft[tableNo];
    if (p && resize && resize.tableNo === tableNo) return { ...p, width: resize.width, height: resize.height, seats: resize.seats };
    return p;
  };

  // ---- Undo and reset ----

  const undo = useCallback(() => {
    const stack = undoRef.current;
    if (stack.length === 0) return;
    setDraft(stack[stack.length - 1]);
    setUndoStack(stack.slice(0, -1));
    setMessage('Undid the last change.');
  }, []);

  const reset = useCallback(() => {
    pushUndo(draftRef.current);
    setDraft(base);
    setMessage('Layout reset to the saved version.');
  }, [base, pushUndo]);

  return {
    editing,
    draft,
    visibleTables,
    rowCount,
    drag,
    resize,
    ghost: drag ?? (resize ? { ...resize.ghost, tableNo: resize.tableNo } : null),
    placementOf,
    message,
    changes,
    dirty: changes.length > 0,
    canUndo: undoStack.length > 0,
    start,
    stop,
    undo,
    reset,
    nudge,
    commitMove,
    startDrag,
    dragTo,
    endDrag,
    cancelDrag,
    startResize,
    resizeTo,
    endResize,
    resizeBy,
  };
}
