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
import { NAV_ICONS } from '../../components/navIcons.jsx';
import usePolling from '../../hooks/usePolling.js';
import { formatNumber, timeAgo } from '../../lib/format.js';

const MAX_THRESHOLD = 4095;

// Same look as the buttons and fields on the Table layout and History pages.
const INPUT =
  'mt-1 block w-full rounded-xl border-shush-lineStrong bg-shush-white text-sm text-shush-ink focus:border-shush-orange focus:ring-shush-orange';
const SMALL_BTN =
  'rounded-xl bg-shush-orange600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-shush-orange700 active:bg-shush-orange700 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-shush-orange focus:ring-offset-2';
const GHOST_BTN =
  'rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-2 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';
const LIST = 'divide-y divide-shush-line overflow-hidden rounded-xl border border-shush-line bg-shush-white';
const ROW = 'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3';
const FOCUS_ROW = 'bg-shush-goldSoft';
const LABEL = 'block text-xs font-semibold uppercase tracking-wider text-shush-muted';

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
      <TableSettings focusNo={focusNo} onChanged={() => setTablesVersion((v) => v + 1)} />
      <DeviceSettings key={tablesVersion} focusNo={focusNo} />
      <SampleDataSettings />
    </div>
  );
}

function TableSettings({ focusNo, onChanged }) {
  const { data, error, loading, reload } = usePolling(api.adminTables, 0);
  const [editingNo, setEditingNo] = useState(focusNo); // one table is edited at a time; "Edit table" on the floor plan opens it
  const [drafts, setDrafts] = useState({}); // { [tableNo]: { number, seats, device } } while editing
  const [rowMessages, setRowMessages] = useState({});
  const [savingNo, setSavingNo] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTable, setNewTable] = useState({ tableNo: '', seats: '4' });
  const [addMessage, setAddMessage] = useState(null);
  const [adding, setAdding] = useState(false);

  const setMessage = (no, message) => setRowMessages((m) => ({ ...m, [no]: message }));
  const draftOf = (t) => ({
    number: String(t.tableNo),
    seats: String(t.seats),
    device: t.deviceCode ?? '',
    ...drafts[t.tableNo],
  });
  const setField = (t, field, value) =>
    setDrafts((d) => ({ ...d, [t.tableNo]: { ...draftOf(t), [field]: value } }));

  function openEdit(t) {
    setMessage(t.tableNo, null);
    setEditingNo(t.tableNo);
  }
  function closeEdit(t) {
    setEditingNo(null);
    setDrafts((d) => {
      const next = { ...d };
      delete next[t.tableNo];
      return next;
    });
  }

  // One Save for the table number, the seats and the device code.
  async function saveTable(t) {
    const d = draftOf(t);
    const seats = Number(d.seats);
    const newNo = Number(d.number);
    const device = d.device.trim();
    const renumbering = newNo !== t.tableNo;
    const seatsChanged = seats !== t.seats;
    const deviceChanged = device !== '' && device !== (t.deviceCode ?? '');

    if (!Number.isInteger(newNo) || newNo < 1 || newNo > 999) {
      setMessage(t.tableNo, { type: 'error', text: 'Table number: enter a whole number from 1 to 999.' });
      return;
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > 20) {
      setMessage(t.tableNo, { type: 'error', text: 'Seats: enter a whole number from 1 to 20.' });
      return;
    }
    if (device !== '' && !/^[A-Za-z0-9-]{1,20}$/.test(device)) {
      setMessage(t.tableNo, { type: 'error', text: 'Device code: use 1 to 20 letters, numbers or dashes, e.g. SHUSH-T03.' });
      return;
    }
    if (!renumbering && !seatsChanged && !deviceChanged) {
      closeEdit(t);
      return;
    }

    setSavingNo(t.tableNo);
    try {
      const done = [];
      if (deviceChanged) done.push((await api.assignDevice(t.tableNo, device)).message); // by the current number, before any rename
      if (renumbering) done.push((await api.updateTable(t.tableNo, { newTableNo: newNo, seats })).message);
      else if (seatsChanged) done.push((await api.setTableSeats(t.tableNo, seats)).message);
      setMessage(newNo, { type: 'success', text: done.join(' ') });
      closeEdit(t);
      if (renumbering || deviceChanged) onChanged?.(); // the device list below reloads
      reload();
    } catch (err) {
      setMessage(t.tableNo, { type: 'error', text: err.message });
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
      setShowAdd(false);
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
      subtitle="Press Edit to change a table's number, seats or device."
      action={
        !showAdd && (
          <button type="button" onClick={() => setShowAdd(true)} className={SMALL_BTN}>
            Add table
          </button>
        )
      }
    >
      {error && <Alert>{error}</Alert>}

      {showAdd && (
        <form onSubmit={addTable} className="mb-4 rounded-xl border border-dashed border-shush-lineStrong bg-shush-cream p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block w-32">
              <span className={LABEL}>Table number</span>
              <input
                className={INPUT}
                type="number"
                min={1}
                max={999}
                required
                autoFocus
                placeholder="e.g. 12"
                value={newTable.tableNo}
                onChange={(e) => setNewTable((t) => ({ ...t, tableNo: e.target.value }))}
              />
            </label>
            <label className="block w-28">
              <span className={LABEL}>Seats</span>
              <input
                className={INPUT}
                type="number"
                min={1}
                max={20}
                required
                value={newTable.seats}
                onChange={(e) => setNewTable((t) => ({ ...t, seats: e.target.value }))}
              />
            </label>
            <GlowButton type="submit" disabled={adding} className={SMALL_BTN}>
              {adding ? 'Adding…' : 'Add table'}
            </GlowButton>
            <button type="button" onClick={() => { setShowAdd(false); setAddMessage(null); }} className={GHOST_BTN}>
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-shush-inkSoft">The new table is placed automatically on the floor plan.</p>
          <div className="mt-2 empty:hidden">
            <Alert type={addMessage?.type ?? 'error'}>{showAdd ? addMessage?.text : ''}</Alert>
          </div>
        </form>
      )}
      {!showAdd && addMessage && (
        <div className="mb-4">
          <Alert type={addMessage.type}>{addMessage.text}</Alert>
        </div>
      )}

      {!data ? (
        <p className="text-sm text-shush-muted">{loading ? 'Loading tables…' : 'No tables to show.'}</p>
      ) : data.tables.length === 0 ? (
        <EmptyState title="No tables yet" text="Use Add table to start the floor plan." />
      ) : (
        <ul className={LIST}>
          {data.tables.map((t) => {
            const open = editingNo === t.tableNo;
            const d = draftOf(t);
            const note = rowMessages[t.tableNo];
            return (
              <li key={t.tableNo} className={t.tableNo === focusNo && !open ? FOCUS_ROW : ''}>
                <div className={ROW}>
                  <div className="w-28 flex-none text-sm font-semibold text-shush-ink">
                    Table {t.tableNo}
                    {t.isSample && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-shush-orange700" title="Sample data">
                        Sample
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-sm tabular-nums text-shush-inkSoft">
                    {t.seats} seats
                    <span className="text-shush-muted"> · {t.occupied} seated now</span>
                  </div>
                  <div className="w-40 flex-none">
                    {t.hasDevice ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-shush-lineStrong bg-shush-goldSoft px-2.5 py-0.5 font-mono text-xs text-shush-ink">
                        <span className="h-1.5 w-1.5 rounded-full bg-shush-success" aria-hidden="true" />
                        {t.deviceCode}
                      </span>
                    ) : (
                      <span className="text-xs text-shush-muted">No device</span>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => (open ? closeEdit(t) : openEdit(t))}
                    className={GHOST_BTN}
                  >
                    {open ? 'Close' : 'Edit'}
                  </button>
                </div>

                {!open && note && (
                  <p className={`px-4 pb-3 text-xs ${note.type === 'error' ? 'text-shush-danger' : 'text-shush-success'}`}>{note.text}</p>
                )}

                {open && (
                  <div className="border-t border-shush-line bg-shush-cream px-4 py-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="block w-28">
                        <span className={LABEL}>Table number</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={999}
                          aria-label={`Table number for table ${t.tableNo}`}
                          value={d.number}
                          onChange={(e) => setField(t, 'number', e.target.value)}
                          className={INPUT}
                        />
                      </label>
                      <label className="block w-24">
                        <span className={LABEL}>Seats</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={20}
                          aria-label={`Seats for table ${t.tableNo}`}
                          value={d.seats}
                          onChange={(e) => setField(t, 'seats', e.target.value)}
                          className={INPUT}
                        />
                      </label>
                      <label className="block w-48">
                        <span className={LABEL}>Device code</span>
                        <input
                          type="text"
                          maxLength={20}
                          autoComplete="off"
                          placeholder="e.g. SHUSH-T03"
                          aria-label={`Device code for table ${t.tableNo}`}
                          value={d.device}
                          onChange={(e) => setField(t, 'device', e.target.value)}
                          className={`${INPUT} font-mono`}
                        />
                      </label>
                      <div className="flex gap-2">
                        <GlowButton disabled={savingNo === t.tableNo} onClick={() => saveTable(t)} className={SMALL_BTN}>
                          {savingNo === t.tableNo ? 'Saving…' : 'Save'}
                        </GlowButton>
                        <button type="button" disabled={savingNo === t.tableNo} onClick={() => closeEdit(t)} className={GHOST_BTN}>
                          Cancel
                        </button>
                      </div>
                    </div>
                    {note && (
                      <p className={`mt-3 text-xs ${note.type === 'error' ? 'text-shush-danger' : 'text-shush-success'}`}>{note.text}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
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
      subtitle={`Noise level from 0 to ${formatNumber(MAX_THRESHOLD)} that raises an alert when it stays above for 5 seconds. Devices pick up a new value the next time they sync.`}
    >
      {error && <Alert>{error}</Alert>}
      {!data ? (
        <p className="text-sm text-shush-muted">{loading ? 'Loading devices…' : 'No devices to show.'}</p>
      ) : data.devices.length === 0 ? (
        <EmptyState title="No devices yet" text="Connect a device to a table above and it will appear here." />
      ) : (
        <ul className={LIST}>
          {data.devices.map((d) => {
            const draft = drafts[d.deviceCode] ?? String(d.threshold);
            const dirty = draft !== String(d.threshold);
            const note = rowMessages[d.deviceCode];
            return (
              <li key={d.deviceCode} className={d.tableNo === focusNo ? FOCUS_ROW : ''}>
                <div className={ROW}>
                  <div className="w-28 flex-none text-sm font-semibold text-shush-ink">Table {d.tableNo}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-shush-ink">
                      {d.deviceCode}
                      {d.isSample && (
                        <span className="ml-2 font-sans text-[10px] font-semibold uppercase tracking-wide text-shush-orange700">Sample</span>
                      )}
                    </div>
                    <div className="text-xs text-shush-muted">
                      Last level {formatNumber(d.lastLevel)} · seen {timeAgo(d.lastSeenAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_THRESHOLD}
                      step={1}
                      aria-label={`Threshold for ${d.deviceCode}`}
                      value={draft}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [d.deviceCode]: e.target.value }))}
                      className="w-24 rounded-xl border-shush-lineStrong bg-shush-white text-sm text-shush-ink focus:border-shush-orange focus:ring-shush-orange"
                    />
                    <GlowButton disabled={!dirty || savingCode === d.deviceCode} onClick={() => save(d)} className={SMALL_BTN}>
                      {savingCode === d.deviceCode ? 'Saving…' : 'Save'}
                    </GlowButton>
                  </div>
                </div>
                {note && (
                  <p className={`px-4 pb-3 text-xs ${note.type === 'error' ? 'text-shush-danger' : 'text-shush-success'}`}>{note.text}</p>
                )}
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
