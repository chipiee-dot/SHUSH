export default function Stat({ label, value, hint, tone }) {
  const valueClass = tone === 'danger' ? 'text-red-700' : 'text-[#152549]';
  return (
    <div className="rounded-2xl bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_16px_rgba(16,24,40,0.06)]">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tracking-tight ${valueClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
