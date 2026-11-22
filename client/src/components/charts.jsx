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

/**
 * Dual-tone working-hours bar chart contrasting peak (noisiest) and quietest hours,
 * with a dashed overall-average line and alert indicators under the x-axis.
 */
export function WorkingHoursChart({ hours = [], peakHour, quietestHour, avgLevel = 0, height = 180 }) {
  const levels = hours.map((h) => Math.max(0, safe(h.avgLevel)));
  const alerts = hours.map((h) => Math.max(0, safe(h.alertCount)));
  const maxLevel = Math.max(0, safe(avgLevel), ...levels);
  const maxAlerts = Math.max(0, ...alerts);
  const usingAlertsScale = maxLevel === 0 && maxAlerts > 0;
  const peakNum = peakHour?.hour ?? null;
  const quietNum = quietestHour?.hour ?? null;
  const avgPct = !usingAlertsScale && maxLevel > 0 && safe(avgLevel) > 0
    ? Math.min(100, (safe(avgLevel) / maxLevel) * 100)
    : null;

  const summary = hours.length === 0
    ? 'Working-hours noise chart with no data.'
    : [
        `Working-hours noise across ${hours.length} hourly slots.`,
        peakHour ? `Noisiest hour: ${peakHour.slotLabel}, average level ${formatNumber(peakHour.avgLevel)}, ${peakHour.alertCount} alert(s).` : '',
        quietestHour ? `Quietest hour: ${quietestHour.slotLabel}, average level ${formatNumber(quietestHour.avgLevel)}, ${quietestHour.alertCount} alert(s).` : '',
      ].filter(Boolean).join(' ');

  return (
    <div role="img" aria-label={summary}>
      <div className="relative pt-7">
        <div className="relative flex items-end gap-1.5 sm:gap-2 border-b border-shush-lineStrong" style={{ height }}>
          {avgPct !== null && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-shush-ink/35"
              style={{ bottom: `${avgPct}%` }}
            >
              <span className="absolute -top-2.5 right-0 rounded bg-shush-white/95 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-shush-inkSoft shadow-sm ring-1 ring-shush-line">
                Avg {formatNumber(avgLevel)}
              </span>
            </div>
          )}

          {hours.map((h, i) => {
            const val = safe(h.avgLevel);
            const alertCount = safe(h.alertCount);
            const sessionCount = safe(h.sessionCount);
            const readingCount = safe(h.readingCount);
            const isPeak = peakNum !== null && h.hour === peakNum;
            const isQuietest = quietNum !== null && h.hour === quietNum;
            const isActive = val > 0 || alertCount > 0 || sessionCount > 0 || readingCount > 0;

            let heightStyle = '4px';
            if (usingAlertsScale) {
              heightStyle = alertCount > 0 ? `${Math.max((alertCount / maxAlerts) * 100, 12)}%` : '4px';
            } else if (val > 0 && maxLevel > 0) {
              heightStyle = `${Math.max((val / maxLevel) * 100, 8)}%`;
            } else if (alertCount > 0) {
              heightStyle = '12%';
            }

            let barColor = 'var(--shush-cream-deep)';
            if (isPeak) {
              barColor = 'var(--shush-danger)';
            } else if (isQuietest) {
              barColor = 'var(--shush-success)';
            } else if (val > 0) {
              barColor = safe(avgLevel) > 0 && val >= safe(avgLevel) ? 'var(--shush-orange)' : 'var(--shush-amber)';
            } else if (alertCount > 0) {
              barColor = 'var(--shush-orange-soft)';
            }

            const tooltipAlign =
              i === 0
                ? 'left-0 translate-x-0'
                : i === hours.length - 1
                  ? 'right-0 left-auto translate-x-0'
                  : 'left-1/2 -translate-x-1/2';

            const hasReadingsOrSessions = sessionCount > 0 || readingCount > 0;
            const ariaDetails = `${h.slotLabel}: ${
              hasReadingsOrSessions ? `average noise level ${formatNumber(val)}` : 'no noise readings'
            }, ${alertCount} alert(s), ${sessionCount} session(s)${
              readingCount > 0 ? `, ${readingCount} reading(s)` : ''
            }`;

            return (
              <div
                key={h.hour}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
                tabIndex={0}
                aria-label={ariaDetails}
              >
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute -top-14 z-20 whitespace-nowrap rounded-lg bg-shush-ink px-2.5 py-1.5 text-left text-[11px] leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 ${tooltipAlign}`}
                >
                  <div className="font-semibold text-shush-goldSoft">{h.slotLabel}</div>
                  <div className="tabular-nums">
                    Avg level: <span className="font-semibold">{hasReadingsOrSessions ? formatNumber(val) : 'No readings'}</span>
                  </div>
                  <div className="text-[10px] text-shush-creamDeep/90 tabular-nums">
                    {formatNumber(alertCount)} alert{alertCount === 1 ? '' : 's'} · {formatNumber(sessionCount)} session{sessionCount === 1 ? '' : 's'}
                    {readingCount > 0 ? ` · ${formatNumber(readingCount)} reading${readingCount === 1 ? '' : 's'}` : ''}
                  </div>
                </div>

                <div className="relative flex h-full w-full items-end justify-center">
                  <div
                    className={`shush-grow relative w-full max-w-[2.5rem] origin-bottom rounded-t-lg transition-opacity group-hover:opacity-90 group-focus-visible:ring-2 group-focus-visible:ring-shush-orange ${
                      isActive ? '' : 'opacity-70'
                    }`}
                    style={{
                      height: heightStyle,
                      background: barColor,
                      animationDelay: `${Math.min(i * 30, 400)}ms`,
                    }}
                  >
                    {(isPeak || isQuietest) && (
                      <span
                        className={`pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm ${
                          isPeak
                            ? 'bg-shush-dangerSoft text-shush-danger ring-1 ring-shush-danger/30'
                            : 'bg-shush-successSoft text-shush-success ring-1 ring-shush-success/30'
                        }`}
                      >
                        {isPeak ? 'Peak' : 'Quietest'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-1.5 sm:gap-2" aria-hidden="true">
        {hours.map((h) => {
          const isPeak = peakNum !== null && h.hour === peakNum;
          const isQuietest = quietNum !== null && h.hour === quietNum;
          return (
            <div key={`lbl-${h.hour}`} className="flex min-w-0 flex-1 flex-col items-center">
              <span
                className={`whitespace-nowrap text-[11px] leading-none tabular-nums ${
                  isPeak
                    ? 'font-bold text-shush-danger'
                    : isQuietest
                      ? 'font-bold text-shush-success'
                      : 'font-medium text-shush-muted'
                }`}
              >
                {h.label}
              </span>
              <span className="mt-1 flex h-2 items-center justify-center">
                {safe(h.alertCount) > 0 && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-shush-danger"
                    title={`${h.alertCount} alert(s)`}
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
