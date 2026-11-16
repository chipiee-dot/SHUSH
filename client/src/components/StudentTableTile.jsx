import { Chairs } from './TableTile.jsx';
import './table-layout.css';
import './student-table.css';

/* Mouse-only tilt of at most 4 degrees, same feel as the faculty tiles. Off for touch and reduced motion. */
function tiltHandlers() {
  const canTilt = () =>
    window.matchMedia('(hover: hover)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    onPointerMove(e) {
      if (e.pointerType !== 'mouse' || e.currentTarget.disabled || !canTilt()) return;
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

// Which of the four looks a table gets. The server already decides `open`.
export function tableState(table) {
  if (table.underMaintenance) return 'maintenance';
  if (table.free <= 0) return 'full';
  if (table.free === 1) return 'last';
  return 'open';
}

const STATE_CLASS = {
  open: 'tl-s-QUIET', // calm gold ring
  last: 'tl-s-QUIET',
  full: 'tl-s-NO_DEVICE', // dashed border
  maintenance: 'tl-s-MAINTENANCE', // diagonal stripes
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * One table for the student picker. Looks like the faculty tile (tabletop, chairs along the top and
 * bottom edges) but shows only seats, never noise or device information.
 * Taken chairs are filled orange, free chairs are outlined. A <button>; full and maintenance are disabled.
 */
export default function StudentTableTile({ table, onPick }) {
  const state = tableState(table);
  const seats = Math.max(0, Math.floor(table.seats || 0));
  const taken = clamp(seats - (table.free || 0), 0, seats);
  const topCount = Math.ceil(seats / 2);
  const disabled = state === 'full' || state === 'maintenance';

  const label =
    state === 'maintenance'
      ? `Table ${table.tableNo}, under maintenance, not available`
      : state === 'full'
      ? `Table ${table.tableNo}, full, no seats free`
      : `Table ${table.tableNo}, ${table.free} of ${seats} seats free${state === 'last' ? ', last seat' : ''}`;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-haspopup="dialog"
      data-state={state}
      onClick={() => onPick(table.tableNo)}
      className={`tl-tile st-tile ${STATE_CLASS[state]}`}
      {...tiltHandlers()}
    >
      <Chairs count={topCount} firstIndex={0} occupied={taken} />
      <div className="tl-top">
        <span className="st-label">Table</span>
        <span className="st-no">{table.tableNo}</span>
        {state === 'last' && <span className="st-chip">Last seat</span>}
        {state === 'open' && <span className="st-note">{table.free} seats free</span>}
        {state === 'full' && <span className="st-note">Full</span>}
        {state === 'maintenance' && <span className="st-note">Under maintenance</span>}
      </div>
      <Chairs count={Math.max(0, seats - topCount)} firstIndex={topCount} occupied={taken} />
    </button>
  );
}

/** Placeholder while the first table list loads. */
export function StudentTableSkeleton({ count = 10 }) {
  return (
    <div role="status" aria-label="Loading tables" className="contents">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="st-skel" aria-hidden="true" />
      ))}
      <span className="sr-only">Loading tables…</span>
    </div>
  );
}

/**
 * The student's own table, for the seated view: every chair drawn, taken ones filled,
 * and one of them highlighted as theirs. `seats` is unknown until the table list has loaded.
 */
export function YourTable({ tableNo, seats, taken }) {
  const total = Math.max(0, Math.floor(seats || 0));
  const filled = clamp(taken || 0, 0, total);
  const topCount = Math.ceil(total / 2);
  // Chair 0 is the student's. Chairs use the same on/off classes as the picker.
  const chairs = (from, count) => (
    <div className="tl-chairs" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const idx = from + i;
        const cls = idx === 0 && filled > 0 ? 'tl-chair tl-chair--on tl-chair--mine' : `tl-chair ${idx < filled ? 'tl-chair--on' : ''}`;
        return <span key={idx} className={cls} />;
      })}
    </div>
  );

  return (
    <div className="st-mine tl-tile" role="img" aria-label={`Your table: Table ${tableNo}${total ? `, ${filled} of ${total} seats taken, one of them yours` : ''}`}>
      {total > 0 && chairs(0, topCount)}
      <div className="tl-top">
        <span className="st-label">Your table</span>
        <span className="st-no">{tableNo}</span>
      </div>
      {total > 0 && chairs(topCount, total - topCount)}
    </div>
  );
}
