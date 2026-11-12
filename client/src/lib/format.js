// Shared labels, colours and formatting for the faculty console.

export const STATUS_META = {
  QUIET: {
    label: 'Quiet',
    pill: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    dot: 'bg-emerald-500',
    edge: 'border-l-emerald-500',
  },
  LOUD: {
    label: 'Loud',
    pill: 'bg-amber-50 text-amber-900 border-amber-200',
    dot: 'bg-amber-500',
    edge: 'border-l-amber-500',
  },
  ALERT: {
    label: 'Alert',
    pill: 'bg-red-50 text-red-900 border-red-200',
    dot: 'bg-red-500',
    edge: 'border-l-red-500',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    pill: 'bg-sky-50 text-sky-900 border-sky-200',
    dot: 'bg-sky-500',
    edge: 'border-l-sky-500',
  },
  OFFLINE: {
    label: 'Offline',
    pill: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
    edge: 'border-l-slate-400',
  },
  NO_DEVICE: {
    label: 'No device',
    pill: 'bg-white text-slate-700 border-dashed border-slate-400',
    dot: 'bg-slate-300',
    edge: 'border-l-slate-300',
  },
};

export const HISTORY_KIND_META = {
  alert: { label: 'Alert', pill: 'bg-red-50 text-red-900 border-red-200' },
  maintenance: { label: 'Maintenance', pill: 'bg-sky-50 text-sky-900 border-sky-200' },
  session: { label: 'Session', pill: 'bg-[#e9ecf5] text-[#1b2d5a] border-[#c9d1e6]' },
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
