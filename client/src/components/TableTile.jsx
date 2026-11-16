import { forwardRef, useEffect, useRef } from 'react';
import StatusPill from './StatusPill.jsx';
import { MeterBar } from './charts.jsx';
import { STATUS_META, formatNumber } from '../lib/format.js';

const METER_COLOR = {
  QUIET: '--shush-success',
  LOUD: '--shush-amber',
  ALERT: '--shush-danger',
  MAINTENANCE: '--shush-orange-soft',
  OFFLINE: '--shush-muted',
  NO_DEVICE: '--shush-line-strong',
};

// Noise bar scale shared by the tile and the drawer.
export function meterScale(device) {
  const level = Number(device?.level) || 0;
  const threshold = Number(device?.threshold) || 0;
  return { level, threshold, max: Math.max(threshold * 1.5, level * 1.1, 1) };
}

export function meterColor(status) {
  return METER_COLOR[status] ?? '--shush-orange';
}

/** A row of chairs. side 'h' (default) lays them out left to right; 'v' stacks them top to bottom (tall tables). */
export function Chairs({ count, firstIndex, occupied, side = 'h' }) {
  return (
    <div className={`tl-chairs ${side === 'v' ? 'tl-chairs--v' : ''}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`tl-chair ${firstIndex + i < occupied ? 'tl-chair--on' : ''}`} />
      ))}
    </div>
  );
}

function tiltHandlers() {
  const canTilt = () =>
    window.matchMedia('(hover: hover)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    onPointerMove(e) {
      if (e.pointerType !== 'mouse' || !canTilt()) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
    },
    onPointerLeave(e) {
      e.currentTarget.style.removeProperty('--rx');
      e.currentTarget.style.removeProperty('--ry');
    },
  };
}

const DRAG_THRESHOLD = 4; // pixels before a press becomes a drag, so a plain click is not a drag
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
// Resize handles: the right edge, the bottom edge and the corner.
const HANDLES = [
  ['e', 'tl-handle--e', 'ew-resize'],
  ['s', 'tl-handle--s', 'ns-resize'],
  ['se', 'tl-handle--se', 'nwse-resize'],
];
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One table. variant 'plan' is placed on the 12-column grid; 'list' is a full-width card for small screens.
 * dimmed fades the tile when a status filter is on (it stays in place so the layout does not jump).
 * edit (admin floor-plan editing, plan variant only): the editor from useLayoutEditor. The tile then becomes a
 * draggable group: pointer drag with snap, and arrow keys to move one cell. Dragging moves it with transform only.
 * In edit mode it also has resize handles (right edge, bottom edge, corner) and Shift+arrow keys to resize.
 * Tables taller than wide put their chairs on the left and right edges.
 */
const TableTile = forwardRef(function TableTile({ table, selected, dimmed, onSelect, edit, variant = 'plan' }, ref) {
  const { tableNo, seats, status, occupancy, device, grid } = table;
  const meta = STATUS_META[status] ?? STATUS_META.OFFLINE;
  const seated = occupancy.seated;
  const topCount = Math.ceil(seats / 2);
  const { level, threshold, max } = meterScale(device);

  const dragRef = useRef(null);
  // If the tile goes away mid-drag (Cancel, Save), stop listening for Esc.
  useEffect(
    () => () => {
      if (dragRef.current?.onKey) window.removeEventListener('keydown', dragRef.current.onKey);
    },
    []
  );

  const resizeRef = useRef(null);
  useEffect(
    () => () => {
      if (resizeRef.current?.onKey) window.removeEventListener('keydown', resizeRef.current.onKey);
    },
    []
  );

  function finishResize(commit) {
    const r = resizeRef.current;
    if (!r) return;
    window.removeEventListener('keydown', r.onKey);
    resizeRef.current = null;
    edit.endResize(tableNo, commit);
  }

  // Props for one handle. The pointer is captured on the handle, and events stop here so the tile does not start a move.
  const handleProps = (axis) => ({
    onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.stopPropagation();
      if (!edit.startResize(tableNo)) return;
      const r = { id: e.pointerId, x: e.clientX, y: e.clientY };
      // Esc puts the size back to what it was.
      r.onKey = (ev) => {
        if (ev.key !== 'Escape') return;
        ev.preventDefault();
        finishResize(false);
      };
      window.addEventListener('keydown', r.onKey);
      resizeRef.current = r;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove(e) {
      e.stopPropagation();
      const r = resizeRef.current;
      if (!r || r.id !== e.pointerId) return;
      edit.resizeTo(tableNo, axis, e.clientX - r.x, e.clientY - r.y);
    },
    onPointerUp(e) {
      e.stopPropagation();
      if (resizeRef.current?.id === e.pointerId) finishResize(true);
    },
    onPointerCancel(e) {
      e.stopPropagation();
      if (resizeRef.current?.id === e.pointerId) finishResize(false);
    },
  });

  // Springs the tile to where it lands (or back to where it started), then updates the draft.
  function settle(d, commit) {
    window.removeEventListener('keydown', d.onKey);
    dragRef.current = null;
    let result = null;
    if (commit) result = edit.endDrag(tableNo);
    else edit.cancelDrag();
    const ok = Boolean(result?.valid);
    const el = d.el;
    const finish = () => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.zIndex = '';
      delete el.dataset.lifting;
      if (ok) edit.commitMove(tableNo, result.col, result.row);
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    el.style.transition = 'transform 180ms cubic-bezier(0.2, 0.9, 0.3, 1.2)';
    el.style.transform = ok ? `translate(${result.snapDx}px, ${result.snapDy}px)` : 'translate(0px, 0px)';
    setTimeout(finish, 190);
  }

  const editHandlers = edit && {
    onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, started: false, el: e.currentTarget };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove(e) {
      const d = dragRef.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.started) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!edit.startDrag(tableNo)) {
          dragRef.current = null;
          return;
        }
        d.started = true;
        d.el.dataset.lifting = '1';
        d.el.style.transition = 'none';
        d.el.style.zIndex = '20';
        // Esc puts the tile back where it started.
        d.onKey = (ev) => {
          if (ev.key !== 'Escape') return;
          ev.preventDefault();
          settle(d, false);
        };
        window.addEventListener('keydown', d.onKey);
      }
      const tilt = prefersReducedMotion() ? 0 : 1.2;
      d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.03) rotate(${tilt}deg)`;
      edit.dragTo(tableNo, dx, dy);
    },
    onPointerUp(e) {
      const d = dragRef.current;
      if (!d || d.id !== e.pointerId) return;
      if (d.started) settle(d, true);
      else dragRef.current = null;
    },
    onPointerCancel(e) {
      const d = dragRef.current;
      if (!d || d.id !== e.pointerId) return;
      if (d.started) settle(d, false);
      else dragRef.current = null;
    },
    onKeyDown(e) {
      if (e.altKey || e.ctrlKey || e.metaKey || dragRef.current?.started || resizeRef.current) return;
      const dir = ARROWS[e.key];
      if (!dir) return;
      e.preventDefault();
      // Arrows move; Shift + arrows resize (Right/Left change the width, Down/Up the height).
      if (e.shiftKey) edit.resizeBy(tableNo, dir[0], dir[1]);
      else edit.nudge(tableNo, dir[0], dir[1]);
    },
  };

  const label = `Table ${tableNo}, ${meta.label}, ${seated} of ${seats} seated${
    device ? `, noise ${formatNumber(level)} of ${formatNumber(threshold)}` : ', no device'
  }`;

  const placement =
    variant === 'plan'
      ? { gridColumn: `${grid.col + 1} / span ${grid.width}`, gridRow: `${grid.row + 1} / span ${grid.height}` }
      : undefined;

  const meter = device && (
    <MeterBar
      value={level}
      max={max}
      markerAt={device.threshold == null ? undefined : threshold}
      colorVar={meterColor(status)}
      label={`Table ${tableNo} noise level against its threshold`}
      className="!py-0.5"
    />
  );

  // Chairs go on the two longer sides: top and bottom, or left and right when the table is taller than wide.
  const vertical = variant === 'plan' && grid.height > grid.width;
  const chairSide = vertical ? 'v' : 'h';
  const resizingThis = Boolean(edit && edit.resize && edit.resize.tableNo === tableNo);
  const Tag = edit ? 'div' : 'button';
  const tagProps = edit
    ? {
        role: 'group',
        tabIndex: 0,
        'aria-roledescription': 'draggable table',
        'aria-label': `${label}, ${grid.width} by ${grid.height}. Drag to move it, or use the arrow keys. Hold Shift to resize.`,
        ...editHandlers,
      }
    : {
        type: 'button',
        onClick: () => onSelect(tableNo),
        'aria-pressed': selected,
        'aria-label': label,
        ...(variant === 'plan' ? tiltHandlers() : {}),
      };

  return (
    <Tag
      ref={ref}
      style={placement}
      className={`tl-tile tl-s-${status} ${dimmed ? 'tl-dim' : ''} ${edit ? 'tl-edit' : ''} ${variant === 'plan' ? 'tl-plan' : ''} ${vertical ? 'tl-tile--v' : ''}`}
      data-resizing={resizingThis ? '1' : undefined}
      {...tagProps}
    >
      {variant === 'plan' ? (
        <>
          <Chairs count={topCount} firstIndex={0} occupied={seated} side={chairSide} />
          <div className="tl-top">
            <div className="flex items-baseline gap-1">
              <span className="tl-word text-[10px] font-semibold uppercase tracking-wider text-shush-muted">Table</span>
              <span className="text-2xl font-bold leading-none text-shush-ink">{tableNo}</span>
            </div>
            <div className="tl-row flex items-center justify-between gap-1">
              <span className="tl-pill">
                <StatusPill status={status} />
              </span>
              <span className="tl-count flex-none text-[11px] font-medium tabular-nums text-shush-inkSoft">
                {seated}/{seats}
              </span>
            </div>
            {meter && <div className="tl-meter">{meter}</div>}
          </div>
          <Chairs count={seats - topCount} firstIndex={topCount} occupied={seated} side={chairSide} />
          {edit && (
            <>
              {HANDLES.map(([axis, cls, cursor]) => (
                <div key={axis} className={`tl-handle ${cls}`} style={{ cursor }} aria-hidden="true" {...handleProps(axis)}>
                  <span className="tl-grip" />
                </div>
              ))}
              {resizingThis && (
                <div className="tl-badge" aria-hidden="true">
                  {edit.resize.seats} {edit.resize.seats === 1 ? 'seat' : 'seats'}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-bold text-shush-ink">Table {tableNo}</span>
            <StatusPill status={status} />
          </div>
          <Chairs count={seats} firstIndex={0} occupied={seated} />
          <div className="text-xs text-shush-inkSoft">
            {seated} of {seats} seated{device ? ` · ${device.code}` : ' · no device'}
          </div>
          {meter}
        </div>
      )}
    </Tag>
  );
});

export default TableTile;
