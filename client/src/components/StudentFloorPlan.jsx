import { useRef } from 'react';
import StudentTableTile from './StudentTableTile.jsx';
import './table-layout.css';
import './student-table.css';

const ROW_HEIGHT = '6.5rem'; // same as the faculty floor plan

/**
 * The floor plan the faculty arranged, for students. Each table sits at its saved grid position and size.
 * Empty rows above the first table are trimmed. Tables are in table-number order in the DOM (so Tab order is
 * sensible) and CSS grid does the positioning. "Open tables only" dims tables that are not open instead of hiding them.
 * The plan scrolls up and down (and sideways on narrow screens) inside its own box, so tall layouts never run off the screen.
 * `tables` need a `grid` ({ col, row, width, height }); the page only shows this view when every table has one.
 */
export default function StudentFloorPlan({ tables, onPick, onlyOpen = false }) {
  const canvasRef = useRef(null);
  const ordered = [...tables].sort((a, b) => a.tableNo - b.tableNo);
  const topRow = ordered.reduce((min, t) => Math.min(min, t.grid.row), Infinity);

  // Dot-grid spotlight: write the pointer position straight to CSS variables (no re-render).
  function onMove(e) {
    if (e.pointerType !== 'mouse') return;
    const el = canvasRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }

  return (
    <div className="st-scroll -mx-4 -my-5 overflow-x-auto px-4 py-5">
      <div
        ref={canvasRef}
        onPointerMove={onMove}
        className="tl-canvas st-plan-canvas grid grid-cols-12 gap-3 p-3"
        style={{ gridAutoRows: ROW_HEIGHT }}
        role="group"
        aria-label="Floor plan"
      >
        {ordered.map((t, i) => (
          <StudentTableTile
            key={t.tableNo}
            table={t}
            index={i}
            variant="plan"
            placement={{ col: t.grid.col, row: t.grid.row - topRow, width: t.grid.width, height: t.grid.height }}
            dimmed={onlyOpen && !t.open}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}
