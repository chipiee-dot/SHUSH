import { useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../api.js';
import { formatTime } from '../lib/format.js';
import Alert from './Alert.jsx';
import Card from './Card.jsx';

const DURATIONS = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 240, label: '4 hours' },
];

export default function MaintenanceCard({ tables, active, onChanged }) {
  const { notify } = useToast();
  const [scope, setScope] = useState('all');
  const [minutes, setMinutes] = useState(30);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleStart(event) {
    event.preventDefault();
    if (reason.trim().length < 3) {
      notify('error', 'Enter a reason of at least 3 characters.');
      return;
    }
    setBusy(true);
    try {
      const result = await api.startMaintenance({
        tableNo: scope === 'all' ? 'all' : Number(scope),
        durationMinutes: minutes,
        reason: reason.trim(),
      });
      notify('success', result.message);
      setReason('');
      onChanged();
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd(id) {
    try {
      const result = await api.endMaintenance(id);
      notify('success', result.message);
      onChanged();
    } catch (err) {
      notify('error', err.message);
    }
  }

  const inputClass =
    'mt-1 block w-full rounded-xl border-slate-200 bg-white text-sm focus:border-[#1e40af] focus:ring-[#1e40af]';

  return (
    <Card
      title="Maintenance mode"
      subtitle="Suspend alerts for one table or all tables for a set time. Every window is recorded in History."
    >
      {active.length > 0 && (
        <ul className="mb-5 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {active.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="font-medium text-[#152549]">
                  {w.allTables ? 'All tables' : `Table ${w.tableNo}`} · until {formatTime(w.endsAt)}
                </div>
                <div className="text-xs text-slate-600">
                  {w.reason} · started by {w.createdBy}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleEnd(w.id)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-[#1e40af] transition hover:bg-[#1e40af] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-1"
              >
                End now
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleStart} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Applies to
          <select className={inputClass} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">All tables</option>
            {tables.map((t) => (
              <option key={t.tableNo} value={t.tableNo}>
                Table {t.tableNo}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Duration
          <select className={inputClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d.minutes} value={d.minutes}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Reason
          <input
            className={inputClass}
            value={reason}
            maxLength={200}
            placeholder="For example: sensor check, cleaning, firmware update"
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <div className="flex justify-end sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[#1e40af] px-5 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-[#1e3a8a] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:ring-offset-2"
          >
            {busy ? 'Starting…' : 'Start maintenance'}
          </button>
        </div>
      </form>
    </Card>
  );
}
