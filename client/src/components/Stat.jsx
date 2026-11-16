import CountUp from './CountUp.jsx';

const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * KPI tile. Props: label, value, hint, tone ('danger' for alerts) (unchanged),
 * plus icon (node, shown in an orange-tint chip) and progress (0 to 1, slim bar).
 * A numeric value counts up. A danger tile with a non-zero value shows a slow pulsing dot.
 */
export default function Stat({ label, value, hint, tone, icon, progress }) {
  const danger = tone === 'danger';
  const nonZero = typeof value === 'number' ? value !== 0 : Boolean(value) && value !== '0';
  const pct = progress === undefined ? null : clamp01(progress);

  return (
    <div className="rounded-2xl border border-shush-line bg-shush-white px-5 py-4 shadow-[0_10px_30px_-18px_rgba(242,95,19,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-shush-muted">
          {label}
          {danger && nonZero && (
            <span className="relative inline-flex h-2 w-2" aria-hidden="true">
              <span className="shush-pulse-ring absolute inset-0 rounded-full bg-shush-danger" />
              <span className="relative h-2 w-2 rounded-full bg-shush-danger" />
            </span>
          )}
        </div>
        {icon && (
          <span
            className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-shush-goldSoft text-shush-orange700 [&>svg]:h-5 [&>svg]:w-5"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>

      <div className={`mt-1 text-3xl font-semibold tracking-tight ${danger ? 'text-shush-danger' : 'text-shush-ink'}`}>
        {typeof value === 'number' ? <CountUp value={value} /> : value}
      </div>

      {pct !== null && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-shush-creamDeep"
          role="progressbar"
          aria-label={`${label} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct * 100)}
        >
          <div
            className={`h-full origin-left rounded-full transition-transform duration-700 ease-out ${danger ? 'bg-shush-danger' : 'bg-shush-orange'}`}
            style={{ transform: `scaleX(${pct})` }}
          />
        </div>
      )}

      {hint && <div className="mt-1 text-xs text-shush-muted">{hint}</div>}
    </div>
  );
}
