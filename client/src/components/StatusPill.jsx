import { STATUS_META } from '../lib/format.js';

export default function StatusPill({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.OFFLINE;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
