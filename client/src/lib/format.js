// Shared labels, colours and formatting for the faculty console.

export const STATUS_META = {
  QUIET: {
    label: 'Quiet',
    pill: 'bg-shush-successSoft text-shush-success border-shush-success/30',
    dot: 'bg-shush-success',
    edge: 'border-l-shush-success',
  },
  LOUD: {
    label: 'Loud',
    pill: 'bg-shush-goldSoft text-shush-orange700 border-shush-amber/50',
    dot: 'bg-shush-amber',
    edge: 'border-l-shush-amber',
  },
  ALERT: {
    label: 'Alert',
    pill: 'bg-shush-dangerSoft text-shush-danger border-shush-danger/30',
    dot: 'bg-shush-danger',
    edge: 'border-l-shush-danger',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    pill: 'bg-shush-creamDeep text-shush-orange700 border-shush-lineStrong',
    dot: 'bg-shush-orangeSoft',
    edge: 'border-l-shush-orangeSoft',
  },
  OFFLINE: {
    label: 'Offline',
    pill: 'bg-shush-creamDeep text-shush-muted border-shush-line',
    dot: 'bg-shush-muted',
    edge: 'border-l-shush-muted',
  },
  NO_DEVICE: {
    label: 'No device',
    pill: 'bg-shush-creamDeep text-shush-muted border-dashed border-shush-lineStrong',
    dot: 'bg-shush-lineStrong',
    edge: 'border-l-shush-lineStrong',
  },
};

export const HISTORY_KIND_META = {
  alert: { label: 'Alert', pill: 'bg-shush-dangerSoft text-shush-danger border-shush-danger/30' },
  maintenance: { label: 'Maintenance', pill: 'bg-shush-creamDeep text-shush-orange700 border-shush-lineStrong' },
  session: { label: 'Session', pill: 'bg-shush-goldSoft text-shush-ink border-shush-amber/50' },
};

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(value, now = Date.now()) {
  if (!value) return 'never';
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDateTime(value);
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('en-PH');
}

// Date for <input type="date"> in the browser's local time: YYYY-MM-DD
export function dateInputValue(date = new Date()) {
  return date.toLocaleDateString('en-CA');
}

// Protects against spreadsheet formula injection in CSV exports.
export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
