import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Alert from '../../components/Alert.jsx';
import Card from '../../components/Card.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SampleBadge from '../../components/SampleBadge.jsx';
import usePolling from '../../hooks/usePolling.js';
import { formatNumber, timeAgo } from '../../lib/format.js';

const MAX_THRESHOLD = 4095;

const inputClass =
  'mt-1 block w-full rounded-xl border-slate-200 bg-white text-sm focus:border-[#1e40af] focus:ring-[#1e40af]';

// Only administrators see the settings. The server checks the same rule on every request.
export default function Settings() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const focusNo = Number(params.get('table')) || null;
  if (user?.role !== 'Admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" />
        <Card>
          <p className="text-sm text-slate-700">
            Settings are available to administrators only. If you should have access, ask an administrator to update
            your role.
          </p>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Tables, seats and device thresholds. Administrators only." />
      <TableSettings focusNo={focusNo} />
      <DeviceSettings focusNo={focusNo} />
      <SampleDataSettings />
    </div>
  );
}

function TableSettings({ focusNo }) {
  const { notify } = useToast();
  const { data, error, loading, reload } = usePolling(api.adminTables, 0);
  const [drafts, setDrafts] = useState({});
  const [savingNo, setSavingNo] = useState(null);
  const [newTable, setNewTable] = useState({ tableNo: '', seats: '4' });
  const [adding, setAdding] = useState(false);

  async function saveSeats(table) {
    const seats = Number(drafts[table.tableNo] ?? String(table.seats));
    if (!Number.isInteger(seats) || seats < 1 || seats > 20) {
      notify('error', 'Enter a whole number from 1 to 20.');
      return;
    }
    setSavingNo(table.tableNo);
    try {
      const result = await api.setTableSeats(table.tableNo, seats);
      notify('success', result.message);
      setDrafts((d) => {
        const next = { ...d };
        delete next[table.tableNo];
        return next;
      });
      reload();
    } catch (err) {
      notify('error', err.message);
    } finally {
      setSavingNo(null);
    }
  }

  async function addTable(e) {
    e.preventDefault();
    setAdding(true);
    try {
      const body = { tableNo: newTable.tableNo, seats: newTable.seats };
      const result = await api.addTable(body);
      notify('success', result.message);
      setNewTable({ tableNo: '', seats: '4' });
      reload();
    } catch (err) {
      notify('error', err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card
      title="Tables and seats"
      subtitle="Change how many seats a table has, or add a table by its number. The new table is placed automatically on the floor plan."
    >
      {error && <Alert>{error}</Alert>}
      {!data ? (
        <p className="text-sm text-slate-500">{loading ? 'Loading tables…' : 'No tables to show.'}</p>
      ) : data.tables.length === 0 ? (
        <p className="text-sm text-slate-500">No tables yet. Add the first one below.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 pr-4">Table</th>
                <th className="py-2 pr-4">Seated now</th>
                <th className="py-2 pr-4">Seats</th>
                <th className="py-2 pr-4">Device</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.tables.map((t) => {
                const draft = drafts[t.tableNo] ?? String(t.seats);
                const dirty = draft !== String(t.seats);
                return (
                  <tr key={t.tableNo} className={`align-top ${t.tableNo === focusNo ? 'bg-blue-50' : ''}`}>
                    <td className="py-3 pr-4 font-semibold text-[#152549]">
                      <div className="flex items-center gap-2">
                        Table {t.tableNo}
                        {t.isSample && <SampleBadge />}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{t.occupied} of {t.seats}</td>
                    <td className="py-3 pr-4">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={20}
                        step={1}
                        aria-label={`Seats for table ${t.tableNo}`}
                        value={draft}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [t.tableNo]: e.target.value }))}
                        className="w-24 rounded-xl border-slate-200 text-sm focus:border-[#1e40af] focus:ring-[#1e40af]"
                      />
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{t.hasDevice ? 'Connected' : 'Not connected'}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={!dirty || savingNo === t.tableNo}
                        onClick={() => saveSeats(t)}
                        className="rounded-xl bg-[#1e40af] px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-[#1e3a8a] disabled:opacity-40"
                      >
                        {savingNo === t.tableNo ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={addTable} className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Table number
          <input className={inputClass} type="number" min={1} max={999} required value={newTable.tableNo}
            onChange={(e) => setNewTable((t) => ({ ...t, tableNo: e.target.value }))} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Seats
          <input className={inputClass} type="number" min={1} max={20} required value={newTable.seats}
            onChange={(e) => setNewTable((t) => ({ ...t, seats: e.target.value }))} />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={adding}
            className="w-full rounded-xl bg-[#1e40af] px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-[#1e3a8a] disabled:opacity-60">
            {adding ? 'Adding…' : 'Add table'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function DeviceSettings({ focusNo }) {
  const { notify } = useToast();
  const { data, error, loading, reload } = usePolling(api.devices, 0);
  const [drafts, setDrafts] = useState({});
  const [savingCode, setSavingCode] = useState(null);

  async function save(device) {
    const raw = drafts[device.deviceCode] ?? String(device.threshold);
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > MAX_THRESHOLD) {
      notify('error', `Enter a whole number from 0 to ${MAX_THRESHOLD}.`);
      return;
    }
    setSavingCode(device.deviceCode);
    try {
      const result = await api.saveThreshold(device.deviceCode, value);
      notify('success', result.message);
      setDrafts((d) => {
        const next = { ...d };
        delete next[device.deviceCode];
        return next;
      });
      reload();
    } catch (err) {
      notify('error', err.message);
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <Card
      title="Device thresholds"
      subtitle={`Raw sensor level from 0 to ${formatNumber(MAX_THRESHOLD)}. A device raises an alert when noise stays above its threshold for 5 seconds. Devices pick up a new value the next time they sync.`}
    >
      {error && <Alert>{error}</Alert>}
      {!data ? (
        <p className="text-sm text-slate-500">{loading ? 'Loading devices…' : 'No devices to show.'}</p>
      ) : data.devices.length === 0 ? (
        <p className="text-sm text-slate-500">No devices are registered yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 pr-4">Table</th>
                <th className="py-2 pr-4">Device</th>
                <th className="py-2 pr-4">Last level</th>
                <th className="py-2 pr-4">Current threshold</th>
                <th className="py-2 pr-4">New threshold</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.devices.map((d) => {
                const draft = drafts[d.deviceCode] ?? String(d.threshold);
                const dirty = draft !== String(d.threshold);
                return (
                  <tr key={d.deviceCode} className={`align-top ${d.tableNo === focusNo ? 'bg-blue-50' : ''}`}>
                    <td className="py-3 pr-4 font-semibold text-[#152549]">Table {d.tableNo}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        {d.deviceCode}
                        {d.isSample && <SampleBadge />}
                      </div>
                      <div className="mt-0.5 font-sans text-[11px] text-slate-500">seen {timeAgo(d.lastSeenAt)}</div>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{formatNumber(d.lastLevel)}</td>
                    <td className="py-3 pr-4 text-slate-700">{formatNumber(d.threshold)}</td>
                    <td className="py-3 pr-4">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MAX_THRESHOLD}
                        step={1}
                        aria-label={`New threshold for ${d.deviceCode}`}
                        value={draft}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [d.deviceCode]: e.target.value }))}
                        className="w-32 rounded-xl border-slate-200 text-sm focus:border-[#1e40af] focus:ring-[#1e40af]"
                      />
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={!dirty || savingCode === d.deviceCode}
                        onClick={() => save(d)}
                        className="rounded-xl bg-[#1e40af] px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-[#1e3a8a] disabled:opacity-40"
                      >
                        {savingCode === d.deviceCode ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function SampleDataSettings() {
  const { notify } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function clear() {
    setBusy(true);
    try {
      const result = await api.clearSampleData();
      notify('success', result.message);
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Card
      title="Sample data"
      subtitle="The demo tables, devices, students and sessions are marked as sample data. Remove them once real tables and students are in use. Real records are never removed."
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          Rewards and history will then show only real activity.
        </p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-[#1e40af] transition hover:bg-[#1e40af] hover:text-white"
        >
          Remove sample data
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Remove sample data?"
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
