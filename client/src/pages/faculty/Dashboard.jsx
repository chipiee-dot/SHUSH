import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import Card from '../../components/Card.jsx';
import MaintenanceCard from '../../components/MaintenanceCard.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import SampleBadge from '../../components/SampleBadge.jsx';
import Stat from '../../components/Stat.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import usePolling from '../../hooks/usePolling.js';
import { formatNumber, formatTime, timeAgo } from '../../lib/format.js';

const REFRESH_MS = 10000;

const fetchAll = async () => {
  const [dashboard, layout] = await Promise.all([api.dashboard(), api.layout()]);
  return { dashboard, layout };
};

export default function Dashboard() {
  const { data, error, loading, reload, updatedAt } = usePolling(fetchAll, REFRESH_MS);

  if (!data) {
    return loading ? (
      <p className="text-sm text-shush-muted">Loading dashboard…</p>
    ) : (
      <Alert>{error || 'Could not load the dashboard.'}</Alert>
    );
  }

  const { dashboard, layout } = data;
  const s = dashboard.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-shush-ink">Dashboard</h1>
            {dashboard.sample && <SampleBadge />}
          </div>
          <p className="mt-1 text-sm text-shush-inkSoft">
            Live · updated {formatTime(updatedAt)} · refreshes every 10 seconds
          </p>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Tables occupied"
          value={`${s.tablesOccupied} / ${s.tablesTotal}`}
          hint="Tables with at least one group seated"
        />
        <Stat
          label="Active alerts"
          value={s.activeAlerts}
          tone={s.activeAlerts > 0 ? 'danger' : undefined}
          hint="Tables reporting ALERT right now"
        />
        <Stat
          label="Devices online"
          value={`${s.devicesOnline} / ${s.devicesTotal}`}
          hint="Devices that reported recently"
        />
        <Stat
          label="Sessions today"
          value={formatNumber(s.sessionsToday)}
          hint={`${formatNumber(s.studentsToday)} students · ${formatNumber(s.alertsToday)} alerts`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="Device status"
          subtitle={`${layout.tables.filter((t) => !t.device).length} table(s) have no device yet`}
        >
          {dashboard.devices.length === 0 ? (
            <p className="text-sm text-shush-muted">No devices are registered yet.</p>
          ) : (
            <ul className="divide-y divide-shush-line">
              {dashboard.devices.map((t) => (
                <li key={t.device.code} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-shush-ink">
                      Table {t.tableNo}
                      <span className="font-mono text-xs font-normal text-shush-muted">{t.device.code}</span>
                      {t.device.isSample && <SampleBadge />}
                    </div>
                    <div className="mt-0.5 text-xs text-shush-muted">
                      Level {formatNumber(t.device.level)} / threshold {formatNumber(t.device.threshold)} ·{' '}
                      {t.occupancy.groupSize}/{t.occupancy.seats} seated · seen {timeAgo(t.device.lastSeenAt)}
                    </div>
                  </div>
                  <StatusPill status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2" title="Recent alerts" subtitle="Last 24 hours, newest first">
          {dashboard.alerts.length === 0 ? (
            <p className="text-sm text-shush-muted">No alerts in the last 24 hours.</p>
          ) : (
            <ul className="divide-y divide-shush-line">
              {dashboard.alerts.map((a) => (
                <li key={a.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-shush-ink">Table {a.tableNo}</span>
                    <span className="text-xs text-shush-muted">{formatTime(a.triggeredAt)}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-shush-muted">
                    Level {formatNumber(a.level)} over {formatNumber(a.threshold)}
                    {a.isSample && <SampleBadge />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <MaintenanceCard tables={layout.tables} active={dashboard.maintenance} onChanged={reload} />
    </div>
  );
}
