import { useEffect, useState } from 'react';
import CountUp from './CountUp.jsx';
import { formatNumber } from '../lib/format.js';

const safe = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
// Accepts 'var(--x)' or a bare custom property name like '--shush-orange'.
const cssColor = (c) => (typeof c === 'string' && c.startsWith('--') ? `var(${c})` : c);

/**
 * Donut. segments: [{ key, label, value, color }] where color is a CSS value such as 'var(--shush-success)'.
 * Strokes draw in once on first mount. total === 0 draws an empty ring.
 */
export function DonutChart({ segments = [], size = 160, thickness = 18, centerValue, centerLabel }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const clean = segments.map((s) => ({ ...s, value: Math.max(0, safe(s.value)) }));
  const total = clean.reduce((sum, s) => sum + s.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = total === 0
    ? []
    : clean
        .filter((s) => s.value > 0)
        .map((s) => {
          const len = (s.value / total) * circumference;
          const arc = { ...s, len, offset };
          offset += len;
          return arc;
        });

  const summary = total === 0
    ? 'No data'
    : clean.map((s) => `${s.label} ${formatNumber(s.value)}`).join(', ');
  const ariaLabel = `${centerLabel ? `${centerLabel}: ` : ''}${summary}`;

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={thickness}
            style={{ stroke: 'var(--shush-cream-deep)' }}
          />
          {arcs.map((a) => (
            <circle
              key={a.key ?? a.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={thickness}
              strokeLinecap="butt"
              strokeDasharray={`${drawn ? a.len : 0} ${circumference}`}
              strokeDashoffset={-a.offset}
              style={{ stroke: cssColor(a.color), transition: 'stroke-dasharray 700ms ease-out' }}
            />
          ))}
        </g>
      </svg>
      {(centerValue !== undefined || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden="true">
          {centerValue !== undefined && (
            <div className="text-2xl font-semibold leading-none tracking-tight text-shush-ink">
              {typeof centerValue === 'number' ? <CountUp value={centerValue} /> : centerValue}
            </div>
          )}
          {centerLabel && <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-shush-muted">{centerLabel}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Vertical bars. data: [{ label, value }]. Bars rise with a short stagger on first mount.
 * Hover or keyboard focus on a bar shows its value. Only some labels are printed under the baseline.
 */
export function BarChart({ data = [], height = 140, highlightMax = true }) {
  const values = data.map((d) => Math.max(0, safe(d.value)));
  const max = Math.max(0, ...values);
  const maxIndex = max > 0 ? values.indexOf(max) : -1;
  const step = Math.max(1, Math.ceil(data.length / 6));

  const summary = data.length === 0
    ? 'Bar chart with no data.'
    : `Bar chart of ${data.length} values.${maxIndex >= 0 ? ` Highest: ${data[maxIndex].label}, ${formatNumber(max)}.` : ' All values are zero.'}`;

  return (
    <div role="img" aria-label={summary}>
      <div className="flex items-end gap-1 border-b border-shush-lineStrong" style={{ height }}>
        {data.map((d, i) => {
          const pct = max > 0 ? (values[i] / max) * 100 : 0;
          const hot = highlightMax && i === maxIndex;
          return (
            <div
              key={`${d.label}-${i}`}
              className="group relative flex h-full flex-1 items-end focus:outline-none"
              tabIndex={0}
              aria-label={`${d.label}: ${formatNumber(values[i])}`}
            >
              <span className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-shush-ink px-1.5 py-0.5 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                {formatNumber(values[i])}
              </span>
              <div
                className="shush-grow w-full origin-bottom rounded-t-md group-focus-visible:ring-2 group-focus-visible:ring-shush-orange"
                style={{
                  height: `${Math.max(pct, values[i] > 0 ? 3 : 0)}%`,
                  background: hot ? 'var(--shush-orange)' : 'var(--shush-gold)',
                  animationDelay: `${Math.min(i * 25, 600)}ms`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1" aria-hidden="true">
        {data.map((d, i) => (
          <div key={`${d.label}-l${i}`} className="relative h-4 flex-1">
            {i % step === 0 && (
              <span className="absolute left-0 whitespace-nowrap text-[10px] font-medium text-shush-muted">{d.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Horizontal meter with an optional threshold marker.
 * value, max and markerAt share one scale. colorVar is a custom property name ('--shush-orange') or a var() string.
 */
export function MeterBar({ value, max = 100, markerAt, colorVar = '--shush-orange', label, className = '' }) {
  const top = safe(max) > 0 ? safe(max) : 1;
  const now = Math.min(top, Math.max(0, safe(value)));
  const fill = now / top;
  const marker = markerAt === undefined ? null : Math.min(1, Math.max(0, safe(markerAt) / top));

  return (
    <div className={`relative py-1 ${className}`}>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-shush-creamDeep"
        role="meter"
        aria-label={label ?? 'Level'}
        aria-valuemin={0}
        aria-valuemax={top}
        aria-valuenow={now}
      >
        <div
          className="h-full origin-left rounded-full transition-transform duration-700 ease-out"
          style={{ transform: `scaleX(${fill})`, background: cssColor(colorVar) }}
        />
      </div>
      {marker !== null && (
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -top-0.5 w-0.5 rounded-full bg-shush-ink"
          style={{ left: `calc(${marker * 100}% - 1px)` }}
        />
      )}
    </div>
  );
}
