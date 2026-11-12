import { useState } from 'react';
import { api } from '../../api.js';
import Alert from '../../components/Alert.jsx';
import Card from '../../components/Card.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import usePolling from '../../hooks/usePolling.js';
import { formatDateTime, formatNumber } from '../../lib/format.js';

const REFRESH_MS = 30000;
const PERIODS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

function Board({ title, subtitle, entries, valueText, empty, showCount = true }) {
  return (
    <Card title={title} subtitle={subtitle}>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ol className="divide-y divide-[#f1ede3]">
          {entries.map((entry, index) => (
            <li key={entry.studentId} className="flex items-center gap-3 py-3">
              <span
                className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold ${
                  index === 0 ? 'bg-[#1b2d5a] text-white' : 'bg-[#f1ede3] text-[#1b2d5a]'
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[#152549]">{entry.name}</div>
                {(entry.section || showCount) && (
                  <div className="text-xs text-slate-500">
                    {[entry.section, showCount ? `${entry.sessionCount} session(s)` : null].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div className="text-right text-sm font-semibold text-[#152549]">{valueText(entry)}</div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default function Rewards() {
  const [period, setPeriod] = useState('month');
  const { data, error, loading, updatedAt } = usePolling(() => api.rewards(period), REFRESH_MS, [period]);

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
        <div role="group" aria-label="Period" className="inline-flex rounded-xl border border-[#d6cfbe] bg-white p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#1b2d5a] focus:ring-offset-1 ${
                period === p.value ? 'bg-[#1b2d5a] text-white' : 'text-[#1b2d5a] hover:bg-[#f1ede3]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {error && <Alert>{error}</Alert>}

      {!data ? (
        loading && <p className="text-sm text-slate-500">Loading rewards…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Board
            title="Most Frequent Visitor"
            subtitle="Most sessions in the period"
            entries={data.mostFrequent}
            valueText={(e) => `${formatNumber(e.value)} visits`}
            empty="No sessions in this period yet."
          />
          <Board
            title="Quietest Visitor"
            subtitle="Quietest table during your sessions."
            entries={data.quietest}
            valueText={(e) => `avg ${formatNumber(e.value)}`}
            empty="No sessions of 30 minutes or more in this period yet."
          />
          <Board
            title="Quiet Streak"
            subtitle="Sessions in a row with no alert. Resets after an alert."
            entries={data.quietStreak}
            valueText={(e) => `${formatNumber(e.value)} in a row`}
            empty="No active quiet streaks yet."
            showCount={false}
          />
        </div>
      )}

      {data?.hasSampleData && (
        <p className="text-xs text-amber-800">
          Sample data: these standings use sample sessions and quiet scores until the devices are connected.
        </p>
      )}
    </div>
  );
}
