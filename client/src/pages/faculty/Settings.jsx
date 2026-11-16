import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Card from '../../components/Card.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import GlowButton from '../../components/GlowButton.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Stat from '../../components/Stat.jsx';
import { useErrorToast, useToast } from '../../components/Toast.jsx';
import { NAV_ICONS } from '../../components/navIcons.jsx';
import usePolling from '../../hooks/usePolling.js';
import { formatNumber, timeAgo } from '../../lib/format.js';
import './settings.css';

const MAX_THRESHOLD = 4095;
const DEVICE_RE = /^[A-Za-z0-9-]{1,20}$/;

// Same look as the buttons and fields on the Table layout and History pages.
const INPUT =
  'mt-1 block w-full rounded-xl border-shush-lineStrong bg-shush-white text-sm text-shush-ink focus:border-shush-orange focus:ring-shush-orange';
const INPUT_BAD = '!border-shush-danger focus:!border-shush-danger focus:!ring-shush-danger';
const SMALL_BTN =
  'rounded-xl bg-shush-orange600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-shush-orange700 active:bg-shush-orange700 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-shush-orange focus:ring-offset-2';
const GHOST_BTN =
  'rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-2 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';
const LIST = 'divide-y divide-shush-line overflow-hidden rounded-xl border border-shush-line bg-shush-white';
const FOCUS_ROW = 'bg-shush-goldSoft';
const LABEL = 'block text-xs font-semibold uppercase tracking-wider text-shush-muted';
const SAMPLE_TAG = 'text-[10px] font-semibold uppercase tracking-wide text-shush-orange700';

const icon = (children) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const DEVICE_ICON = icon(
  <>
    <path d="M5 12.55a11 11 0 0 1 14 0" />
    <path d="M8.5 16.05a6 6 0 0 1 7 0" />
    <path d="M12 20h.01" />
    <path d="M2 8.82a15 15 0 0 1 20 0" />
  </>
);
const TRASH_ICON = icon(
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </>
);
const USERS_ICON = icon(
  <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="10" cy="7" r="4" />
    <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
);
const SEAT_ICON = icon(
  <>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M4 14h16" />
  </>
);
const ALERT_ICON = icon(
  <>
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </>
);
const INFO_ICON = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </>
);

// Only administrators see the settings. The server checks the same rule on every request.
export default function Settings() {
  const { user } = useAuth();
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
  return <AdminSettings />;
}

function AdminSettings() {
  const [params] = useSearchParams();
  const focusNo = Number(params.get('table')) || null; // "Edit table" on the floor plan opens that table here
  const [editingNo, setEditingNo] = useState(focusNo); // one table is edited at a time
  const tablesQ = usePolling(api.adminTables, 0);
  const devicesQ = usePolling(api.devices, 0);
  useErrorToast(tablesQ.error);
  useErrorToast(devicesQ.error);

  const tables = tablesQ.data?.tables ?? [];
  const devices = devicesQ.data?.devices ?? [];
  const reloadAll = () => {
    tablesQ.reload();
    devicesQ.reload();
  };

  // Jump to a table from the "Needs attention" list.
  function openTable(no) {
    setEditingNo(no);
    setTimeout(() => {
      const el = document.getElementById(`settings-table-${no}`);
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    }, 60);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        icon={NAV_ICONS.settings}
        subtitle="Tables, seats and device thresholds. Administrators only."
      />

      <Overview tables={tables} loaded={Boolean(tablesQ.data)} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="min-w-0 space-y-6">
          <TableSettings
            q={tablesQ}
            devices={devices}
            editingNo={editingNo}
            setEditingNo={setEditingNo}
            focusNo={focusNo}
            onChanged={reloadAll}
          />
          <DeviceSettings q={devicesQ} focusNo={focusNo} />
        </div>
        <aside className="min-w-0 space-y-6 xl:sticky xl:top-6">
          <AttentionCard tables={tables} devices={devices} onOpen={openTable} />
          <GuideCard />
          <SampleDataSettings onCleared={reloadAll} />
        </aside>
      </div>
    </div>
  );
}

// ---- Overview ------------------------------------------------------------------

function Overview({ tables, loaded }) {
  const seatTotal = tables.reduce((sum, t) => sum + (t.seats || 0), 0);
  const seated = tables.reduce((sum, t) => sum + (t.occupied || 0), 0);
  const withDevice = tables.filter((t) => t.hasDevice).length;
  const sampleCount = tables.filter((t) => t.isSample).length;
  const missing = tables.length - withDevice;
  const dash = '—';

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat
        label="Tables"
        icon={NAV_ICONS.layout}
        value={loaded ? tables.length : dash}
        hint={loaded ? (sampleCount ? `${sampleCount} sample` : 'On the floor plan') : undefined}
      />
      <Stat label="Seats" icon={SEAT_ICON} value={loaded ? seatTotal : dash} hint={loaded ? 'Across all tables' : undefined} />
      <Stat
        label="Seated now"
        icon={USERS_ICON}
        value={loaded ? seated : dash}
        progress={loaded && seatTotal ? seated / seatTotal : undefined}
        hint={loaded && seatTotal ? `${Math.round((seated / seatTotal) * 100)}% of seats` : undefined}
      />
      <Stat
        label="Devices"
        icon={DEVICE_ICON}
        value={loaded ? `${withDevice} / ${tables.length}` : dash}
        progress={loaded && tables.length ? withDevice / tables.length : undefined}
        hint={loaded ? (missing > 0 ? `${missing} table${missing === 1 ? '' : 's'} need one` : 'Every table has one') : undefined}
      />
    </div>
  );
}

// ---- Tables and seats ------------------------------------------------------------

function SeatDots({ seats, occupied }) {
  const shown = Math.min(seats, 12);
  return (
    <span className="inline-flex flex-wrap items-center gap-1" role="img" aria-label={`${occupied} of ${seats} seats taken`}>
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${i < occupied ? 'bg-shush-orange' : 'border border-shush-lineStrong bg-shush-white'}`}
        />
      ))}
      {seats > shown && <span className="text-[10px] text-shush-muted">+{seats - shown}</span>}
    </span>
  );
}

function Chip({ active, count, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2 ${
        active
          ? 'border-shush-orange bg-shush-goldSoft text-shush-ink'
          : 'border-shush-lineStrong bg-shush-white text-shush-inkSoft hover:bg-shush-creamDeep'
      }`}
    >
      {children}
      <span className="tabular-nums text-shush-muted">{count}</span>
    </button>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <label className="block min-w-0">
      <span className={LABEL}>{label}</span>
      {children}
      <span className={`mt-1 block text-[11px] leading-snug ${error ? 'text-shush-danger' : 'text-shush-muted'}`}>{error || hint}</span>
    </label>
  );
}

// What an edit would change, and what is wrong with it. Used to enable Save and to list pending changes.
function inspect(t, d) {
  const newNo = Number(d.number);
  const seats = Number(d.seats);
  const device = d.device.trim();
  const errors = {};
  if (d.number.trim() === '' || !Number.isInteger(newNo) || newNo < 1 || newNo > 999) errors.number = 'Use a whole number from 1 to 999.';
  if (d.seats.trim() === '' || !Number.isInteger(seats) || seats < 1 || seats > 20) errors.seats = 'Use a whole number from 1 to 20.';
  if (device !== '' && !DEVICE_RE.test(device)) errors.device = 'Use 1 to 20 letters, numbers or dashes.';
  const changes = [];
  if (!errors.number && newNo !== t.tableNo) changes.push(`Number ${t.tableNo} → ${newNo}`);
  if (!errors.seats && seats !== t.seats) changes.push(`Seats ${t.seats} → ${seats}`);
  if (!errors.device && device !== '' && device !== (t.deviceCode ?? '')) changes.push(`Device ${t.deviceCode ?? 'none'} → ${device}`);
  return { errors, changes, newNo, seats, device };
}

function TableSettings({ q, devices, editingNo, setEditingNo, focusNo, onChanged }) {
  const toast = useToast();
  const { data, loading } = q;
  const tables = data?.tables ?? [];
  const [drafts, setDrafts] = useState({}); // { [tableNo]: { number, seats, device } } while editing
  const [savingNo, setSavingNo] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTable, setNewTable] = useState({ tableNo: '', seats: '4' });
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const deviceByTable = useMemo(() => new Map(devices.map((dv) => [dv.tableNo, dv])), [devices]);
  const counts = useMemo(
    () => ({
      all: tables.length,
      nodevice: tables.filter((t) => !t.hasDevice).length,
      sample: tables.filter((t) => t.isSample).length,
    }),
    [tables]
  );
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return tables.filter((t) => {
      if (filter === 'nodevice' && t.hasDevice) return false;
      if (filter === 'sample' && !t.isSample) return false;
      if (!text) return true;
      return `table ${t.tableNo} ${t.deviceCode ?? ''}`.toLowerCase().includes(text);
    });
  }, [tables, query, filter]);

  // A table opened from elsewhere (the attention list) must not stay hidden by the search or filter.
  useEffect(() => {
    if (editingNo !== null && tables.length > 0 && !visible.some((t) => t.tableNo === editingNo)) {
      setQuery('');
      setFilter('all');
    }
    // Only when a different table is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNo]);

  const draftOf = (t) => ({
    number: String(t.tableNo),
    seats: String(t.seats),
    device: t.deviceCode ?? '',
    ...drafts[t.tableNo],
  });
  const setField = (t, field, value) => setDrafts((d) => ({ ...d, [t.tableNo]: { ...draftOf(t), [field]: value } }));

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
    const { errors, changes, newNo, seats, device } = inspect(t, draftOf(t));
    const problem = errors.number || errors.seats || errors.device;
    if (problem) {
      toast.error(problem);
      return;
    }
    if (changes.length === 0) {
      closeEdit(t);
      return;
    }
    const renumbering = newNo !== t.tableNo;
    const seatsChanged = seats !== t.seats;
    const deviceChanged = device !== '' && device !== (t.deviceCode ?? '');

    setSavingNo(t.tableNo);
    let touched = false;
    try {
      if (deviceChanged) {
        await api.assignDevice(t.tableNo, device); // by the current number, before any rename
        touched = true;
      }
      if (renumbering) {
        await api.updateTable(t.tableNo, { newTableNo: newNo, seats });
        touched = true;
      } else if (seatsChanged) {
        await api.setTableSeats(t.tableNo, seats);
        touched = true;
      }
      toast.success(`Table ${newNo} saved.`);
      closeEdit(t);
      onChanged();
    } catch (err) {
      toast.error(err.message);
      if (touched) onChanged(); // part of the change went through, so show what is saved now
    } finally {
      setSavingNo(null);
    }
  }

  async function addTable(e) {
    e.preventDefault();
    setAdding(true);
    try {
      const result = await api.addTable({ tableNo: newTable.tableNo, seats: newTable.seats });
      toast.success(result.message || 'Table added.');
      setNewTable({ tableNo: '', seats: '4' });
      setShowAdd(false);
      onChanged();
    } catch (err) {
      toast.error(err.message);
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
            <button type="button" onClick={() => setShowAdd(false)} className={GHOST_BTN}>
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-shush-inkSoft">
            The new table is placed automatically on the floor plan. Connect its device after adding it.
          </p>
        </form>
      )}

      {!data ? (
        <p className="text-sm text-shush-muted">{loading ? 'Loading tables…' : 'No tables to show.'}</p>
      ) : tables.length === 0 ? (
        <EmptyState title="No tables yet" text="Use Add table to start the floor plan." />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="relative block min-w-[12rem] flex-1 sm:max-w-xs">
              <span className="sr-only">Search tables</span>
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-shush-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search table or device"
                className="block w-full rounded-xl border-shush-lineStrong bg-shush-white py-2 pl-9 pr-3 text-sm text-shush-ink focus:border-shush-orange focus:ring-shush-orange"
              />
            </label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tables">
              <Chip active={filter === 'all'} count={counts.all} onClick={() => setFilter('all')}>All</Chip>
              <Chip active={filter === 'nodevice'} count={counts.nodevice} onClick={() => setFilter('nodevice')}>No device</Chip>
              {counts.sample > 0 && (
                <Chip active={filter === 'sample'} count={counts.sample} onClick={() => setFilter('sample')}>Sample</Chip>
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-shush-lineStrong bg-shush-cream px-4 py-6 text-center text-sm text-shush-inkSoft">
              No tables match. Try a different search or filter.
            </p>
          ) : (
            <ul className={LIST}>
              {visible.map((t) => {
                const open = editingNo === t.tableNo;
                const d = draftOf(t);
                const check = inspect(t, d);
                const saving = savingNo === t.tableNo;
                const dv = deviceByTable.get(t.tableNo);
                return (
                  <li
                    key={t.tableNo}
                    id={`settings-table-${t.tableNo}`}
                    className={t.tableNo === focusNo && !open ? FOCUS_ROW : ''}
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
                      <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-shush-goldSoft text-lg font-semibold tabular-nums text-shush-orange700">
                        {t.tableNo}
                      </span>
                      <div className="min-w-0 flex-1 basis-44">
                        <div className="flex items-center gap-2 text-sm font-semibold text-shush-ink">
                          Table {t.tableNo}
                          {t.isSample && <span className={SAMPLE_TAG} title="Sample data">Sample</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-shush-inkSoft">
                          <SeatDots seats={t.seats} occupied={t.occupied} />
                          <span>
                            {t.seats} seats <span className="text-shush-muted">· {t.occupied} seated</span>
                          </span>
                        </div>
                      </div>
                      <div className="w-44 flex-none">
                        {t.hasDevice ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-shush-lineStrong bg-shush-goldSoft px-2.5 py-0.5 font-mono text-xs text-shush-ink">
                              <span className="h-1.5 w-1.5 rounded-full bg-shush-success" aria-hidden="true" />
                              {t.deviceCode}
                            </span>
                            <span className="mt-1 block text-[11px] text-shush-muted">
                              {dv?.lastSeenAt ? `Seen ${timeAgo(dv.lastSeenAt)}` : 'Waiting for first reading'}
                            </span>
                          </>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-dashed border-shush-lineStrong px-2.5 py-0.5 text-xs text-shush-muted">
                            No device
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => (open ? closeEdit(t) : setEditingNo(t.tableNo))}
                        className={GHOST_BTN}
                      >
                        {open ? 'Close' : t.hasDevice ? 'Edit' : 'Edit / connect'}
                      </button>
                    </div>

                    {open && (
                      <div className="border-t border-shush-line bg-shush-cream px-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field label="Table number" hint="Whole number, 1 to 999." error={check.errors.number}>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={999}
                              aria-label={`Table number for table ${t.tableNo}`}
                              aria-invalid={Boolean(check.errors.number)}
                              value={d.number}
                              onChange={(e) => setField(t, 'number', e.target.value)}
                              className={`${INPUT} ${check.errors.number ? INPUT_BAD : ''}`}
                            />
                          </Field>
                          <Field label="Seats" hint="1 to 20. Not below the students seated now." error={check.errors.seats}>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={20}
                              aria-label={`Seats for table ${t.tableNo}`}
                              aria-invalid={Boolean(check.errors.seats)}
                              value={d.seats}
                              onChange={(e) => setField(t, 'seats', e.target.value)}
                              className={`${INPUT} ${check.errors.seats ? INPUT_BAD : ''}`}
                            />
                          </Field>
                          <Field
                            label="Device code"
                            hint={
                              t.hasDevice
                                ? 'A new code replaces the current device and clears its last reading.'
                                : 'Letters, numbers and dashes, like SHUSH-T03.'
                            }
                            error={check.errors.device}
                          >
                            <input
                              type="text"
                              maxLength={20}
                              autoComplete="off"
                              spellCheck={false}
                              placeholder="e.g. SHUSH-T03"
                              aria-label={`Device code for table ${t.tableNo}`}
                              aria-invalid={Boolean(check.errors.device)}
                              value={d.device}
                              onChange={(e) => setField(t, 'device', e.target.value)}
                              className={`${INPUT} font-mono ${check.errors.device ? INPUT_BAD : ''}`}
                            />
                          </Field>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-2" aria-label="Pending changes">
                            {check.changes.length === 0 ? (
                              <li className="text-xs text-shush-muted">No changes yet.</li>
                            ) : (
                              check.changes.map((c) => (
                                <li
                                  key={c}
                                  className="rounded-full border border-shush-amber/50 bg-shush-goldSoft px-2.5 py-0.5 text-xs font-medium text-shush-ink"
                                >
                                  {c}
                                </li>
                              ))
                            )}
                          </ul>
                          <div className="flex gap-2">
                            <GlowButton
                              disabled={saving || check.changes.length === 0 || Object.keys(check.errors).length > 0}
                              onClick={() => saveTable(t)}
                              className={SMALL_BTN}
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </GlowButton>
                            <button type="button" disabled={saving} onClick={() => closeEdit(t)} className={GHOST_BTN}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

// ---- Device thresholds -----------------------------------------------------------

// Bar = the last noise level the device sent. Dark line = the alert threshold.
function LevelMeter({ level, threshold }) {
  const pct = (v) => Math.min(100, Math.max(0, (v / MAX_THRESHOLD) * 100));
  const over = level !== null && level > threshold;
  const near = level !== null && !over && threshold > 0 && level >= threshold * 0.8;
  const fill = over ? 'bg-shush-danger' : near ? 'bg-shush-amber' : 'bg-shush-orangeSoft';
  const label =
    level === null
      ? `No reading yet. Alert threshold ${threshold}.`
      : `Last level ${level} of ${MAX_THRESHOLD}. Alert threshold ${threshold}.`;
  return (
    <div className="relative h-2.5 rounded-full bg-shush-creamDeep" role="img" aria-label={label}>
      {level !== null && (
        <div className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${fill}`} style={{ width: `${pct(level)}%` }} />
      )}
      <div
        className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded bg-shush-ink transition-[left] duration-150"
        style={{ left: `${pct(threshold)}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

function DeviceSettings({ q, focusNo }) {
  const toast = useToast();
  const { data, loading, reload } = q;
  const [drafts, setDrafts] = useState({});
  const [savingCode, setSavingCode] = useState(null);

  async function save(device) {
    const raw = drafts[device.deviceCode] ?? String(device.threshold);
    const value = Number(raw);
    if (raw.trim() === '' || !Number.isInteger(value) || value < 0 || value > MAX_THRESHOLD) {
      toast.error(`Enter a whole number from 0 to ${formatNumber(MAX_THRESHOLD)}.`);
      return;
    }
    setSavingCode(device.deviceCode);
    try {
      const result = await api.saveThreshold(device.deviceCode, value);
      toast.success(result.message || 'Threshold saved.');
      setDrafts((d) => {
        const next = { ...d };
        delete next[device.deviceCode];
        return next;
      });
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <Card
      icon={DEVICE_ICON}
      title="Device thresholds"
      subtitle={`An alert is raised when the noise level (0 to ${formatNumber(MAX_THRESHOLD)}) stays above the threshold for 5 seconds. Devices pick up a new value on their next sync.`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-shush-inkSoft" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-full bg-shush-orangeSoft" /> Last level
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-0.5 rounded bg-shush-ink" /> Alert threshold
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-full bg-shush-danger" /> Above threshold
        </span>
      </div>

      {!data ? (
        <p className="text-sm text-shush-muted">{loading ? 'Loading devices…' : 'No devices to show.'}</p>
      ) : data.devices.length === 0 ? (
        <EmptyState title="No devices yet" text="Connect a device to a table above and it will appear here." />
      ) : (
        <ul className={LIST}>
          {data.devices.map((d) => {
            const draft = drafts[d.deviceCode] ?? String(d.threshold);
            const dirty = draft !== String(d.threshold);
            const draftNum = Number(draft);
            const shownThreshold = draft.trim() !== '' && Number.isFinite(draftNum) ? Math.min(MAX_THRESHOLD, Math.max(0, draftNum)) : d.threshold;
            const saving = savingCode === d.deviceCode;
            const setDraft = (value) => setDrafts((prev) => ({ ...prev, [d.deviceCode]: String(value) }));
            return (
              <li key={d.deviceCode} className={d.tableNo === focusNo ? FOCUS_ROW : ''}>
                <div className="space-y-3 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="rounded-lg bg-shush-goldSoft px-2 py-0.5 text-xs font-semibold text-shush-orange700">Table {d.tableNo}</span>
                    <span className="font-mono text-xs text-shush-ink">{d.deviceCode}</span>
                    {d.isSample && <span className={SAMPLE_TAG}>Sample</span>}
                    {dirty && (
                      <span className="rounded-full border border-shush-amber/50 bg-shush-goldSoft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-shush-ink">
                        Unsaved
                      </span>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-shush-muted">
                      Last level {formatNumber(d.lastLevel)} · seen {timeAgo(d.lastSeenAt)}
                    </span>
                  </div>

                  <LevelMeter level={d.lastLevel ?? null} threshold={shownThreshold} />

                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={MAX_THRESHOLD}
                      step={5}
                      aria-label={`Threshold slider for ${d.deviceCode}`}
                      value={shownThreshold}
                      onChange={(e) => setDraft(e.target.value)}
                      className="settings-range min-w-[10rem] flex-1"
                      style={{ '--fill': `${(shownThreshold / MAX_THRESHOLD) * 100}%` }}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_THRESHOLD}
                      step={1}
                      aria-label={`Threshold for ${d.deviceCode}`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-24 rounded-xl border-shush-lineStrong bg-shush-white text-sm tabular-nums text-shush-ink focus:border-shush-orange focus:ring-shush-orange"
                    />
                    <GlowButton disabled={!dirty || saving} onClick={() => save(d)} className={SMALL_BTN}>
                      {saving ? 'Saving…' : 'Save'}
                    </GlowButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---- Side column -----------------------------------------------------------------

function AttentionCard({ tables, devices, onOpen }) {
  const noDevice = tables.filter((t) => !t.hasDevice);
  const silent = devices.filter((d) => !d.lastSeenAt && !d.isSample);
  const items = [
    ...noDevice.map((t) => ({ key: `t${t.tableNo}`, text: `Table ${t.tableNo} has no device`, action: 'Connect', tableNo: t.tableNo })),
    ...silent.map((d) => ({ key: `d${d.deviceCode}`, text: `${d.deviceCode} has not sent a reading yet`, action: 'View', tableNo: d.tableNo })),
  ];
  const shown = items.slice(0, 5);

  return (
    <Card icon={ALERT_ICON} title="Needs attention" subtitle="Quick fixes for tables and devices.">
      {items.length === 0 ? (
        <p className="rounded-xl border border-shush-line bg-shush-cream px-3 py-3 text-sm text-shush-inkSoft">
          All set. Every table has a device that is reporting.
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-shush-line bg-shush-cream px-3 py-2"
            >
              <span className="min-w-0 text-sm text-shush-ink">{item.text}</span>
              <button type="button" onClick={() => onOpen(item.tableNo)} className={`${GHOST_BTN} !px-3 !py-1 text-xs`}>
                {item.action}
              </button>
            </li>
          ))}
          {items.length > shown.length && (
            <li className="px-1 text-xs text-shush-muted">+{items.length - shown.length} more</li>
          )}
        </ul>
      )}
    </Card>
  );
}

function GuideCard() {
  const steps = [
    ['Add the table', 'Give it a number and seats. It lands on the floor plan by itself.'],
    ['Connect a device', 'Edit the table and enter the code printed on its sensor.'],
    ['Set the threshold', 'Pick the noise level that should raise an alert.'],
  ];
  return (
    <Card icon={INFO_ICON} title="How it fits together" tone="accent">
      <ol className="space-y-3">
        {steps.map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-shush-goldSoft text-xs font-semibold text-shush-orange700">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-shush-ink">{title}</p>
              <p className="text-xs text-shush-inkSoft">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function SampleDataSettings({ onCleared }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function clear() {
    setBusy(true);
    try {
      const result = await api.clearSampleData();
      toast.success(result.message || 'Sample data removed.');
      onCleared?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Card
      icon={TRASH_ICON}
      title="Sample data"
      subtitle="Demo tables, devices, students and sessions are marked as sample. Real records are never removed."
    >
      <div className="space-y-3 rounded-xl border border-dashed border-shush-danger/40 bg-shush-cream p-4">
        <p className="text-sm text-shush-inkSoft">Rewards and history will then show only real activity.</p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full rounded-xl bg-shush-danger px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-shush-danger/90 focus:outline-none focus:ring-2 focus:ring-shush-danger focus:ring-offset-2"
        >
          Remove sample data
        </button>
      </div>
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
