import ConfirmDialog from './ConfirmDialog.jsx';
import './table-layout.css';
import './student-table.css';
import './motion.css';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function Fact({ children }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-[0.45rem] h-1.5 w-1.5 flex-none rounded-full bg-shush-orange" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

/** The table seen from above. Taken chairs are filled; the next free chair is the student's, with a slow pulse. */
function SeatDiagram({ seats, free }) {
  const total = Math.max(0, Math.floor(seats || 0));
  const taken = clamp(total - (free || 0), 0, total);
  const hasSeat = free >= 1;
  const topCount = Math.ceil(total / 2);

  const row = (from, count) => (
    <div className="tl-chairs" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const idx = from + i;
        const cls =
          hasSeat && idx === taken
            ? 'tl-chair tl-chair--on ct-mine'
            : `tl-chair ${idx < taken ? 'tl-chair--on' : ''}`;
        return <span key={idx} className={cls} />;
      })}
    </div>
  );

  return (
    <div className="ct-diagram" aria-hidden="true">
      {row(0, topCount)}
      <div className="tl-top ct-top m-studs" />
      {row(topCount, Math.max(0, total - topCount))}
    </div>
  );
}

/**
 * "Confirm your table" pop-up. Built on ConfirmDialog, so it keeps the full-window layer,
 * focus trap, Esc handling and focus return. maxSessionHours comes from the server.
 */
export default function ConfirmTableDialog({ open, table, student, maxSessionHours, busy, onConfirm, onCancel }) {
  const free = table?.free ?? 0;
  const seats = table?.seats ?? 0;

  return (
    <ConfirmDialog
      open={open}
      title="Confirm your table"
      confirmLabel="Confirm and sit down"
      cancelLabel="Choose another table"
      busyLabel="Seating you…"
      onConfirm={onConfirm}
      onCancel={onCancel}
      busy={busy}
    >
      {table && (
        <div className="space-y-5">
          <div className="flex items-center gap-5">
            <SeatDiagram seats={seats} free={free} />
            <div>
              <div className="st-label">Your table</div>
              <div className="ct-no">Table {table.tableNo}</div>
            </div>
          </div>

          <ul className="space-y-2 text-sm text-shush-inkSoft">
            <Fact>
              {free >= 1
                ? `${free} of ${seats} seats free. ${free - 1} left after you sit.`
                : 'This table has no free seats right now.'}
            </Fact>
            {student && (
              <Fact>
                <span className="font-semibold text-shush-ink">{student.name}</span> · {student.section}
              </Fact>
            )}
            {maxSessionHours ? (
              <Fact>
                Your session ends automatically after {maxSessionHours} {maxSessionHours === 1 ? 'hour' : 'hours'}.
              </Fact>
            ) : null}
            <Fact>This table listens for noise and signals when it gets loud. Keep it quiet.</Fact>
          </ul>
        </div>
      )}
    </ConfirmDialog>
  );
}
