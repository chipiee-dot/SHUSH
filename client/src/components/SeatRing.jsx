import { useEffect, useState } from 'react';
import CountUp from './CountUp.jsx';
import './student-table.css';
import './motion.css';

/* Adapted from BrewedOps Motion Library: Ring progress, Count up */

const R = 44;
const CIRCUMFERENCE = 2 * Math.PI * R;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The seats-free ring for the student hero card.
 * free / total are seat counts across tables that are not under maintenance; both are null while the list loads.
 * openTables / totalTables are counted the same way. The arc sweeps in once, then eases to each new value.
 */
export default function SeatRing({ free = null, total = null, openTables = null, totalTables = null }) {
  const loaded = Number.isFinite(free) && Number.isFinite(total);
  const target = loaded && total > 0 ? Math.min(1, Math.max(0, free / total)) : 0;

  // Start empty so the first value sweeps in; under reduced motion show the value straight away.
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const label = loaded ? `${free} of ${total} seats free` : 'Loading the seat count';

  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative h-28 w-28 sm:h-32 sm:w-32" role="img" aria-label={label}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true" focusable="false">
          <circle cx="50" cy="50" r={R} className="st-ring-track" />
          <circle
            cx="50"
            cy="50"
            r={R}
            className="st-ring-arc"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - shown)}
            style={{ opacity: shown > 0 ? 1 : 0 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <CountUp value={loaded ? free : null} className="text-3xl font-extrabold leading-none text-shush-ink sm:text-4xl" />
          <span className="mt-1 text-xs font-semibold text-shush-inkSoft">seats free</span>
        </div>
      </div>
      {openTables !== null && totalTables !== null && (
        <p className="mt-2 text-center text-xs font-medium text-shush-inkSoft">
          {openTables} of {totalTables} {totalTables === 1 ? 'table' : 'tables'} open
        </p>
      )}
    </div>
  );
}
