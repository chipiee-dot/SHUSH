export default function Stat({ label, value, hint, tone }) {
  const valueClass = tone === 'danger' ? 'text-red-700' : 'text-[#152549]';
  return (
    <div className="rounded-xl border border-[#d6cfbe] px-5 py-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tracking-tight ${valueClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
