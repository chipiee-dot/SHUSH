import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import Card from '../../components/Card.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { NAV_ICONS } from '../../components/navIcons.jsx';
import SampleBadge from '../../components/SampleBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useClickOutside from '../../hooks/useClickOutside.js';
import usePolling from '../../hooks/usePolling.js';
import { buildHistoryWorkbook, downloadBlob, downloadCsvFile, exportFileName } from '../../lib/exportHistory.js';
import { HISTORY_KIND_META, dateInputValue, formatTime } from '../../lib/format.js';

const KIND_CHIPS = [
  { value: 'all', label: 'All', pill: 'border-shush-lineStrong bg-shush-white text-shush-ink', dot: 'bg-shush-ink' },
  { value: 'alert', label: 'Alerts', pill: HISTORY_KIND_META.alert.pill, dot: 'bg-shush-danger' },
  { value: 'maintenance', label: 'Maintenance', pill: HISTORY_KIND_META.maintenance.pill, dot: 'bg-shush-orangeSoft' },
  { value: 'session', label: 'Sessions', pill: HISTORY_KIND_META.session.pill, dot: 'bg-shush-amber' },
];

const RANGES = [
  { value: 'today', label: 'Today', days: 1 },
  { value: 'week', label: 'Last 7 days', days: 7 },
  { value: 'month', label: 'Last 30 days', days: 30 },
  { value: 'custom', label: 'Custom' },
];

const KIND_ICON = {
  alert: {
    wrap: 'bg-shush-dangerSoft text-shush-danger',
    path: (
      <>
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Z" strokeLinejoin="round" />
        <path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" strokeLinecap="round" />
      </>
    ),
  },
  maintenance: {
    wrap: 'bg-shush-creamDeep text-shush-orange700',
    path: (
      <path
        d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.3-.5-.5-2.3 2.4-2.4Z"
        strokeLinejoin="round"
      />
    ),
  },
  session: {
    wrap: 'bg-shush-goldSoft text-shush-orange700',
    path: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" strokeLinecap="round" />
        <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14c1.9.6 3 2.2 3 5" strokeLinecap="round" />
      </>
    ),
  },
};

const fieldClass =
  'block rounded-xl border-shush-lineStrong bg-shush-white py-2 text-sm text-shush-ink focus:border-shush-orange focus:ring-shush-orange';

// A date as YYYY-MM-DD in the browser's time, moved by a number of days (0 = today).
function shiftDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateInputValue(d);
}

// The from/to sent to the server, or null while a custom range is still incomplete.
function rangeDates(range, custom) {
  if (range === 'custom') {
    if (!custom.from || !custom.to || custom.from > custom.to) return null;
    return { from: custom.from, to: custom.to };
  }
  const days = RANGES.find((r) => r.value === range)?.days ?? 7;
  return { from: shiftDate(-(days - 1)), to: shiftDate(0) };
}

function dayLabel(key, sample) {
  if (key === shiftDate(0)) return 'Today';
  if (key === shiftDate(-1)) return 'Yesterday';
  return new Date(sample).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}

function TimelineRow({ row, last }) {
  const icon = KIND_ICON[row.kind] ?? KIND_ICON.session;
  return (
    <li className="relative py-3 pl-[4.25rem] pr-5 transition-colors hover:bg-shush-cream">
      <span
        className={`absolute left-5 top-3 grid h-9 w-9 place-items-center rounded-full ${icon.wrap}`}
        aria-hidden="true"
      >
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          {icon.path}
        </svg>
      </span>
      {!last && (
        <span className="absolute -bottom-1 left-[2.375rem] top-[3.25rem] w-px bg-shush-lineStrong" aria-hidden="true" />
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-shush-ink">
        <span className="break-words">{row.summary}</span>
        <span className="sr-only">{HISTORY_KIND_META[row.kind]?.label ?? row.kind}</span>
        {row.isSample && <SampleBadge />}
      </div>
      {row.detail && <p className="mt-0.5 break-words text-sm text-shush-inkSoft">{row.detail}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-shush-muted">
        <span className="rounded-full bg-shush-creamDeep px-2.5 py-0.5 font-medium text-shush-orange700">
          {row.tableNo != null ? `Table ${row.tableNo}` : 'All tables'}
        </span>
        <time dateTime={new Date(row.occurredAt).toISOString()}>{formatTime(row.occurredAt)}</time>
      </div>
    </li>
  );
}

export default function History() {
  const [kind, setKind] = useState('all');
  const [tableNo, setTableNo] = useState('all');
  const [range, setRange] = useState('week');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [exportError, setExportError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(''); // 'xlsx' or 'csv' while the file is being prepared
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const { user } = useAuth();

  const dates = useMemo(() => rangeDates(range, custom), [range, custom]);
  const fetchKey = JSON.stringify([dates, tableNo]);

  // Always load every type for the range so the chips can show their counts; the chip only filters the view.
  const { data, error, loading } = usePolling(
    () => (dates ? api.history({ kind: 'all', tableNo, from: dates.from, to: dates.to }) : Promise.resolve(null)),
    0,
    [fetchKey]
  );
  const layout = usePolling(api.layout, 60000);
  const tables = useMemo(
    () => [...(layout.data?.tables ?? [])].sort((a, b) => a.tableNo - b.tableNo),
    [layout.data]
  );

  const rows = useMemo(
    () => [...(data?.rows ?? [])].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)),
    [data]
  );
  const counts = useMemo(() => {
    const c = { all: rows.length, alert: 0, maintenance: 0, session: 0 };
    rows.forEach((r) => {
      if (c[r.kind] !== undefined) c[r.kind] += 1;
    });
    return c;
  }, [rows]);
  const visible = useMemo(() => (kind === 'all' ? rows : rows.filter((r) => r.kind === kind)), [rows, kind]);

  // Group by local day, newest first (rows are already sorted).
  const groups = useMemo(() => {
    const byDay = new Map();
    visible.forEach((r) => {
      const key = dateInputValue(new Date(r.occurredAt));
      if (!byDay.has(key)) byDay.set(key, { key, label: dayLabel(key, r.occurredAt), rows: [] });
      byDay.get(key).rows.push(r);
    });
    return [...byDay.values()];
  }, [visible]);

  function change(setter) {
    return (value) => {
      setExportError('');
      setter(value);
    };
  }

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuRef, menuOpen, closeMenu);

  // Move focus into the menu when it opens; give it back to the button when it closes.
  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector('[role="menuitem"]')?.focus();
  }, [menuOpen]);

  function onMenuKey(e) {
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus();
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus();
    else if (e.key === 'Home') items[0]?.focus();
    else if (e.key === 'End') items[items.length - 1]?.focus();
    else if (e.key === 'Escape') menuButtonRef.current?.focus();
    else return;
    e.preventDefault();
  }

  // Exports exactly the rows on screen (same filters).
  async function exportReport(type) {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
    setExportError('');
    if (visible.length === 0) {
      setExportError('There is nothing to export for these filters.');
      return;
    }
    setExporting(type);
    try {
      if (type === 'xlsx') {
        const blob = await buildHistoryWorkbook(visible, {
          typeLabel: KIND_CHIPS.find((c) => c.value === kind)?.label ?? 'All',
          tableLabel: tableNo === 'all' ? 'All tables' : `Table ${tableNo}`,
          from: dates?.from,
          to: dates?.to,
          by: user ? `${user.firstName} ${user.lastName}`.trim() : '',
          generatedAt: new Date(),
        });
        downloadBlob(blob, exportFileName(kind, 'xlsx'));
      } else {
        downloadCsvFile(visible, exportFileName(kind, 'csv'));
      }
    } catch (err) {
      setExportError(err?.message ? `Could not prepare the export. ${err.message}` : 'Could not prepare the export.');
    } finally {
      setExporting('');
    }
  }

  const refreshing = loading && data !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        icon={NAV_ICONS.history}
        subtitle="Alerts, maintenance and sessions. Export the filtered list as an Excel report or a CSV."
      >
        <div ref={menuRef} className="relative">
          <button
            ref={menuButtonRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={Boolean(exporting)}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-shush-orange600 px-4 py-2.5 text-base font-semibold text-white shadow-md transition hover:bg-shush-orange700 active:bg-shush-orange700 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
          >
            {exporting ? 'Preparing…' : 'Export'}
            {!exporting && (
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="Export format"
              onKeyDown={onMenuKey}
              className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-shush-line bg-shush-white p-1.5 shadow-[0_16px_36px_-18px_rgba(242,95,19,0.5)]"
            >
              {[
                ['xlsx', 'Excel report (.xlsx)', 'Colored and formatted'],
                ['csv', 'CSV (.csv)', 'Plain data for other tools'],
              ].map(([type, title, hint]) => (
                <button
                  key={type}
                  type="button"
                  role="menuitem"
                  onClick={() => exportReport(type)}
                  className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-shush-creamDeep focus:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
                >
                  <span className="block text-sm font-semibold text-shush-ink">{title}</span>
                  <span className="block text-xs text-shush-inkSoft">{hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PageHeader>

      {/* Filters stay in the normal flow (not sticky) so they never cover the page header or the timeline. */}
      <Card>
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
          {KIND_CHIPS.map((chip) => {
            const active = kind === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={active}
                onClick={() => change(setKind)(chip.value)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-1 ${chip.pill} ${
                  active ? 'ring-2 ring-shush-orange ring-offset-1' : ''
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} aria-hidden="true" />
                {chip.label}
                {data && <span className="tabular-nums">{counts[chip.value]}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3">
          <label className="block text-sm font-medium text-shush-inkSoft">
            Table
            <select
              className={`${fieldClass} mt-1 w-full min-w-[11rem] sm:w-56`}
              value={tableNo}
              onChange={(e) => change(setTableNo)(e.target.value)}
            >
              <option value="all">All tables</option>
              {tables.map((t) => (
                <option key={t.tableNo} value={t.tableNo}>
                  Table {t.tableNo}
                </option>
              ))}
            </select>
          </label>

          <div role="group" aria-label="Date range" className="flex flex-wrap gap-2">
            {RANGES.map((r) => {
              const active = range === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => change(setRange)(r.value)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-1 ${
                    active
                      ? 'border-shush-orange600 bg-shush-orange600 text-white'
                      : 'border-shush-lineStrong bg-shush-white text-shush-inkSoft hover:bg-shush-creamDeep'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {range === 'custom' && (
            <>
              <label className="block text-sm font-medium text-shush-inkSoft">
                From
                <input
                  type="date"
                  className={`${fieldClass} mt-1`}
                  value={custom.from}
                  max={custom.to || undefined}
                  onChange={(e) => change(setCustom)({ ...custom, from: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium text-shush-inkSoft">
                To
                <input
                  type="date"
                  className={`${fieldClass} mt-1`}
                  value={custom.to}
                  min={custom.from || undefined}
                  onChange={(e) => change(setCustom)({ ...custom, to: e.target.value })}
                />
              </label>
            </>
          )}
        </div>
        {range === 'custom' && (
          <p className="mt-3 text-xs text-shush-muted">Pick a start and an end date. Dates use the library's time zone.</p>
        )}
      </Card>

      {(error || exportError) && <Alert>{exportError || error}</Alert>}

      {/* No overflow clipping here: sticky day headers need the page to be their scroll container. */}
      <Card className={`!p-0 transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
        {!data ? (
          dates === null ? (
            <EmptyState title="Choose a date range" text="Pick a start and an end date to load the history." />
          ) : loading ? (
            <p className="p-5 text-sm text-shush-muted">Loading history…</p>
          ) : (
            <p className="p-5 text-sm text-shush-muted">No history to show.</p>
          )
        ) : visible.length === 0 ? (
          <EmptyState title="Nothing here" text="No activity matches these filters. Try a longer date range." />
        ) : (
          groups.map((group, gi) => {
            const lastGroup = gi === groups.length - 1;
            return (
              <section key={group.key} aria-label={group.label}>
                <h2
                  className={`sticky top-0 z-10 border-b border-shush-line bg-shush-creamDeep px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-shush-inkSoft ${
                    gi === 0 ? 'rounded-t-[0.9rem]' : 'border-t'
                  }`}
                >
                  {group.label}
                </h2>
                <ol className={lastGroup ? 'overflow-hidden rounded-b-[0.9rem]' : ''}>
                  {group.rows.map((row, i) => (
                    <TimelineRow
                      key={`${row.kind}-${row.occurredAt}-${row.tableNo ?? 'all'}-${i}`}
                      row={row}
                      last={i === group.rows.length - 1}
                    />
                  ))}
                </ol>
              </section>
            );
          })
        )}
      </Card>

      {data?.truncated && (
        <p className="text-xs text-shush-muted">
          Only the latest 500 records are shown, so the counts above are incomplete. Narrow the dates or pick one table to
          see the rest.
        </p>
      )}
    </div>
  );
}
