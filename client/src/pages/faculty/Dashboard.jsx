import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api.js';
import { useErrorToast, useToast } from '../../components/Toast.jsx';
import { NAV_ICONS } from '../../components/navIcons.jsx';
import Card from '../../components/Card.jsx';
import { BarChart, DonutChart, MeterBar, WorkingHoursChart } from '../../components/charts.jsx';
import CloudBackground from '../../components/CloudBackground.jsx';
import CountUp from '../../components/CountUp.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import MaintenanceCard from '../../components/MaintenanceCard.jsx';
import SampleBadge from '../../components/SampleBadge.jsx';
import Stat from '../../components/Stat.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useClickOutside from '../../hooks/useClickOutside.js';
import usePolling from '../../hooks/usePolling.js';
import {
  analyticsExportFileName,
  buildAnalyticsWorkbook,
  downloadAnalyticsCsvFile,
  downloadBlob,
} from '../../lib/exportHistory.js';
import { STATUS_META, dateInputValue, formatNumber, formatTime, timeAgo } from '../../lib/format.js';

const REFRESH_MS = 10000;

// Same colors as STATUS_META (that file stores Tailwind classes; the charts need CSS variables).
const STATUS_COLOR = {
  QUIET: 'var(--shush-success)',
  LOUD: 'var(--shush-amber)',
  ALERT: 'var(--shush-danger)',
  MAINTENANCE: 'var(--shush-orange-soft)',
  OFFLINE: 'var(--shush-muted)',
  NO_DEVICE: 'var(--shush-line-strong)',
};

const fetchAll = async () => {
  const today = dateInputValue();
  const [dashboard, layout, history] = await Promise.all([
    api.dashboard(),
    api.layout(),
    // A failed history call only empties the by-hour chart; it must not break the dashboard.
    api.history({ kind: 'alert', from: today, to: today }).catch(() => null),
  ]);
  return { dashboard, layout, history };
};

const ratio = (part, whole) => (whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0);

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, viewBox: '0 0 24 24', strokeLinecap: 'round', strokeLinejoin: 'round' };
const TableIcon = () => (
  <svg {...ICON}><rect x="3" y="5" width="18" height="6" rx="1.5" /><path d="M6 11v8M18 11v8" /></svg>
);
const BellIcon = () => (
  <svg {...ICON}><path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
);
const SignalIcon = () => (
  <svg {...ICON}><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" /></svg>
);
const ClockIcon = () => (
  <svg {...ICON}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const WaveIcon = () => (
  <svg {...ICON}><path d="M3 12h3l2-6 4 12 3-8 2 2h4" /></svg>
);

const ANALYTICS_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7 Days' },
  { value: 'month', label: '30 Days' },
];

const formatHourClock = (hour) => {
  const h = ((Number(hour) % 24) + 24) % 24;
  return `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
};

function AnalyticsPeriodToggle({ period, onChange }) {
  const index = Math.max(0, ANALYTICS_PERIODS.findIndex((p) => p.value === period));
  return (
    <div
      role="group"
      aria-label="Analytics time range"
      className="relative inline-grid grid-cols-3 rounded-xl border border-shush-lineStrong bg-shush-white p-1"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-shush-orange shadow-md transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {ANALYTICS_PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          aria-pressed={period === p.value}
          onClick={() => onChange(p.value)}
          className={`relative z-10 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-1 ${
            period === p.value ? 'text-white' : 'text-shush-inkSoft hover:text-shush-ink'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function WorkingHoursAnalyticsCard({ tables = [] }) {
  const { user } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState('week');
  const [tableNo, setTableNo] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState('');
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  const sortedTables = useMemo(
    () => [...tables].sort((a, b) => a.tableNo - b.tableNo),
    [tables]
  );

  const { data, error, loading, reload } = usePolling(
    () => api.noiseAnalytics({ period, tableNo }),
    REFRESH_MS,
    [period, tableNo]
  );
  useErrorToast(error);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuRef, menuOpen, closeMenu);

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
    else if (e.key === 'Escape') {
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    } else return;
    e.preventDefault();
  }

  const refreshing = loading && data !== null;
  const peakHour = data?.peakHour ?? null;
  const quietestHour = data?.quietestHour ?? null;
  const contrast = data?.contrast ?? null;
  const hours = data?.hours ?? [];
  const overallAvgLevel = data?.overallAvgLevel ?? 0;
  const totalAlerts = data?.totalAlerts ?? 0;
  const totalSessions = data?.totalSessions ?? 0;
  const totalReadings = data?.totalReadings ?? 0;
  const workHours = data?.workHours ?? { start: 8, end: 17, excludeWeekends: false };
  const workWindowText = `${formatHourClock(workHours.start)} – ${formatHourClock(workHours.end)}${
    workHours.excludeWeekends ? ' · Mon–Fri' : ''
  }`;
  const tableLabel = tableNo === 'all' ? 'All tables' : `Table ${tableNo}`;
  const periodLabel = ANALYTICS_PERIODS.find((p) => p.value === period)?.label ?? period;
  const meterScale = Math.max(peakHour?.avgLevel ?? 0, quietestHour?.avgLevel ?? 0, 1);

  async function exportAnalytics(type) {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
    if (!data || hours.length === 0) {
      toast.error('Nothing to export yet.');
      return;
    }
    setExporting(type);
    const meta = {
      periodLabel,
      tableLabel,
      workWindowText,
      by: user ? `${user.firstName} ${user.lastName}`.trim() : '',
      generatedAt: new Date(),
    };
    try {
      const filename = analyticsExportFileName(period, tableNo, type);
      if (type === 'xlsx') {
        const blob = await buildAnalyticsWorkbook(data, meta);
        downloadBlob(blob, filename);
      } else {
        downloadAnalyticsCsvFile(data, meta, filename);
      }
      toast.success('Analytics exported.');
    } catch {
      toast.error('Could not prepare the export.');
    } finally {
      setExporting('');
    }
  }

  const activityLabel = (slot) => {
    const parts = [`${formatNumber(slot.sessionCount)} session${slot.sessionCount === 1 ? '' : 's'}`];
    if ((slot.readingCount ?? 0) > 0) {
      parts.push(`${formatNumber(slot.readingCount)} reading${slot.readingCount === 1 ? '' : 's'}`);
    }
    return parts.join(' · ');
  };

  return (
    <Card
      icon={<WaveIcon />}
      title="Peak vs. quietest working hours"
      subtitle={`${workWindowText} · ${tableLabel.toLowerCase()} · session, sensor reading & alert contrast`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="analytics-table-filter">
            Filter analytics by table
          </label>
          <select
            id="analytics-table-filter"
            aria-label="Filter analytics by table"
            value={tableNo}
            onChange={(e) => setTableNo(e.target.value)}
            className="rounded-xl border border-shush-lineStrong bg-shush-white py-1.5 pl-3 pr-8 text-xs font-semibold text-shush-ink focus:border-shush-orange focus:ring-shush-orange"
          >
            <option value="all">All tables</option>
            {sortedTables.map((t) => (
              <option key={t.tableNo} value={String(t.tableNo)}>
                Table {t.tableNo}
              </option>
            ))}
          </select>

          <AnalyticsPeriodToggle period={period} onChange={setPeriod} />

          <div ref={menuRef} className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={Boolean(exporting) || !data || hours.length === 0}
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-shush-lineStrong bg-shush-white px-3 py-1.5 text-xs font-semibold text-shush-ink transition hover:bg-shush-creamDeep disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-1"
            >
              {exporting ? 'Exporting…' : 'Export'}
              {!exporting && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            {menuOpen && (
              <div
                role="menu"
                aria-label="Export analytics format"
                onKeyDown={onMenuKey}
                className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-shush-line bg-shush-white p-1.5 shadow-[0_16px_36px_-18px_rgba(242,95,19,0.5)]"
              >
                {[
                  ['xlsx', 'Excel report (.xlsx)', 'Summary cards & hourly table'],
                  ['csv', 'CSV (.csv)', 'Plain hourly breakdown'],
                ].map(([type, title, hint]) => (
                  <button
                    key={type}
                    type="button"
                    role="menuitem"
                    onClick={() => exportAnalytics(type)}
                    className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-shush-creamDeep focus:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
                  >
                    <span className="block text-sm font-semibold text-shush-ink">{title}</span>
                    <span className="block text-xs text-shush-inkSoft">{hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      }
    >
      {!data ? (
        loading ? (
          <p className="py-8 text-sm text-shush-muted">Loading working-hours analytics…</p>
        ) : (
          <EmptyState
            title="Could not load working-hours analytics"
            text="The live cards on this dashboard are still updating."
            action={
              <button
                type="button"
                onClick={reload}
                className="rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-2 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
              >
                Try again
              </button>
            }
          />
        )
      ) : !peakHour ? (
        <EmptyState
          title="No working-hours activity yet"
          text={`No sessions, sensor readings or alerts recorded for ${tableLabel.toLowerCase()} during ${workWindowText} in this period.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {period === 'today' && (
                <button
                  type="button"
                  onClick={() => setPeriod('week')}
                  className="rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-2 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
                >
                  View last 7 days
                </button>
              )}
              {tableNo !== 'all' && (
                <button
                  type="button"
                  onClick={() => setTableNo('all')}
                  className="rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-2 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
                >
                  Show all tables
                </button>
              )}
            </div>
          }
        />
      ) : (
        <div className={`grid gap-6 lg:grid-cols-12 transition-opacity ${refreshing ? 'opacity-70' : ''}`}>
          <div className="space-y-3 lg:col-span-5">
            <div className="rounded-xl border border-shush-danger/30 bg-shush-dangerSoft/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-shush-dangerSoft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-shush-danger">
                  Noisiest hour
                  {peakHour.alertCount > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-shush-danger" aria-hidden="true" />
                  )}
                </span>
                <span className="text-xs font-medium text-shush-inkSoft tabular-nums">
                  {activityLabel(peakHour)}
                </span>
              </div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-shush-ink">
                {peakHour.slotLabel}
              </div>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-2xl font-semibold tracking-tight text-shush-danger tabular-nums">
                  {peakHour.sessionCount > 0 || (peakHour.readingCount ?? 0) > 0 ? (
                    <CountUp value={peakHour.avgLevel} />
                  ) : (
                    '—'
                  )}{' '}
                  <span className="text-xs font-medium text-shush-inkSoft">avg level</span>
                </div>
                <span className="rounded-full bg-shush-white/90 px-2.5 py-0.5 text-xs font-semibold text-shush-danger ring-1 ring-shush-danger/20 tabular-nums">
                  {formatNumber(peakHour.alertCount)} alert{peakHour.alertCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {quietestHour ? (
              <div className="rounded-xl border border-shush-success/25 bg-shush-successSoft/55 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-shush-success/20 bg-shush-successSoft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-shush-success">
                    Quietest hour
                  </span>
                  <span className="text-xs font-medium text-shush-inkSoft tabular-nums">
                    {activityLabel(quietestHour)}
                  </span>
                </div>
                <div className="mt-2 text-lg font-semibold tracking-tight text-shush-ink">
                  {quietestHour.slotLabel}
                </div>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-2xl font-semibold tracking-tight text-shush-success tabular-nums">
                    {quietestHour.sessionCount > 0 || (quietestHour.readingCount ?? 0) > 0 ? (
                      <CountUp value={quietestHour.avgLevel} />
                    ) : (
                      '—'
                    )}{' '}
                    <span className="text-xs font-medium text-shush-inkSoft">avg level</span>
                  </div>
                  <span className="rounded-full bg-shush-white/90 px-2.5 py-0.5 text-xs font-semibold text-shush-inkSoft ring-1 ring-shush-lineStrong tabular-nums">
                    {formatNumber(quietestHour.alertCount)} alert{quietestHour.alertCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-shush-lineStrong bg-shush-cream p-4">
                <span className="inline-flex items-center rounded-full bg-shush-successSoft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-shush-success">
                  Quietest hour
                </span>
                <p className="mt-2 text-xs text-shush-inkSoft">
                  Waiting for a second active hour to compare noise levels.
                </p>
              </div>
            )}

            {contrast && (
              <div className="rounded-xl border border-shush-line bg-shush-cream p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-shush-muted">
                    Peak vs. quietest contrast
                  </span>
                  <span className="rounded-full bg-shush-goldSoft px-2.5 py-0.5 text-xs font-semibold text-shush-orange700 tabular-nums">
                    {peakHour.avgLevel > 0
                      ? `${contrast.quietPct}% quieter`
                      : `${formatNumber(Math.abs(contrast.alertDelta))} fewer alert${Math.abs(contrast.alertDelta) === 1 ? '' : 's'}`}
                  </span>
                </div>
                {peakHour.avgLevel > 0 && (
                  <p className="mt-1 text-xs text-shush-inkSoft tabular-nums">
                    -{formatNumber(contrast.levelDelta)} avg level difference from peak to quietest hour
                  </p>
                )}
                {peakHour.avgLevel > 0 && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-shush-inkSoft">
                        <span className="font-medium text-shush-danger">Peak ({peakHour.label})</span>
                        <span className="font-semibold tabular-nums">{formatNumber(peakHour.avgLevel)}</span>
                      </div>
                      <MeterBar
                        value={peakHour.avgLevel}
                        max={meterScale}
                        colorVar="--shush-danger"
                        label="Peak hour noise level"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-shush-inkSoft">
                        <span className="font-medium text-shush-success">Quietest ({quietestHour.label})</span>
                        <span className="font-semibold tabular-nums">{formatNumber(quietestHour.avgLevel)}</span>
                      </div>
                      <MeterBar
                        value={quietestHour.avgLevel}
                        max={meterScale}
                        colorVar="--shush-success"
                        label="Quietest hour noise level"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-shush-line bg-shush-cream/40 p-4 lg:col-span-7">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-shush-muted">
                  Hourly average noise level ({workWindowText})
                </h3>
                {data.hasSampleData && <SampleBadge />}
              </div>
              <WorkingHoursChart
                hours={hours}
                peakHour={peakHour}
                quietestHour={quietestHour}
                avgLevel={overallAvgLevel}
                height={190}
              />
            </div>

            <div className="mt-4 space-y-2 border-t border-shush-line pt-3 text-xs text-shush-inkSoft">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-shush-danger" aria-hidden="true" /> Peak (noisiest)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-shush-success" aria-hidden="true" /> Quietest
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-shush-orange" aria-hidden="true" /> Above avg
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-shush-amber" aria-hidden="true" /> Below avg
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-shush-danger" aria-hidden="true" /> Alert triggered
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-shush-muted tabular-nums">
                <span>
                  Working-hours avg: <strong className="text-shush-ink">{overallAvgLevel > 0 ? formatNumber(overallAvgLevel) : '—'}</strong>
                </span>
                <span>
                  {formatNumber(totalAlerts)} alert{totalAlerts === 1 ? '' : 's'} · {formatNumber(totalSessions)} session{totalSessions === 1 ? '' : 's'}
                  {totalReadings > 0 ? ` · ${formatNumber(totalReadings)} reading${totalReadings === 1 ? '' : 's'}` : ''}
                </span>
              </div>
              {data.alertsTruncated && (
                <p className="text-[11px] text-shush-muted">
                  Only the latest 500 alerts in this range are counted.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Chip({ label, children, alertDot }) {
  return (
    <div className="rounded-xl border border-shush-line bg-shush-white/80 px-4 py-2.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-shush-muted">
        {label}
        {alertDot && (
          <span className="relative inline-flex h-2 w-2" aria-hidden="true">
            <span className="shush-pulse-ring absolute inset-0 rounded-full bg-shush-danger" />
            <span className="relative h-2 w-2 rounded-full bg-shush-danger" />
          </span>
        )}
      </div>
      <div className="mt-0.5 text-xl font-semibold tracking-tight text-shush-ink">{children}</div>
    </div>
  );
}

function Legend({ items }) {
  return (
    <ul className="mt-4 space-y-1.5 text-sm">
      {items.map((item) => (
        <li key={item.key} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-shush-inkSoft">
            <span className={`h-2.5 w-2.5 rounded-full ${item.dotClass ?? ''}`} style={item.color ? { background: item.color } : undefined} aria-hidden="true" />
            {item.label}
          </span>
          <span className="font-semibold tabular-nums text-shush-ink">{formatNumber(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload, updatedAt } = usePolling(fetchAll, REFRESH_MS);
  useErrorToast(error);

  if (!data) {
    return loading ? (
      <p className="text-sm text-shush-muted">Loading dashboard…</p>
    ) : (
      <EmptyState
        title="Dashboard unavailable"
        text="Check your connection, then try again."
        action={
          <button
            type="button"
            onClick={reload}
            className="rounded-xl border border-shush-lineStrong bg-shush-white px-4 py-2 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
          >
            Try again
          </button>
        }
      />
    );
  }

  const { dashboard, layout, history } = data;
  const s = dashboard.summary;
  const tables = layout.tables;

  // Seats
  const seatTotal = tables.reduce((sum, t) => sum + (t.seats || 0), 0);
  const seatTaken = tables.reduce((sum, t) => sum + (t.occupancy?.seated || 0), 0);

  // Tables by status, in the same order and with the same labels as the Table layout page.
  const statusItems = Object.keys(STATUS_META)
    .map((key) => ({
      key,
      label: STATUS_META[key].label,
      dotClass: STATUS_META[key].dot,
      color: STATUS_COLOR[key],
      value: tables.filter((t) => t.status === key).length,
    }))
    .filter((item) => item.value > 0);

  // Alerts today by local hour, from midnight to the current hour.
  const currentHour = new Date().getHours();
  const hourly = history
    ? (() => {
        const counts = Array.from({ length: currentHour + 1 }, () => 0);
        history.rows.forEach((r) => {
          const h = new Date(r.occurredAt).getHours();
          if (h >= 0 && h <= currentHour) counts[h] += 1;
        });
        return counts.map((value, h) => ({ label: hourLabel(h), value }));
      })()
    : null;
  const alertRows = history ? history.rows.length : 0;

  const firstName = user?.firstName;
  const devicesWithoutDevice = tables.filter((t) => !t.device).length;

  return (
    <div className="space-y-6">
      <Card tone="accent" className="relative overflow-hidden">
        <CloudBackground variant="card" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-shush-orange700">
              <span className="grid place-items-center [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{NAV_ICONS.dashboard}</span>
              Dashboard
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-shush-ink">
                {greeting()}{firstName ? `, ${firstName}` : ''}
              </h1>
              {dashboard.sample && <SampleBadge />}
            </div>
            <p className="mt-1 text-sm text-shush-inkSoft">
              Live · updated {formatTime(updatedAt)} · refreshes every 10 seconds
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Chip label="Alerts now" alertDot={s.activeAlerts > 0}>
              <CountUp value={s.activeAlerts} />
            </Chip>
            <Chip label="Devices online">
              <CountUp value={s.devicesOnline} /> <span className="text-shush-muted">/ {formatNumber(s.devicesTotal)}</span>
            </Chip>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon={<TableIcon />}
          label="Tables occupied"
          value={<><CountUp value={s.tablesOccupied} /><span className="text-shush-muted"> / {formatNumber(s.tablesTotal)}</span></>}
          progress={ratio(s.tablesOccupied, s.tablesTotal)}
          hint="Tables with at least one student seated"
        />
        <Stat
          icon={<BellIcon />}
          label="Active alerts"
          value={s.activeAlerts}
          tone={s.activeAlerts > 0 ? 'danger' : undefined}
          hint="Tables reporting ALERT right now"
        />
        <Stat
          icon={<SignalIcon />}
          label="Devices online"
          value={<><CountUp value={s.devicesOnline} /><span className="text-shush-muted"> / {formatNumber(s.devicesTotal)}</span></>}
          progress={ratio(s.devicesOnline, s.devicesTotal)}
          hint="Devices that reported recently"
        />
        <Stat
          icon={<ClockIcon />}
          label="Sessions today"
          value={s.sessionsToday}
          hint={`${formatNumber(s.studentsToday)} students · ${formatNumber(s.alertsToday)} alerts`}
        />
      </div>

      <WorkingHoursAnalyticsCard tables={tables} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Seat occupancy" subtitle="Seats taken right now">
          {seatTotal === 0 ? (
            <EmptyState title="No seats yet" text="Add tables on the Table layout page." />
          ) : (
            <div className="flex flex-col items-center">
              <DonutChart
                centerValue={`${seatTaken}/${seatTotal}`}
                centerLabel="seats taken"
                segments={[
                  { key: 'taken', label: 'Taken', value: seatTaken, color: 'var(--shush-orange)' },
                  { key: 'free', label: 'Free', value: Math.max(0, seatTotal - seatTaken), color: 'var(--shush-gold)' },
                ]}
              />
              <div className="w-full">
                <Legend
                  items={[
                    { key: 'taken', label: 'Taken', value: seatTaken, color: 'var(--shush-orange)' },
                    { key: 'free', label: 'Free', value: Math.max(0, seatTotal - seatTaken), color: 'var(--shush-gold)' },
                  ]}
                />
              </div>
            </div>
          )}
        </Card>

        <Card title="Table status" subtitle="Every table by current status">
          {tables.length === 0 ? (
            <EmptyState title="No tables yet" text="Add tables on the Table layout page." />
          ) : (
            <div className="flex flex-col items-center">
              <DonutChart
                centerValue={tables.length}
                centerLabel="tables"
                segments={statusItems.map((i) => ({ key: i.key, label: i.label, value: i.value, color: i.color }))}
              />
              <div className="w-full">
                <Legend items={statusItems} />
              </div>
            </div>
          )}
        </Card>

        <Card title="Alerts today by hour" subtitle={history ? `${formatNumber(alertRows)} alert(s) so far today` : 'Local time'}>
          {!hourly ? (
            <EmptyState title="Could not load today's alerts" text="The other numbers on this page are still live." />
          ) : alertRows === 0 ? (
            <EmptyState title="No alerts today" text="Quiet so far. Alerts will appear here by hour." />
          ) : (
            <>
              <BarChart data={hourly} height={150} />
              {history.truncated && (
                <p className="mt-3 text-xs text-shush-muted">
                  Only the latest {formatNumber(alertRows)} alerts are shown, so this chart is incomplete.
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="Device status"
          subtitle={`${devicesWithoutDevice} table(s) have no device yet`}
        >
          {dashboard.devices.length === 0 ? (
            <EmptyState title="No devices yet" text="Devices appear here once they are registered to a table." />
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
              {dashboard.devices.map((t, i) => {
                const level = t.device.level ?? 0;
                const threshold = t.device.threshold ?? 0;
                return (
                  <li
                    key={t.device.code}
                    className="shush-rise rounded-xl border border-shush-line bg-shush-cream p-4"
                    style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-shush-ink">Table {t.tableNo}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-shush-muted">{t.device.code}</span>
                          {t.device.isSample && <SampleBadge />}
                        </div>
                      </div>
                      <StatusPill status={t.status} />
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-shush-inkSoft">
                        <span>Noise level</span>
                        <span className="tabular-nums">
                          {formatNumber(t.device.level)} / {formatNumber(t.device.threshold)}
                        </span>
                      </div>
                      <MeterBar
                        value={level}
                        max={Math.max(threshold * 1.5, level * 1.1, 1)}
                        markerAt={t.device.threshold == null ? undefined : threshold}
                        colorVar={STATUS_COLOR[t.status] ?? '--shush-orange'}
                        label={`Table ${t.tableNo} noise level against its threshold`}
                      />
                    </div>
                    <div className="mt-3 text-xs text-shush-muted">
                      {t.occupancy.seated}/{t.occupancy.seats} seated · seen {timeAgo(t.device.lastSeenAt)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2" title="Recent alerts" subtitle="Last 24 hours, newest first">
          {dashboard.alerts.length === 0 ? (
            <EmptyState title="No alerts" text="No alerts in the last 24 hours." />
          ) : (
            <ol>
              {dashboard.alerts.map((a, i) => {
                const last = i === dashboard.alerts.length - 1;
                return (
                  <li key={a.id} className={`relative pl-6 ${last ? '' : 'pb-5'}`}>
                    {!last && <span className="absolute bottom-0 left-[5px] top-3 w-px bg-shush-lineStrong" aria-hidden="true" />}
                    <span className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-shush-white bg-shush-danger ring-1 ring-shush-danger/40" aria-hidden="true" />
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-shush-ink">Table {a.tableNo}</span>
                      <span className="text-xs text-shush-muted">{formatTime(a.triggeredAt)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-shush-muted">
                      Level {formatNumber(a.level)} over {formatNumber(a.threshold)}
                      {a.isSample && <SampleBadge />}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      <MaintenanceCard tables={tables} active={dashboard.maintenance} onChanged={reload} />
    </div>
  );
}
