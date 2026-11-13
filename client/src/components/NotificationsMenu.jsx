import { useCallback, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import useClickOutside from '../hooks/useClickOutside.js';
import usePolling from '../hooks/usePolling.js';
import { formatTime } from '../lib/format.js';
import SampleBadge from './SampleBadge.jsx';

const READ_KEY = 'shush.readAlertIds';
const MAX_REMEMBERED = 500;

function loadReadIds() {
  try {
    return JSON.parse(window.localStorage.getItem(READ_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function NotificationsMenu() {
  const { data } = usePolling(api.notifications, 15000);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => new Set(loadReadIds().map(String)));
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  const alerts = data?.alerts ?? [];
  const ending = data?.maintenanceEnding ?? [];
  const unreadAlerts = useMemo(() => alerts.filter((a) => !readIds.has(String(a.id))), [alerts, readIds]);
  const count = unreadAlerts.length + ending.length;

  function markAllRead() {
    const merged = [...new Set([...readIds, ...alerts.map((a) => String(a.id))])].slice(-MAX_REMEMBERED);
    window.localStorage.setItem(READ_KEY, JSON.stringify(merged));
    setReadIds(new Set(merged));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count ? `Notifications, ${count} new` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-shush-lineStrong bg-shush-white text-shush-ink shadow-sm transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange"
      >
        <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Z" strokeLinejoin="round" />
          <path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" strokeLinecap="round" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-shush-danger px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-shush-line bg-shush-white text-shush-ink shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-shush-line px-4 py-3">
            <span className="text-sm font-semibold text-shush-ink">Notifications</span>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadAlerts.length === 0}
              className="text-xs font-medium text-shush-orange700 hover:underline disabled:cursor-default disabled:text-shush-muted disabled:no-underline"
            >
              Mark alerts as read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {ending.length === 0 && alerts.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-shush-muted">Nothing new in the last 24 hours.</p>
            )}

            {ending.length > 0 && (
              <div>
                <div className="bg-shush-creamDeep px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-shush-muted">
                  Maintenance ending soon
                </div>
                {ending.map((w) => (
                  <div key={`m-${w.id}`} className="border-b border-shush-line hover:bg-shush-cream px-4 py-3 text-sm">
                    <div className="font-medium text-shush-ink">
                      {w.allTables ? 'All tables' : `Table ${w.tableNo}`} · ends {formatTime(w.endsAt)}
                    </div>
                    <div className="text-xs text-shush-muted">{w.reason}</div>
                  </div>
                ))}
              </div>
            )}

            {alerts.length > 0 && (
              <div>
                <div className="bg-shush-creamDeep px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-shush-muted">
                  Alerts, last 24 hours
                </div>
                {alerts.map((a) => {
                  const unread = !readIds.has(String(a.id));
                  return (
                    <div key={`a-${a.id}`} className="flex gap-3 border-b border-shush-line hover:bg-shush-cream px-4 py-3 text-sm">
                      <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${unread ? 'bg-shush-orange' : 'bg-shush-lineStrong'}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 font-medium text-shush-ink">
                          Table {a.tableNo} noise alert
                          {a.isSample && <SampleBadge />}
                        </div>
                        <div className="text-xs text-shush-muted">
                          Level {a.level.toLocaleString('en-PH')} over threshold {a.threshold.toLocaleString('en-PH')} · {formatTime(a.triggeredAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
