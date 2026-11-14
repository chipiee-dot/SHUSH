import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../lib/format.js';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Shows a number that counts from its previous value to the new one (about 700 ms).
 * Under reduced motion the final value appears immediately. Formats with formatNumber.
 */
export default function CountUp({ value, duration = 700, className = '' }) {
  const target = typeof value === 'number' ? value : Number(value);
  const valid = value !== null && value !== undefined && value !== '' && Number.isFinite(target);

  const [display, setDisplay] = useState(() => (valid && !prefersReducedMotion() ? 0 : target));
  const from = useRef(display);

  useEffect(() => {
    if (!valid) return undefined;
    if (prefersReducedMotion() || from.current === target) {
      from.current = target;
      setDisplay(target);
      return undefined;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - p) ** 3;
      const next = p < 1 ? start + (target - start) * eased : target;
      from.current = next;
      setDisplay(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, valid, duration]);

  if (!valid) return <span className={className}>{formatNumber(value)}</span>;
  const shown = Number.isInteger(target) ? Math.round(display) : display;
  return <span className={`tabular-nums ${className}`}>{formatNumber(shown)}</span>;
}
