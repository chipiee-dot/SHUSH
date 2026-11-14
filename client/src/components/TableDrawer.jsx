import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import StatusPill from './StatusPill.jsx';
import { MeterBar } from './charts.jsx';
import { meterColor, meterScale } from './TableTile.jsx';
import { STATUS_META, formatNumber, formatTime, timeAgo } from '../lib/format.js';

/**
 * Non-modal details panel: a side panel at 1024px+ and a bottom sheet below that.
 * Focus moves to the heading when it first opens. Closing (button or Esc) is handled by the parent,
 * which also returns focus to the tile.
 */
export default function TableDrawer({ table, isAdmin, onClose }) {
  const headingRef = useRef(null);

  // Runs on open only: the drawer stays mounted when polling refreshes or another tile is picked.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const { device } = table;
  const { level, threshold, max } = meterScale(device);
  const rows = [
    ['Status', STATUS_META[table.status].label],
    ['Seated', `${table.occupancy.groupSize} of ${table.seats}`],
    ['Session started', table.sessionStartedAt ? formatTime(table.sessionStartedAt) : 'No one seated'],
    ['Device', device ? device.code : 'Not connected'],
    ['Noise level', device ? formatNumber(level) : '—'],
    ['Alert threshold', device ? formatNumber(threshold) : '—'],
    ['Last seen', device ? timeAgo(device.lastSeenAt) : '—'],
  ];

  return (
    <aside
      aria-labelledby="tl-drawer-title"
      className="tl-drawer fixed inset-x-0 bottom-0 z-30 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-shush-line bg-shush-white p-5 shadow-[0_-16px_40px_-18px_rgba(242,95,19,0.45)] lg:sticky lg:top-0 lg:z-auto lg:max-h-none lg:w-96 lg:flex-none lg:self-start lg:rounded-2xl lg:shadow-[0_10px_30px_-18px_rgba(242,95,19,0.35)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="tl-drawer-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight text-shush-ink focus:outline-none"
          >
            Table {table.tableNo}
          </h2>
          <div className="mt-1.5">
            <StatusPill status={table.status} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close table details"
          className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-shush-lineStrong text-shush-inkSoft transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {device && (
        <div className="mt-4 rounded-xl bg-shush-cream p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-shush-inkSoft">
            <span>Noise level vs threshold</span>
            <span className="tabular-nums">
              {formatNumber(level)} / {formatNumber(threshold)}
            </span>
          </div>
          <MeterBar
            value={level}
            max={max}
            markerAt={device.threshold == null ? undefined : threshold}
            colorVar={meterColor(table.status)}
            label={`Table ${table.tableNo} noise level against its threshold`}
          />
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wider text-shush-muted">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-shush-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {device?.isSample && (
        <p className="mt-4 text-xs text-shush-orange700">
          Sample data: this device is not connected yet, so these readings are placeholders.
        </p>
      )}

      {isAdmin && (
        <Link
          to={`/console/settings?table=${table.tableNo}`}
          className="mt-5 inline-block rounded-xl bg-shush-orange600 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-shush-orange700 focus:outline-none focus:ring-2 focus:ring-shush-orange focus:ring-offset-2"
        >
          Edit table
        </Link>
      )}
    </aside>
  );
}
