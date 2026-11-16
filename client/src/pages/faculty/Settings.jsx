import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Alert from '../../components/Alert.jsx';
import Card from '../../components/Card.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import GlowButton from '../../components/GlowButton.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SampleBadge from '../../components/SampleBadge.jsx';
import { NAV_ICONS } from '../../components/navIcons.jsx';
import usePolling from '../../hooks/usePolling.js';
import { formatNumber, timeAgo } from '../../lib/format.js';

const MAX_THRESHOLD = 4095;

// Same look as the buttons and fields on the Table layout and History pages.
const PRIMARY_BTN =
  'rounded-xl bg-shush-orange600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-shush-orange700 active:bg-shush-orange700 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-shush-orange focus:ring-offset-2';
const INPUT =
  'mt-1 block w-full rounded-xl border-shush-lineStrong bg-shush-white text-sm text-shush-ink focus:border-shush-orange focus:ring-shush-orange';
const TILE = 'shush-rise rounded-xl border border-shush-line bg-shush-cream p-4 transition';
const TILE_FOCUS = 'border-shush-orange bg-shush-goldSoft ring-2 ring-shush-orange/40';
const LABEL = 'block text-xs font-semibold uppercase tracking-wider text-shush-muted';
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4';

const DEVICE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.55a11 11 0 0 1 14 0" />
    <path d="M8.5 16.05a6 6 0 0 1 7 0" />
    <path d="M12 20h.01" />
    <path d="M2 8.82a15 15 0 0 1 20 0" />
  </svg>
);
const TRASH_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

const rowNote = (message) =>
  message && (
    <p className={`mt-2 text-xs ${message.type === 'error' ? 'text-shush-danger' : 'text-shush-success'}`}>{message.text}</p>
  );

// Only administrators see the settings. The server checks the same rule on every request.
export default function Settings() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [tablesVersion, setTablesVersion] = useState(0); // bumps when a table number changes, so the device list reloads
  const focusNo = Number(params.get('table')) || null;
  if (user?.role !== 'Admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" icon={NAV_ICONS.settings} />
        <Card>
          <EmptyState
            title="Administrators only"
            text="Settings are available to administrators. If you should have access, ask an administrator to update your role."
          />
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        icon={NAV_ICONS.settings}
        subtitle="Tables, seats and device thresholds. Administrators only."
      />
      <TableSettings focusNo={focusNo} onRenumbered={() => setTablesVersion((v) => v + 1)} />
      <DeviceSettings key={tablesVersion} focusNo={focusNo} />
      <SampleDataSettings />
    </div>
  );
}

function TableSettings({ focusNo, onRenumbered }) {
  const { data, error, loading, reload } = usePolling(api.adminTables, 0);
  const [drafts, setDrafts] = useState({});
  const [numberDrafts, setNumberDrafts] = useState({}); // new table numbers, keyed by the current number
  const [rowMessages, setRowMessages] = useState({});
  const [savingNo, setSavingNo] = useState(null);
  const [newTable, setNewTable] = useState({ tableNo: '', seats: '4' });
  const [addMessage, setAddMessage] = useState(null);
  const [adding, setAdding] = useState(false);

  const setMessage = (no, message) => setRowMessages((m) => ({ ...m, [no]: message }));
  const without = (obj, key) => {
    const next = { ...obj };
    delete next[key];
    return next;
  };

  // Saves the seat count and/or the table number for one table.
  async function saveTable(table) {
    const seats = Number(drafts[table.tableNo] ?? String(table.seats));
    const newNo = Number(numberDrafts[table.tableNo] ?? String(table.tableNo));
    const renumbering = newNo !== table.tableNo;
    if (!Number.isInteger(seats) || seats < 1 || seats > 20) {
      setMessage(table.tableNo, { type: 'error', text: 'Seats: enter a whole number from 1 to 20.' });
      return;
    }
    if (!Number.isInteger(newNo) || newNo < 1 || newNo > 999) {
      setMessage(table.tableNo, { type: 'error', text: 'Table number: enter a whole number from 1 to 999.' });
      return;
    }
    setSavingNo(table.tableNo);
    try {
      const result = renumbering
        ? await api.updateTable(table.tableNo, { newTableNo: newNo, seats })
        : await api.setTableSeats(table.tableNo, seats);
      setMessage(table.tableNo, { type: 'success', text: result.message });
      setDrafts((d) => without(d, table.tableNo));
      setNumberDrafts((d) => without(d, table.tableNo));
      if (renumbering) onRenumbered?.();
      reload();
    } catch (err) {
      setMessage(table.tableNo, { type: 'error', text: err.message });
    } finally {
      setSavingNo(null);
    }
  }

  async function addTable(e) {
    e.preventDefault();
    setAddMessage(null);
    setAdding(true);
    try {
      const result = await api.addTable({ tableNo: newTable.tableNo, seats: newTable.seats });
      setAddMessage({ type: 'success', text: result.message });
      setNewTable({ tableNo: '', seats: '4' });
      reload();
    } catch (err) {
      setAddMessage({ type: 'error', text: err.message });
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card
      icon={NAV_ICONS.layout}
      title="Tables and seats"
      subtitle="Change a table's number or how many seats it has, or add a table by its number. The new table is placed automatically on the floor plan."
    >
      {error && <Alert>{error}</Alert>}
      {!data ? (
        <p className="text-sm text-shush-muted">{loading ? 'Loading tables…' : 'No tables to show.'}</p>
      ) : data.tables.length === 0 ? (
        <EmptyState title="No tables yet" text="Add the first table below to start the floor plan." />
      ) : (
        <ul className={GRID}>
          {data.tables.map((t, i) => {
            const seatsDraft = drafts[t.tableNo] ?? String(t.seats);
            const numberDraft = numberDrafts[t.tableNo] ?? String(t.tableNo);
            const dirty = seatsDraft !== String(t.seats) || numberDraft !== String(t.tableNo);
            return (
              <li
                key={t.tableNo}
                className={`${TILE} ${t.tableNo === focusNo ? TILE_FOCUS : ''}`}
                style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-shush-ink">Table {t.tableNo}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-shush-muted">
                      <span className="tabular-nums">{t.occupied} of {t.seats} seated now</span>
                      {t.isSample && <SampleBadge />}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      t.hasDevice
                        ? 'border-shush-lineStrong bg-shush-goldSoft text-shush-ink'
                        : 'border-shush-line bg-shush-white text-shush-muted'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${t.hasDevice ? 'bg-shush-success' : 'bg-shush-lineStrong'}`} aria-hidden="true" />
                    {t.hasDevice ? 'Device connected' : 'No device'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={LABEL}>Table number</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={999}
                      step={1}
                      aria-label={`Table number for table ${t.tableNo}`}
                      value={numberDraft}
                      onChange={(e) => setNumberDrafts((prev) => ({ ...prev, [t.tableNo]: e.target.value }))}
                      className={INPUT}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL}>Seats</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      step={1}
                      aria-label={`Seats for table ${t.tableNo}`}
                      value={seatsDraft}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [t.tableNo]: e.target.value }))}
                      className={INPUT}
                    />
                  </label>
                </div>

                {rowNote(rowMessages[t.tableNo])}

                <GlowButton
                  disabled={!dirty || savingNo === t.tableNo}
                  onClick={() => saveTable(t)}
                  className={`mt-4 w-full ${PRIMARY_BTN}`}
                >
                  {savingNo === t.tableNo ? 'Saving…' : 'Save changes'}
                </GlowButton>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={addTable} className="mt-6 rounded-xl border border-dashed border-shush-lineStrong bg-shush-cream p-4">
        <h3 className="text-sm font-semibold text-shush-ink">Add a new table</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={LABEL}>Table number</span>
            <input
              className={INPUT}
              type="number"
              min={1}
              max={999}
              required
              placeholder="e.g. 12"
              value={newTable.tableNo}
              onChange={(e) => setNewTable((t) => ({ ...t, tableNo: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Seats</span>
            <input
              className={INPUT}
              type="number"
              min={1}
              max={20}
              required
              placeholder="e.g. 6"
              value={newTable.seats}
              onChange={(e) => setNewTable((t) => ({ ...t, seats: e.target.value }))}
            />
          </label>
          <div className="flex items-end">
            <GlowButton type="submit" disabled={adding} className={`w-full ${PRIMARY_BTN}`}>
              {adding ? 'Adding…' : 'Add table'}
            </GlowButton>
          </div>
        </div>
        <div className="mt-3 empty:hidden">
          <Alert type={addMessage?.type ?? 'error'}>{addMessage?.text}</Alert>
        </div>
      </form>
    </Card>
  );
}

function DeviceSettings({ focusNo }) {
  const { data, error, loading, reload } = usePolling(api.devices, 0);
  const [drafts, setDrafts] = useState({});
  const [rowMessages, setRowMessages] = useState({});
  const [savingCode, setSavingCode] = useState(null);

  async function save(device) {
    const raw = drafts[device.deviceCode] ?? String(device.threshold);
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > MAX_THRESHOLD) {
      setRowMessages((m) => ({
        ...m,
        [device.deviceCode]: { type: 'error', text: `Enter a whole number from 0 to ${MAX_THRESHOLD}.` },
      }));
      return;
    }
    setSavingCode(device.deviceCode);
    try {
      const result = await api.saveThreshold(device.deviceCode, value);
      setRowMessages((m) => ({ ...m, [device.deviceCode]: { type: 'success', text: result.message } }));
      setDrafts((d) => {
        const next = { ...d };
        delete next[device.deviceCode];
        return next;
      });
      reload();
    } catch (err) {
      setRowMessages((m) => ({ ...m, [device.deviceCode]: { type: 'error', text: err.message } }));
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <Card
      icon={DEVICE_ICON}
      title="Device thresholds"
      subtitle={`Raw sensor level from 0 to ${formatNumber(MAX_THRESHOLD)}. A device raises an alert when noise stays above its threshold for 5 seconds. Devices pick up a new value the next time they sync.`}
    >
      {error && <Alert>{error}</Alert>}
      {!data ? (
        <p className="text-sm text-shush-muted">{loading ? 'Loading devices…' : 'No devices to show.'}</p>
      ) : data.devices.length === 0 ? (
        <EmptyState title="No devices yet" text="Devices appear here once they are registered to a table." />
      ) : (
        <ul className={GRID}>
          {data.devices.map((d, i) => {
            const draft = drafts[d.deviceCode] ?? String(d.threshold);
            const dirty = draft !== String(d.threshold);
            return (
              <li
                key={d.deviceCode}
                className={`${TILE} ${d.tableNo === focusNo ? TILE_FOCUS : ''}`}
                style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-shush-ink">Table {d.tableNo}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-shush-muted">{d.deviceCode}</span>
                    {d.isSample && <SampleBadge />}
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className={LABEL}>Last level</dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums text-shush-ink">{formatNumber(d.lastLevel)}</dd>
                  </div>
                  <div>
                    <dt className={LABEL}>Threshold</dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums text-shush-ink">{formatNumber(d.threshold)}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-shush-muted">Seen {timeAgo(d.lastSeenAt)}</p>

                <label className="mt-4 block">
                  <span className={LABEL}>New threshold</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_THRESHOLD}
                    step={1}
                    aria-label={`New threshold for ${d.deviceCode}`}
                    value={draft}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [d.deviceCode]: e.target.value }))}
                    className={INPUT}
                  />
                </label>

                {rowNote(rowMessages[d.deviceCode])}

                <GlowButton
                  disabled={!dirty || savingCode === d.deviceCode}
                  onClick={() => save(d)}
                  className={`mt-4 w-full ${PRIMARY_BTN}`}
                >
                  {savingCode === d.deviceCode ? 'Saving…' : 'Save threshold'}
                </GlowButton>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function SampleDataSettings() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function clear() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.clearSampleData();
      setMessage({ type: 'success', text: result.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Card
      icon={TRASH_ICON}
      title="Sample data"
      subtitle="The demo tables, devices, students and sessions are marked as sample data. Remove them once real tables and students are in use. Real records are never removed."
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-shush-line bg-shush-cream p-4">
        <p className="text-sm text-shush-inkSoft">Rewards and history will then show only real activity.</p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-xl bg-shush-danger px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-shush-danger/90 focus:outline-none focus:ring-2 focus:ring-shush-danger focus:ring-offset-2"
        >
          Remove sample data
        </button>
      </div>
      {message && (
        <div className="mt-4">
          <Alert type={message.type}>{message.text}</Alert>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title="Remove sample data?"
        tone="danger"
        confirmLabel="Yes, remove it"
        cancelLabel="Keep it"
        onConfirm={clear}
        onCancel={() => setConfirming(false)}
        busy={busy}
      >
        This deletes only the records marked as sample data. It cannot be undone.
      </ConfirmDialog>
    </Card>
  );
}
