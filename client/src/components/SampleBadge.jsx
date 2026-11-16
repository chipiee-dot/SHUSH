export default function SampleBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-dashed border-shush-amber bg-shush-goldSoft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-shush-ink ${className}`}
      title="This data is sample data until the devices are connected."
    >
      Sample data
    </span>
  );
}
