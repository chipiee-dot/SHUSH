export default function Stat({ label, value, hint, tone }) {
  const valueClass = tone === 'danger' ? 'text-shush-danger' : 'text-shush-ink';
  return (
    <div className="rounded-xl border border-shush-line px-5 py-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-shush-muted">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tracking-tight ${valueClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-shush-muted">{hint}</div>}
    </div>
  );
}
