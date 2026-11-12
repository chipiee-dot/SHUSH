export default function SampleBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-dashed border-amber-500 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 ${className}`}
      title="This data is sample data until the devices are connected."
    >
      Sample data
    </span>
  );
}
