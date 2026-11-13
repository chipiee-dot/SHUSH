import { useMemo, useState } from 'react';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import Card from '../../components/Card.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SampleBadge from '../../components/SampleBadge.jsx';
import usePolling from '../../hooks/usePolling.js';
import { HISTORY_KIND_META, csvCell, dateInputValue, formatDateTime } from '../../lib/format.js';

const KINDS = [
  { value: 'all', label: 'All activity' },
  { value: 'alert', label: 'Alerts' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'session', label: 'Sessions' },
];

const selectClass =
  'mt-1 block w-full rounded-xl border-shush-lineStrong bg-shush-white text-sm focus:border-shush-orange focus:ring-shush-orange';

function downloadCsv(rows, filename) {
  const header = ['Time', 'Type', 'Table', 'Summary', 'Details', 'Sample data'];
  const lines = rows.map((r) =>
    [
      new Date(r.occurredAt).toISOString(),
      HISTORY_KIND_META[r.kind]?.label ?? r.kind,
      r.tableNo ?? 'All tables',
      r.summary,
      r.detail,
      r.isSample ? 'yes' : 'no',
    ]
      .map(csvCell)
      .join(',')
  );
  const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function History() {
  const [filters, setFilters] = useState({ kind: 'all', tableNo: 'all', from: '', to: '' });
  const [exportError, setExportError] = useState('');

  const params = useMemo(
    () => ({
      kind: filters.kind,
      tableNo: filters.tableNo,
      from: filters.from,
      to: filters.to,
    }),
    [filters]
  );
  const { data, error, loading } = usePolling(() => api.history(params), 0, [JSON.stringify(params)]);
  const tables = usePolling(api.layout, 60000);

  function update(name, value) {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function exportReport() {
    setExportError('');
    if (!data || data.rows.length === 0) {
      setExportError('There is nothing to export for these filters.');
      return;
    }
    const stamp = dateInputValue();
    downloadCsv(data.rows, `shush-history-${stamp}.csv`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        subtitle="Alerts, maintenance and sessions. Export the filtered list as a CSV report."
      >
        <button
          type="button"
          onClick={exportReport}
          className="rounded-xl bg-shush-orange px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-shush-orange600"
        >
          Export CSV
        </button>
      </PageHeader>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-shush-inkSoft">
            Type
            <select className={selectClass} value={filters.kind} onChange={(e) => update('kind', e.target.value)}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-shush-inkSoft">
            Table
            <select className={selectClass} value={filters.tableNo} onChange={(e) => update('tableNo', e.target.value)}>
              <option value="all">All tables</option>
              {(tables.data?.tables ?? []).map((t) => (
                <option key={t.tableNo} value={t.tableNo}>
                  Table {t.tableNo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-shush-inkSoft">
            From
            <input
              type="date"
              className={selectClass}
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => update('from', e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-shush-inkSoft">
            To
            <input
              type="date"
              className={selectClass}
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => update('to', e.target.value)}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-shush-muted">
          Leave the dates empty to see the last 7 days. Dates use the library's time zone.
        </p>
      </Card>

      {(error || exportError) && <Alert>{exportError || error}</Alert>}

      <Card className="overflow-hidden p-0">
        {!data ? (
          <p className="p-5 text-sm text-shush-muted">{loading ? 'Loading history…' : 'No history to show.'}</p>
        ) : data.rows.length === 0 ? (
          <p className="p-5 text-sm text-shush-muted">Nothing matches these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-shush-line text-sm">
              <thead className="bg-shush-creamDeep text-left text-xs font-semibold uppercase tracking-wider text-shush-muted">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Summary</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-shush-line">
                {data.rows.map((r, i) => {
                  const meta = HISTORY_KIND_META[r.kind];
                  return (
                    <tr key={`${r.kind}-${r.occurredAt}-${i}`} className="align-top hover:bg-shush-cream">
                      <td className="whitespace-nowrap px-4 py-3 text-shush-inkSoft">{formatDateTime(r.occurredAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta?.pill ?? ''}`}>
                          {meta?.label ?? r.kind}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-shush-ink">
                        {r.tableNo ?? 'All tables'}
                      </td>
                      <td className="px-4 py-3 text-shush-ink">
                        <div className="flex flex-wrap items-center gap-2">
                          {r.summary}
                          {r.isSample && <SampleBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-shush-inkSoft">{r.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data?.truncated && (
        <p className="text-xs text-shush-muted">
          Only the first 500 records are shown. Narrow the dates or type to see the rest.
        </p>
      )}
    </div>
  );
}
