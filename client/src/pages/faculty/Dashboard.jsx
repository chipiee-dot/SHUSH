import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import Card from '../../components/Card.jsx';
import { BarChart, DonutChart, MeterBar } from '../../components/charts.jsx';
import CloudBackground from '../../components/CloudBackground.jsx';
import CountUp from '../../components/CountUp.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import MaintenanceCard from '../../components/MaintenanceCard.jsx';
import SampleBadge from '../../components/SampleBadge.jsx';
import Stat from '../../components/Stat.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import usePolling from '../../hooks/usePolling.js';
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

  if (!data) {
    return loading ? (
      <p className="text-sm text-shush-muted">Loading dashboard…</p>
    ) : (
      <Alert>{error || 'Could not load the dashboard.'}</Alert>
    );
  }

  const { dashboard, layout, history } = data;
  const s = dashboard.summary;
  const tables = layout.tables;

  // Seats
  const seatTotal = tables.reduce((sum, t) => sum + (t.seats || 0), 0);
  const seatTaken = tables.reduce((sum, t) => sum + (t.occupancy?.groupSize || 0), 0);

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
            <p className="text-xs font-semibold uppercase tracking-wider text-shush-orange700">Dashboard</p>
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

      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon={<TableIcon />}
          label="Tables occupied"
          value={<><CountUp value={s.tablesOccupied} /><span className="text-shush-muted"> / {formatNumber(s.tablesTotal)}</span></>}
          progress={ratio(s.tablesOccupied, s.tablesTotal)}
          hint="Tables with at least one group seated"
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
                      {t.occupancy.groupSize}/{t.occupancy.seats} seated · seen {timeAgo(t.device.lastSeenAt)}
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
