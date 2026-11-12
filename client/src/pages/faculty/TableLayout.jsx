import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Alert from '../../components/Alert.jsx';
import Card from '../../components/Card.jsx';
import GlowButton from '../../components/GlowButton.jsx';
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
            i < occupied ? 'border-[#1e40af] bg-[#1e40af]' : 'border-slate-300 bg-white'
          }`}
        />
      ))}
    </div>
  );
}

function TableTile({ table, selected, onSelect }) {
  const { col, row, width, height } = table.grid;
  const free = table.seats - table.occupancy.groupSize;
  return (
    <button
      type="button"
      onClick={() => onSelect(table.tableNo)}
      aria-pressed={selected}
      style={{ gridColumn: `${col + 1} / span ${width}`, gridRow: `${row + 1} / span ${height}` }}
      className={`flex min-w-0 flex-col justify-between rounded-2xl bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
        selected ? 'ring-2 ring-[#1e40af]' : 'ring-1 ring-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Table</div>
          <div className="text-2xl font-bold text-slate-900">{table.tableNo}</div>
        </div>
        <StatusPill status={table.status} />
      </div>
      <div className="space-y-2">
        <SeatDots seats={table.seats} occupied={table.occupancy.groupSize} />
        <div className="truncate text-xs font-medium text-slate-500">
          {free} of {table.seats} seats free
          {table.device ? ` · ${table.device.code}` : ' · no device'}
        </div>
      </div>
    </button>
  );
}

function TableDetails({ table, isAdmin }) {
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
    <Card
      title={`Table ${table.tableNo}`}
      subtitle="Selected table"
      action={
        isAdmin && (
          <Link
            to={`/console/settings?table=${table.tableNo}`}
            className="rounded-xl bg-[#1e40af] px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2"
          >
            Edit table
          </Link>
        )
      }
    >
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">{label}</dt>
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
  const { user } = useAuth();
  const { data, error, loading, updatedAt } = usePolling(api.layout, REFRESH_MS);
  const [selectedNo, setSelectedNo] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState({ tableNo: '', seats: '4' });
  const [addError, setAddError] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  const isAdmin = user?.role === 'Admin';

  // Debug: log user object to console
  console.log('TableLayout - User:', user);
  console.log('TableLayout - isAdmin:', isAdmin);

  async function handleAddTable(e) {
    e.preventDefault();
    setAddError('');
    setAddBusy(true);
    try {
      const body = { tableNo: addFormData.tableNo, seats: addFormData.seats };
      await api.addTable(body);
      setShowAddForm(false);
      setAddFormData({ tableNo: '', seats: '4' });
      // Reload is handled by polling
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddBusy(false);
    }
  }

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
      >
        {isAdmin && (
          <GlowButton
            onClick={() => setShowAddForm(true)}
            className="rounded-xl bg-[#1e40af] px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2"
          >
            Add table
          </GlowButton>
        )}
      </PageHeader>

      {error && <Alert>{error}</Alert>}

      {showAddForm && (
        <Card title="Add a new table" subtitle="Table will be placed automatically on the floor plan">
          <form onSubmit={handleAddTable} className="space-y-4">
            <Alert>{addError}</Alert>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Table number <span className="text-red-600">*</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  required
                  value={addFormData.tableNo}
                  onChange={(e) => setAddFormData((d) => ({ ...d, tableNo: e.target.value }))}
                  className="mt-1 block w-full rounded-xl border-slate-200 bg-white text-sm focus:border-[#1e40af] focus:ring-[#1e40af]"
                  placeholder="e.g. 12"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Seats <span className="text-red-600">*</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={addFormData.seats}
                  onChange={(e) => setAddFormData((d) => ({ ...d, seats: e.target.value }))}
                  className="mt-1 block w-full rounded-xl border-slate-200 bg-white text-sm focus:border-[#1e40af] focus:ring-[#1e40af]"
                  placeholder="e.g. 6"
                />
              </label>
            </div>
            <div className="flex gap-3">
              <GlowButton
                type="submit"
                disabled={addBusy}
                className="rounded-xl bg-[#1e40af] px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-[#1e3a8a] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2"
              >
                {addBusy ? 'Adding…' : 'Add table'}
              </GlowButton>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setAddError('');
                  setAddFormData({ tableNo: '', seats: '4' });
                }}
                disabled={addBusy}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-[#1e40af] transition hover:bg-slate-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <ul className="mb-5 flex flex-wrap gap-2" aria-label="Status key">
          {LEGEND.map((key) => (
            <li key={key}>
              <StatusPill status={key} />
            </li>
          ))}
        </ul>

        {tables.length === 0 ? (
          <p className="text-sm text-slate-600">No tables are set up yet. {isAdmin && 'Add the first one above.'}</p>
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
        <p className="mt-4 text-xs text-slate-600">
          Click a table to see its details. Filled seats are students currently seated.
          {isAdmin && (
            <>
              {' '}
              <Link
                to="/console/settings"
                className="font-medium text-[#1e40af] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-1 rounded"
              >
                Edit seat counts in Settings
              </Link>
              .
            </>
          )}
        </p>
      </Card>

      {selected && <TableDetails table={selected} isAdmin={user?.role === 'Admin'} />}
    </div>
  );
}
