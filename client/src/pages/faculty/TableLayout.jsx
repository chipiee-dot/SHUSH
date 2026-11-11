import { useState } from 'react';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import Card from '../../components/Card.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import usePolling from '../../hooks/usePolling.js';
import { STATUS_META, formatNumber, formatTime, timeAgo } from '../../lib/format.js';

const REFRESH_MS = 5000;
const ROW_HEIGHT = '6.5rem';
const LEGEND = ['QUIET', 'LOUD', 'ALERT', 'MAINTENANCE', 'OFFLINE', 'NO_DEVICE'];

function SeatDots({ seats, occupied }) {
  return (
    <div className="flex flex-wrap gap-1" aria-hidden="true">
      {Array.from({ length: seats }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full border ${
            i < occupied ? 'border-[#1b2d5a] bg-[#1b2d5a]' : 'border-slate-300 bg-white'
          }`}
        />
      ))}
    </div>
  );
}

function TableTile({ table, selected, onSelect }) {
  const meta = STATUS_META[table.status];
  const { col, row, width, height } = table.grid;
  return (
    <button
      type="button"
      onClick={() => onSelect(table.tableNo)}
      aria-pressed={selected}
      style={{ gridColumn: `${col + 1} / span ${width}`, gridRow: `${row + 1} / span ${height}` }}
      className={`flex min-w-0 flex-col justify-between rounded-2xl border border-l-4 bg-white p-3 text-left shadow-sm transition hover:shadow-md ${meta.edge} ${
        selected ? 'border-[#1b2d5a] ring-2 ring-[#1b2d5a]/30' : 'border-[#d6cfbe]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold text-[#152549]">Table {table.tableNo}</span>
        <StatusPill status={table.status} />
      </div>
      <div className="space-y-1.5">
        <SeatDots seats={table.seats} occupied={table.occupancy.groupSize} />
        <div className="truncate text-xs text-slate-500">
          {table.occupancy.groupSize}/{table.seats} seated
          {table.device ? ` · ${table.device.code}` : ' · no device'}
        </div>
      </div>
    </button>
  );
}

function TableDetails({ table }) {
  const rows = [
    ['Status', STATUS_META[table.status].label],
    ['Seated', `${table.occupancy.groupSize} of ${table.seats}`],
    ['Session started', table.sessionStartedAt ? formatTime(table.sessionStartedAt) : 'No one seated'],
    ['Device', table.device ? table.device.code : 'Not connected'],
    ['Noise level', table.device ? formatNumber(table.device.level) : '—'],
    ['Alert threshold', table.device ? formatNumber(table.device.threshold) : '—'],
    ['Last seen', table.device ? timeAgo(table.device.lastSeenAt) : '—'],
  ];
  return (
    <Card title={`Table ${table.tableNo}`} subtitle="Selected table">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-[#152549]">{value}</dd>
          </div>
        ))}
      </dl>
      {table.device?.isSample && (
        <p className="mt-4 text-xs text-amber-800">
          Sample data: this device is not connected yet, so these readings are placeholders.
        </p>
      )}
    </Card>
  );
}

export default function TableLayout() {
  const { data, error, loading, updatedAt } = usePolling(api.layout, REFRESH_MS);
  const [selectedNo, setSelectedNo] = useState(null);

  if (!data) {
    return loading ? (
      <p className="text-sm text-slate-500">Loading floor plan…</p>
    ) : (
      <Alert>{error || 'Could not load the table layout.'}</Alert>
    );
  }

  const { tables, sample } = data;
  const selected = tables.find((t) => t.tableNo === selectedNo) ?? null;
  const seatedTotal = tables.reduce((sum, t) => sum + t.occupancy.groupSize, 0);
  const seatTotal = tables.reduce((sum, t) => sum + t.seats, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Table layout"
        sample={sample}
        subtitle={`Live · updated ${formatTime(updatedAt)} · ${seatedTotal} of ${seatTotal} seats taken`}
      />

      {error && <Alert>{error}</Alert>}

      <Card>
        <ul className="mb-5 flex flex-wrap gap-2" aria-label="Status key">
          {LEGEND.map((key) => (
            <li key={key}>
              <StatusPill status={key} />
            </li>
          ))}
        </ul>

        {tables.length === 0 ? (
          <p className="text-sm text-slate-500">No tables are set up yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[700px] grid-cols-12 gap-3"
              style={{ gridAutoRows: ROW_HEIGHT }}
              role="group"
              aria-label="Floor plan"
            >
              {tables.map((t) => (
                <TableTile
                  key={t.tableNo}
                  table={t}
                  selected={t.tableNo === selectedNo}
                  onSelect={(no) => setSelectedNo(no === selectedNo ? null : no)}
                />
              ))}
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Click a table to see its details. Filled seats are students currently seated.
        </p>
      </Card>

      {selected && <TableDetails table={selected} />}
    </div>
  );
}
