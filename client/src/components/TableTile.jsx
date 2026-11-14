import { forwardRef } from 'react';
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

function Chairs({ count, firstIndex, occupied }) {
  return (
    <div className="tl-chairs" aria-hidden="true">
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

/**
 * One table. variant 'plan' is placed on the 12-column grid; 'list' is a full-width card for small screens.
 * dimmed fades the tile when a status filter is on (it stays in place so the layout does not jump).
 */
const TableTile = forwardRef(function TableTile({ table, selected, dimmed, onSelect, variant = 'plan' }, ref) {
  const { tableNo, seats, status, occupancy, device, grid } = table;
  const meta = STATUS_META[status] ?? STATUS_META.OFFLINE;
  const seated = occupancy.groupSize;
  const topCount = Math.ceil(seats / 2);
  const { level, threshold, max } = meterScale(device);

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

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(tableNo)}
      aria-pressed={selected}
      aria-label={label}
      style={placement}
      className={`tl-tile tl-s-${status} ${dimmed ? 'tl-dim' : ''}`}
      {...(variant === 'plan' ? tiltHandlers() : {})}
    >
      {variant === 'plan' ? (
        <>
          <Chairs count={topCount} firstIndex={0} occupied={seated} />
          <div className="tl-top">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-shush-muted">Table</span>
              <span className="text-2xl font-bold leading-none text-shush-ink">{tableNo}</span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="tl-pill">
                <StatusPill status={status} />
              </span>
              <span className="flex-none text-[11px] font-medium tabular-nums text-shush-inkSoft">
                {seated}/{seats}
              </span>
            </div>
            {meter}
          </div>
          <Chairs count={seats - topCount} firstIndex={topCount} occupied={seated} />
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
    </button>
  );
});

export default TableTile;
