import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import Card from '../../components/Card.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import GlowButton from '../../components/GlowButton.jsx';
import Modal from '../../components/Modal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Stat from '../../components/Stat.jsx';
import { useErrorToast, useToast } from '../../components/Toast.jsx';
import { NAV_ICONS } from '../../components/navIcons.jsx';
import usePolling from '../../hooks/usePolling.js';
import { formatNumber, timeAgo } from '../../lib/format.js';
import './settings.css';

const MAX_THRESHOLD = 4095;
const DEVICE_RE = /^[A-Za-z0-9-]{1,20}$/;

const INPUT =
    'mt-1 block w-full rounded-xl border-shush-lineStrong bg-shush-white text-sm text-shush-ink focus:border-shush-orange focus:ring-shush-orange';
const INPUT_BAD = '!border-shush-danger focus:!border-shush-danger focus:!ring-shush-danger';
const SMALL_BTN =
    'rounded-xl bg-shush-orange600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-shush-orange700 active:bg-shush-orange700 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-shush-orange focus:ring-offset-2';
const GHOST_BTN =
    'rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-2 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';
const HEADER_BTN =
    'inline-flex items-center gap-2 rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-2.5 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';
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
const CLOCK_ICON = icon(
    <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
    </>
);

export default function Settings() {
    const [params] = useSearchParams();
    const focusNo = Number(params.get('table')) || null;
    const [editingNo, setEditingNo] = useState(focusNo);
    const [showAttention, setShowAttention] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const tablesQ = usePolling(api.facultyTables, 0);
    const devicesQ = usePolling(api.devices, 0);
    useErrorToast(tablesQ.error);
    useErrorToast(devicesQ.error);

    const tables = tablesQ.data?.tables ?? [];
    const devices = devicesQ.data?.devices ?? [];
    const attention = attentionItems(tables, devices);
    const reloadAll = () => {
        tablesQ.reload();
        devicesQ.reload();
    };

    function openTable(no) {
        setEditingNo(no);
        setTimeout(() => {
            const el = document.getElementById(`settings-table-${no}`);
            const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            el?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
        }, 60);
    }

    function openAttentionTable(no) {
        setShowAttention(false);
        openTable(no);
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Settings"
                icon={NAV_ICONS.settings}
                subtitle="Tables, seats and device thresholds."
            >
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowAttention(true)}
                        className={HEADER_BTN}
                        aria-haspopup="dialog"
                    >
                        <span
                            className={`[&>svg]:h-4 [&>svg]:w-4 ${attention.length > 0 ? 'text-shush-danger' : 'text-shush-success'}`}
                            aria-hidden="true"
                        >
                            {ALERT_ICON}
                        </span>
                        Needs attention
                        {attention.length > 0 && (
                            <span className="rounded-full bg-shush-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">
                                {attention.length}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowGuide(true)}
                        className={HEADER_BTN}
                        aria-haspopup="dialog"
                    >
                        <span className="text-shush-orange700 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
                            {INFO_ICON}
                        </span>
                        How it fits together
                    </button>
                </div>
            </PageHeader>

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
                    <WorkingHoursSettings />
                    <SampleDataSettings onCleared={reloadAll} />
                </aside>
            </div>

            <AttentionModal
                open={showAttention}
                items={attention}
                onOpen={openAttentionTable}
                onClose={() => setShowAttention(false)}
            />
            <GuideModal open={showGuide} onClose={() => setShowGuide(false)} />
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
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2 ${active
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
<<<<<<< HEAD
    const toast = useToast();
    const { data, loading } = q;
    const tables = data?.tables ?? [];
    const [drafts, setDrafts] = useState({});
    const [savingNo, setSavingNo] = useState(null);
    const [showAdd, setShowAdd] = useState(false);
    const [newTable, setNewTable] = useState({ tableNo: '', seats: '4', device: '' });
    const [adding, setAdding] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [removingDevice, setRemovingDevice] = useState(null);
    const [removeBusy, setRemoveBusy] = useState(false);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
=======
  const toast = useToast();
  const { data, loading } = q;
  const tables = data?.tables ?? [];
  const [drafts, setDrafts] = useState({}); // { [tableNo]: { number, seats, device } } while editing
  const [savingNo, setSavingNo] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTable, setNewTable] = useState({ tableNo: '', seats: '4', device: '' });
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(null); // the table waiting for delete confirmation
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [removingDevice, setRemovingDevice] = useState(null); // the table whose device is waiting for confirmation
  const [removeBusy, setRemoveBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
>>>>>>> aff67a4769b555b9f2641d3843ae61ed94647282

    const toggleFilter = (key) => setFilter((cur) => (cur === key ? 'all' : key));

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

<<<<<<< HEAD
    useEffect(() => {
        if (editingNo !== null && tables.length > 0 && !visible.some((t) => t.tableNo === editingNo)) {
            setQuery('');
            setFilter('all');
=======
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

  // Disconnects the device only. The table and its records stay.
  async function removeDevice() {
    const t = removingDevice;
    if (!t) return;
    setRemoveBusy(true);
    try {
      const result = await api.removeDevice(t.tableNo);
      toast.success(result.message || `Device removed from Table ${t.tableNo}.`);
      // Forget a typed device code, but keep any number or seat changes still being edited.
      setDrafts((d) => (d[t.tableNo] ? { ...d, [t.tableNo]: { ...d[t.tableNo], device: '' } } : d));
      setRemovingDevice(null);
      onChanged();
    } catch (err) {
      toast.error(err.message);
      setRemovingDevice(null);
      onChanged(); // the device may already be gone, so show what is saved now
    } finally {
      setRemoveBusy(false);
    }
  }

  async function deleteTable() {
    const t = deleting;
    if (!t) return;
    setDeleteBusy(true);
    try {
      const result = await api.deleteTable(t.tableNo);
      toast.success(result.message || `Table ${t.tableNo} deleted.`);
      setDeleting(null);
      closeEdit(t);
      onChanged();
    } catch (err) {
      toast.error(err.message);
      setDeleting(null);
      onChanged(); // the table may already be gone or someone may have sat down, so show what is saved now
    } finally {
      setDeleteBusy(false);
    }
  }

  async function addTable(e) {
    e.preventDefault();
    const device = newTable.device.trim();
    if (device !== '' && !DEVICE_RE.test(device)) {
      toast.error('Device code must be 1 to 20 letters, numbers or dashes.');
      return;
    }
    setAdding(true);
    try {
      const result = await api.addTable({ tableNo: newTable.tableNo, seats: newTable.seats });
      const addedNo = result?.tableNo ?? Number(newTable.tableNo);
      if (device) {
        try {
          await api.assignDevice(addedNo, device);
          toast.success(`Table ${addedNo} added and device ${device} connected.`);
        } catch (err) {
          // The table exists; only the device connection failed.
          toast.error(`Table ${addedNo} was added, but the device could not be connected: ${err.message}`);
>>>>>>> aff67a4769b555b9f2641d3843ae61ed94647282
        }
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

    async function saveTable(t) {
        const { errors, changes, newNo, seats, device } = inspect(t, draftOf(t));
        const problem = errors.number || errors.seats || errors.device;
        if (problem) { toast.error(problem); return; }
        if (changes.length === 0) { closeEdit(t); return; }
        const renumbering = newNo !== t.tableNo;
        const seatsChanged = seats !== t.seats;
        const deviceChanged = device !== '' && device !== (t.deviceCode ?? '');

        setSavingNo(t.tableNo);
        let touched = false;
        try {
            if (deviceChanged) {
                await api.assignDevice(t.tableNo, device);
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
            if (touched) onChanged();
        } finally {
            setSavingNo(null);
        }
    }

    async function removeDevice() {
        const t = removingDevice;
        if (!t) return;
        setRemoveBusy(true);
        try {
            const result = await api.removeDevice(t.tableNo);
            toast.success(result.message || `Device removed from Table ${t.tableNo}.`);
            setDrafts((d) => (d[t.tableNo] ? { ...d, [t.tableNo]: { ...d[t.tableNo], device: '' } } : d));
            setRemovingDevice(null);
            onChanged();
        } catch (err) {
            toast.error(err.message);
            setRemovingDevice(null);
            onChanged();
        } finally {
            setRemoveBusy(false);
        }
    }

    async function deleteTable() {
        const t = deleting;
        if (!t) return;
        setDeleteBusy(true);
        try {
            const result = await api.deleteTable(t.tableNo);
            toast.success(result.message || `Table ${t.tableNo} deleted.`);
            setDeleting(null);
            closeEdit(t);
            onChanged();
        } catch (err) {
            toast.error(err.message);
            setDeleting(null);
            onChanged();
        } finally {
            setDeleteBusy(false);
        }
    }

    async function addTable(e) {
        e.preventDefault();
        const device = newTable.device.trim();
        if (device !== '' && !DEVICE_RE.test(device)) {
            toast.error('Device code must be 1 to 20 letters, numbers or dashes.');
            return;
        }
        setAdding(true);
        try {
            const result = await api.addTable({ tableNo: newTable.tableNo, seats: newTable.seats });
            const addedNo = result?.tableNo ?? Number(newTable.tableNo);
            if (device) {
                try {
                    await api.assignDevice(addedNo, device);
                    toast.success(`Table ${addedNo} added and device ${device} connected.`);
                } catch (err) {
                    toast.error(`Table ${addedNo} was added, but the device could not be connected: ${err.message}`);
                }
            } else {
                toast.success(result.message || 'Table added.');
            }
            setNewTable({ tableNo: '', seats: '4', device: '' });
            setShowAdd(false);
            onChanged();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setAdding(false);
        }
    }

    const newDevice = newTable.device.trim();
    const newDeviceError = newDevice !== '' && !DEVICE_RE.test(newDevice);

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
                        <label className="block w-48">
                            <span className={LABEL}>
                                Device code <span className="normal-case tracking-normal text-shush-muted">(optional)</span>
                            </span>
                            <input
                                className={`${INPUT} font-mono ${newDeviceError ? INPUT_BAD : ''}`}
                                type="text"
                                maxLength={20}
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="e.g. SHUSH-T03"
                                aria-invalid={newDeviceError}
                                value={newTable.device}
                                onChange={(e) => setNewTable((t) => ({ ...t, device: e.target.value }))}
                            />
                        </label>
                        <GlowButton type="submit" disabled={adding || newDeviceError} className={SMALL_BTN}>
                            {adding ? 'Adding…' : 'Add table'}
                        </GlowButton>
                        <button type="button" onClick={() => setShowAdd(false)} className={GHOST_BTN}>
                            Cancel
                        </button>
                    </div>
                    <p className={`mt-2 text-xs ${newDeviceError ? 'text-shush-danger' : 'text-shush-inkSoft'}`}>
                        {newDeviceError
                            ? 'Device code must be 1 to 20 letters, numbers or dashes.'
                            : 'The new table is placed automatically on the floor plan. Add a device code now, or connect it later with Edit / connect.'}
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
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tables. Click a selected filter again to show all.">
                            <Chip active={filter === 'all'} count={counts.all} onClick={() => setFilter('all')}>All</Chip>
                            <Chip active={filter === 'nodevice'} count={counts.nodevice} onClick={() => toggleFilter('nodevice')}>No device</Chip>
                            {counts.sample > 0 && (
                                <Chip active={filter === 'sample'} count={counts.sample} onClick={() => toggleFilter('sample')}>Sample</Chip>
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

<<<<<<< HEAD
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

                                                {t.hasDevice && (
                                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-shush-danger/40 pt-4">
                                                        <p className="min-w-0 flex-1 text-xs text-shush-inkSoft">
                                                            Disconnect <span className="font-mono">{t.deviceCode}</span> from this table. The table and its records stay.
                                                        </p>
                                                        <button
                                                            type="button"
                                                            disabled={saving}
                                                            onClick={() => setRemovingDevice(t)}
                                                            className="rounded-xl border border-shush-danger/50 bg-shush-white px-4 py-2 text-sm font-semibold text-shush-danger transition hover:bg-shush-danger/10 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-danger focus-visible:ring-offset-2"
                                                        >
                                                            Remove device
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-shush-danger/40 pt-4">
                                                    <p className="min-w-0 flex-1 text-xs text-shush-inkSoft">
                                                        {t.occupied > 0
                                                            ? `${t.occupied} ${t.occupied === 1 ? 'student is' : 'students are'} seated here. End their sessions before deleting this table.`
                                                            : 'Deleting removes the table, its device and its history.'}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        disabled={saving || t.occupied > 0}
                                                        onClick={() => setDeleting(t)}
                                                        className="inline-flex items-center gap-2 rounded-xl bg-shush-danger px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-shush-danger/90 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-shush-danger focus:ring-offset-2"
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                            <path d="M3 6h18" />
                                                            <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                        </svg>
                                                        Delete table
                                                    </button>
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
            <ConfirmDialog
                open={removingDevice !== null}
                title={`Remove device from Table ${removingDevice?.tableNo ?? ''}?`}
                tone="danger"
                confirmLabel="Yes, remove device"
                cancelLabel="Keep it"
                busyLabel="Removing…"
                onConfirm={removeDevice}
                onCancel={() => setRemovingDevice(null)}
                busy={removeBusy}
            >
                {`Device ${removingDevice?.deviceCode ?? ''} is disconnected. The table, its sessions and its noise history are kept. You can connect a device again any time.`}
            </ConfirmDialog>
            <ConfirmDialog
                open={deleting !== null}
                title={`Delete Table ${deleting?.tableNo ?? ''}?`}
                tone="danger"
                confirmLabel="Yes, delete it"
                cancelLabel="Keep it"
                busyLabel="Deleting…"
                onConfirm={deleteTable}
                onCancel={() => setDeleting(null)}
                busy={deleteBusy}
            >
                This permanently removes the table, its device and its history: sessions, alerts, noise readings and maintenance periods. This cannot be undone.
            </ConfirmDialog>
        </Card>
    );
=======
                        {t.hasDevice && (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-shush-danger/40 pt-4">
                            <p className="min-w-0 flex-1 text-xs text-shush-inkSoft">
                              Disconnect <span className="font-mono">{t.deviceCode}</span> from this table. The table and its records stay.
                            </p>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setRemovingDevice(t)}
                              className="rounded-xl border border-shush-danger/50 bg-shush-white px-4 py-2 text-sm font-semibold text-shush-danger transition hover:bg-shush-danger/10 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-danger focus-visible:ring-offset-2"
                            >
                              Remove device
                            </button>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-shush-danger/40 pt-4">
                          <p className="min-w-0 flex-1 text-xs text-shush-inkSoft">
                            {t.occupied > 0
                              ? `${t.occupied} ${t.occupied === 1 ? 'student is' : 'students are'} seated here. End their sessions before deleting this table.`
                              : 'Deleting removes the table, its device and its history.'}
                          </p>
                          <button
                            type="button"
                            disabled={saving || t.occupied > 0}
                            onClick={() => setDeleting(t)}
                            className="inline-flex items-center gap-2 rounded-xl bg-shush-danger px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-shush-danger/90 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-shush-danger focus:ring-offset-2"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M3 6h18" />
                              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            </svg>
                            Delete table
                          </button>
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
      <ConfirmDialog
        open={removingDevice !== null}
        title={`Remove device from Table ${removingDevice?.tableNo ?? ''}?`}
        tone="danger"
        confirmLabel="Yes, remove device"
        cancelLabel="Keep it"
        busyLabel="Removing…"
        onConfirm={removeDevice}
        onCancel={() => setRemovingDevice(null)}
        busy={removeBusy}
      >
        {`Device ${removingDevice?.deviceCode ?? ''} is disconnected. The table, its sessions and its noise history are kept. You can connect a device again any time.`}
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete Table ${deleting?.tableNo ?? ''}?`}
        tone="danger"
        confirmLabel="Yes, delete it"
        cancelLabel="Keep it"
        busyLabel="Deleting…"
        onConfirm={deleteTable}
        onCancel={() => setDeleting(null)}
        busy={deleteBusy}
      >
        This permanently removes the table, its device and its history: sessions, alerts, noise readings and maintenance periods. This cannot be undone.
      </ConfirmDialog>
    </Card>
  );
>>>>>>> aff67a4769b555b9f2641d3843ae61ed94647282
}

// ---- Device thresholds -----------------------------------------------------------

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
        const rawHigh = drafts[device.deviceCode]?.high ?? String(device.threshold);
        const rawLow = drafts[device.deviceCode]?.low ?? String(Math.round(device.threshold * 0.7));

        const valHigh = Number(rawHigh);
        const valLow = Number(rawLow);

        if (rawHigh.trim() === '' || !Number.isInteger(valHigh) || valHigh < 0 || valHigh > MAX_THRESHOLD) {
            toast.error(`High threshold must be between 0 and ${formatNumber(MAX_THRESHOLD)}.`);
            return;
        }
        if (rawLow.trim() === '' || !Number.isInteger(valLow) || valLow < 0 || valLow > valHigh) {
            toast.error(`Low warning must be between 0 and the High threshold.`);
            return;
        }

        setSavingCode(device.deviceCode);
        try {
            const result = await api.saveThreshold(device.deviceCode, valHigh);
            toast.success(result.message || 'Threshold saved. Device will update on next sync.');
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
            subtitle={`Set the Warning (Low) and Alert (High) noise levels. Devices update automatically.`}
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
                        const draftHigh = drafts[d.deviceCode]?.high ?? String(d.threshold);
                        const draftLow = drafts[d.deviceCode]?.low ?? String(Math.round(d.threshold * 0.7));

                        const dirty = draftHigh !== String(d.threshold) || draftLow !== String(Math.round(d.threshold * 0.7));
                        const saving = savingCode === d.deviceCode;
                        const over = d.lastLevel != null && Number(d.lastLevel) > Number(draftHigh);

                        const setDraft = (field, value) => setDrafts((prev) => ({
                            ...prev,
                            [d.deviceCode]: {
                                high: prev[d.deviceCode]?.high ?? String(d.threshold),
                                low: prev[d.deviceCode]?.low ?? String(Math.round(d.threshold * 0.7)),
                                [field]: String(value)
                            }
                        }));

                        return (
                            <li key={d.deviceCode} className={d.tableNo === focusNo ? FOCUS_ROW : ''}>
                                <div className="space-y-3 px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span className="rounded-lg bg-shush-goldSoft px-2 py-0.5 text-xs font-semibold text-shush-orange700">Table {d.tableNo}</span>
                                        <span className="font-mono text-xs text-shush-ink">{d.deviceCode}</span>
                                        {over && (
                                            <span className="rounded-full bg-shush-danger px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                                Above threshold
                                            </span>
                                        )}
                                        {dirty && (
                                            <span className="rounded-full border border-shush-amber/50 bg-shush-goldSoft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-shush-ink">
                                                Unsaved
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-1">
                                        <label className="block">
                                            <span className={LABEL}>Low (Warning)</span>
                                            <input
                                                type="number"
                                                min={0}
                                                max={draftHigh}
                                                value={draftLow}
                                                onChange={(e) => setDraft('low', e.target.value)}
                                                className="mt-1 w-full rounded-xl border-shush-lineStrong bg-shush-white text-sm tabular-nums text-shush-ink focus:border-shush-orange focus:ring-shush-orange"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className={LABEL}>High (Alert)</span>
                                            <input
                                                type="number"
                                                min={draftLow}
                                                max={MAX_THRESHOLD}
                                                value={draftHigh}
                                                onChange={(e) => setDraft('high', e.target.value)}
                                                className="mt-1 w-full rounded-xl border-shush-lineStrong bg-shush-white text-sm tabular-nums text-shush-ink focus:border-shush-orange focus:ring-shush-orange"
                                            />
                                        </label>
                                    </div>

                                    <div className="flex justify-end gap-3 mt-2">
                                        <GlowButton disabled={!dirty || saving} onClick={() => save(d)} className={SMALL_BTN}>
                                            {saving ? 'Saving…' : 'Save Changes'}
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

// ---- Attention + guide modals ----------------------------------------------------

function attentionItems(tables, devices) {
    const noDevice = tables.filter((t) => !t.hasDevice);
    const silent = devices.filter((d) => !d.lastSeenAt && !d.isSample);
    return [
        ...noDevice.map((t) => ({ key: `t${t.tableNo}`, text: `Table ${t.tableNo} has no device`, action: 'Connect', tableNo: t.tableNo })),
        ...silent.map((d) => ({ key: `d${d.deviceCode}`, text: `${d.deviceCode} has not sent a reading yet`, action: 'View', tableNo: d.tableNo })),
    ];
}

function AttentionModal({ open, items, onOpen, onClose }) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Needs attention"
            subtitle="Quick fixes for tables and devices."
            icon={ALERT_ICON}
        >
            {items.length === 0 ? (
                <p className="rounded-xl border border-shush-line bg-shush-cream px-3 py-3 text-sm text-shush-inkSoft">
                    All set. Every table has a device that is reporting.
                </p>
            ) : (
                <ul className="space-y-2">
                    {items.map((item) => (
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
                </ul>
            )}
            <p className="mt-4 text-xs text-shush-inkSoft">
                Connect opens the table below so you can enter the device code printed on its sensor.
            </p>
        </Modal>
    );
}

function GuideModal({ open, onClose }) {
    const steps = [
        ['Add the table', 'Give it a number and seats. You can also add its device code in the same form.'],
        ['Connect a device', 'Enter the code printed on the sensor, either while adding the table or later with Edit / connect.'],
        ['Set the threshold', 'Pick the noise level that should raise an alert. The table alerts after 5 seconds above it.'],
    ];
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="How it fits together"
            subtitle="Three steps from a new table to live alerts."
            icon={INFO_ICON}
        >
            <ol className="space-y-4">
                {steps.map(([title, text], i) => (
                    <li key={title} className="flex gap-3">
                        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-shush-goldSoft text-xs font-semibold text-shush-orange700">
                            {i + 1}
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-shush-ink">{title}</p>
                            <p className="mt-0.5 text-xs text-shush-inkSoft">{text}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </Modal>
    );
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
    value: h,
    label: `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`,
}));

const WORKING_HOUR_PRESETS = [
    { startHour: 8, endHour: 17, label: '8 AM – 5 PM' },
    { startHour: 7, endHour: 19, label: '7 AM – 7 PM' },
    { startHour: 8, endHour: 20, label: '8 AM – 8 PM' },
];

function WorkingHoursSettings() {
    const toast = useToast();
    const q = usePolling(api.workingHours, 0);
    useErrorToast(q.error);
    const saved = q.data?.workingHours ?? null;

    const [draft, setDraft] = useState({ startHour: 8, endHour: 17, excludeWeekends: false });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (saved) {
            setDraft({
                startHour: Number(saved.startHour),
                endHour: Number(saved.endHour),
                excludeWeekends: Boolean(saved.excludeWeekends),
            });
        }
    }, [saved]);

    const invalidRange = draft.endHour <= draft.startHour;
    const dirty =
        saved !== null &&
        (draft.startHour !== Number(saved.startHour) ||
            draft.endHour !== Number(saved.endHour) ||
            draft.excludeWeekends !== Boolean(saved.excludeWeekends));

    async function save(e) {
        e.preventDefault();
        if (invalidRange) {
            toast.error('Closing hour must be later than opening hour.');
            return;
        }
        setSaving(true);
        try {
            const result = await api.saveWorkingHours(draft);
            toast.success(result.message || 'Working hours saved.');
            q.reload();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card
            icon={CLOCK_ICON}
            title="Working hours"
            subtitle="Hours compared in the Dashboard's Peak vs. quietest noise analytics."
        >
            <form onSubmit={save} className="space-y-4">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Working hours presets">
                    {WORKING_HOUR_PRESETS.map((p) => {
                        const active = draft.startHour === p.startHour && draft.endHour === p.endHour;
                        return (
                            <button
                                key={p.label}
                                type="button"
                                onClick={() => setDraft((d) => ({ ...d, startHour: p.startHour, endHour: p.endHour }))}
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange ${active
                                        ? 'border-shush-orange bg-shush-goldSoft text-shush-ink'
                                        : 'border-shush-lineStrong bg-shush-white text-shush-inkSoft hover:bg-shush-creamDeep'
                                    }`}
                            >
                                {p.label}
                            </button>
                        );
                    })}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <label className="block min-w-0">
                        <span className={LABEL}>Opens at</span>
                        <select
                            className={INPUT}
                            value={draft.startHour}
                            onChange={(e) => setDraft((d) => ({ ...d, startHour: Number(e.target.value) }))}
                        >
                            {HOUR_OPTIONS.slice(0, 23).map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block min-w-0">
                        <span className={LABEL}>Closes at</span>
                        <select
                            className={`${INPUT} ${invalidRange ? INPUT_BAD : ''}`}
                            value={draft.endHour}
                            onChange={(e) => setDraft((d) => ({ ...d, endHour: Number(e.target.value) }))}
                        >
                            {HOUR_OPTIONS.slice(1).map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {invalidRange && (
                    <p className="text-xs text-shush-danger">Closing hour must be later than opening hour.</p>
                )}

                <label className="flex items-start gap-2.5 rounded-xl border border-shush-line bg-shush-cream px-3 py-2.5 text-xs text-shush-ink">
                    <input
                        type="checkbox"
                        checked={draft.excludeWeekends}
                        onChange={(e) => setDraft((d) => ({ ...d, excludeWeekends: e.target.checked }))}
                        className="mt-0.5 rounded border-shush-lineStrong text-shush-orange focus:ring-shush-orange"
                    />
                    <span>
                        <strong className="block font-semibold">Exclude weekends (Sat–Sun)</strong>
                        <span className="text-shush-inkSoft">Only count Monday–Friday activity in analytics.</span>
                    </span>
                </label>

                <div className="flex justify-end">
                    <GlowButton type="submit" disabled={!dirty || invalidRange || saving} className={SMALL_BTN}>
                        {saving ? 'Saving…' : 'Save'}
                    </GlowButton>
                </div>
            </form>
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