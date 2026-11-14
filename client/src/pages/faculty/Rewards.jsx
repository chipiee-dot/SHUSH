import { useState } from 'react';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import Card from '../../components/Card.jsx';
import CountUp from '../../components/CountUp.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import usePolling from '../../hooks/usePolling.js';
import { formatDateTime } from '../../lib/format.js';

const REFRESH_MS = 30000;
const STAGGER_MS = 40;
const PERIODS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

// Avatar fills cycle orange, amber, gold; all take ink text (white on these fails contrast).
const AVATAR_BG = ['bg-shush-orange', 'bg-shush-amber', 'bg-shush-gold'];
// Podium styling by rank: ring around the avatar, medallion fill, pedestal height.
const PLACE = {
  1: { ring: 'ring-shush-gold', medal: 'bg-shush-gold', base: 'h-16 bg-shush-goldSoft' },
  2: { ring: 'ring-shush-amber', medal: 'bg-shush-amber', base: 'h-12 bg-shush-creamDeep' },
  3: { ring: 'ring-shush-orangeSoft', medal: 'bg-shush-orangeSoft', base: 'h-9 bg-shush-creamDeep' },
};

function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function Crown() {
  return (
    <svg className="h-5 w-5 text-shush-amber" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" />
    </svg>
  );
}

function PodiumPlace({ entry, rank, unit, delay }) {
  const place = PLACE[rank];
  return (
    <li className="shush-rise flex min-w-0 max-w-[9rem] flex-1 flex-col items-center text-center" style={{ animationDelay: `${delay}ms` }}>
      <div className="relative mt-4">
        {rank === 1 && (
          <span className="absolute -top-4 left-1/2 -translate-x-1/2">
            <Crown />
          </span>
        )}
        <div
          className={`grid h-14 w-14 place-items-center rounded-full text-lg font-bold text-shush-ink ring-4 ${place.ring} ${AVATAR_BG[(rank - 1) % 3]}`}
          aria-hidden="true"
        >
          {initials(entry.name)}
        </div>
        <span
          className={`absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-shush-white text-xs font-bold text-shush-ink ${place.medal}`}
        >
          <span className="sr-only">Rank </span>
          {rank}
        </span>
      </div>
      <div className="mt-2 w-full truncate text-sm font-semibold text-shush-ink" title={entry.name}>
        {entry.name}
      </div>
      {entry.section && <div className="w-full truncate text-xs text-shush-muted">{entry.section}</div>}
      <div className="mt-1 text-2xl font-semibold leading-none tracking-tight text-shush-ink">
        <CountUp value={entry.value} />
      </div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-shush-muted">{unit}</div>
      <div className={`mt-2 w-full rounded-t-xl ${place.base}`} aria-hidden="true" />
    </li>
  );
}

function RankRow({ entry, rank, unit, fill, showCount, delay }) {
  return (
    <li className="shush-rise py-3" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-shush-goldSoft text-xs font-bold text-shush-orange700">
          <span className="sr-only">Rank </span>
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-shush-ink" title={entry.name}>
            {entry.name}
          </div>
          {(entry.section || showCount) && (
            <div className="truncate text-xs text-shush-muted">
              {[entry.section, showCount ? `${entry.sessionCount} session(s)` : null].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div className="flex-none text-right text-sm font-semibold text-shush-ink">
          <CountUp value={entry.value} /> <span className="text-xs font-medium text-shush-muted">{unit}</span>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-shush-creamDeep" aria-hidden="true">
        <div className="h-full rounded-full bg-shush-orange" style={{ width: `${Math.round(fill * 100)}%` }} />
      </div>
    </li>
  );
}

/**
 * One leaderboard. lowerIsBetter: the smallest value is first and the bars are bestValue / value.
 * Top three show as a podium (2nd, 1st, 3rd); the rest are rows with a relative bar.
 */
function Board({ title, subtitle, entries, unit, empty, showCount = true, lowerIsBetter = false }) {
  const values = entries.map((e) => Number(e.value)).filter(Number.isFinite);
  const topValue = values.length ? Math.max(...values) : 0;
  const bestValue = values.length ? Math.min(...values) : 0;

  function fillFor(entry) {
    const v = Number(entry.value);
    if (!Number.isFinite(v)) return 0;
    if (lowerIsBetter) return v <= 0 ? 1 : Math.min(1, bestValue / v);
    return topValue > 0 ? Math.min(1, v / topValue) : 0;
  }

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  // Visual order 2nd, 1st, 3rd; places that do not exist are skipped.
  const podiumOrder = [2, 1, 3].filter((rank) => podium[rank - 1]);

  return (
    <Card title={title} subtitle={subtitle}>
      {entries.length === 0 ? (
        <EmptyState title="Nothing here yet" text={empty} />
      ) : (
        <>
          <ol className="flex items-end justify-center gap-3" aria-label={`${title}: top three`}>
            {podiumOrder.map((rank) => (
              <PodiumPlace
                key={podium[rank - 1].studentId}
                entry={podium[rank - 1]}
                rank={rank}
                unit={unit}
                delay={(rank - 1) * STAGGER_MS}
              />
            ))}
          </ol>
          {rest.length > 0 && (
            <ol start={4} className="mt-4 divide-y divide-shush-line border-t border-shush-line" aria-label={`${title}: other ranks`}>
              {rest.map((entry, i) => (
                <RankRow
                  key={entry.studentId}
                  entry={entry}
                  rank={i + 4}
                  unit={unit}
                  fill={fillFor(entry)}
                  showCount={showCount}
                  delay={(i + 3) * STAGGER_MS}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </Card>
  );
}

/** Segmented control with a sliding indicator (transform only). */
function PeriodToggle({ period, onChange }) {
  const index = Math.max(0, PERIODS.findIndex((p) => p.value === period));
  return (
    <div
      role="group"
      aria-label="Period"
      className="relative inline-grid grid-cols-2 rounded-xl border border-shush-lineStrong bg-shush-white p-1"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-shush-orange600 shadow-md transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          aria-pressed={period === p.value}
          onClick={() => onChange(p.value)}
          className={`relative z-10 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-1 ${
            period === p.value ? 'text-white' : 'text-shush-inkSoft hover:text-shush-ink'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export default function Rewards() {
  const [period, setPeriod] = useState('month');
  // Tag the data with its period so the entrance replays only when a new period's data arrives,
  // not on the 30-second refresh.
  const { data, error, loading, updatedAt } = usePolling(
    () => api.rewards(period).then((d) => ({ ...d, period })),
    REFRESH_MS,
    [period],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rewards"
        sample={data?.hasSampleData}
        subtitle={
          updatedAt
            ? `Updated ${formatDateTime(updatedAt)}. Each member of a session receives that session's table score.`
            : 'Each member of a session receives that session\u2019s table score.'
        }
      >
        <PeriodToggle period={period} onChange={setPeriod} />
      </PageHeader>

      {error && <Alert>{error}</Alert>}

      {!data ? (
        loading && <p className="text-sm text-shush-muted">Loading rewards…</p>
      ) : (
        <div key={data.period} className="grid gap-6 lg:grid-cols-3">
          <Board
            title="Most Frequent Visitor"
            subtitle="Most sessions in the period"
            entries={data.mostFrequent}
            unit="visits"
            empty="No sessions in this period yet."
          />
          <Board
            title="Quietest Visitor"
            subtitle="Quietest table during your sessions. Avg level, lower is quieter."
            entries={data.quietest}
            unit="avg level"
            empty="No sessions of 30 minutes or more in this period yet."
            lowerIsBetter
          />
          <Board
            title="Quiet Streak"
            subtitle="Sessions in a row with no alert. Resets after an alert."
            entries={data.quietStreak}
            unit="in a row"
            empty="No active quiet streaks yet."
            showCount={false}
          />
        </div>
      )}

      {data?.hasSampleData && (
        <p className="text-xs text-shush-orange700">
          Sample data: these standings use sample sessions and quiet scores until the devices are connected.
        </p>
      )}
    </div>
  );
}
