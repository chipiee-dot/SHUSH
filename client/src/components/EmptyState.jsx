/** Centered empty state with an outline cloud. Use instead of bare "No data" text. */
export default function EmptyState({ title, text, action }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-shush-goldSoft text-shush-orange700">
        <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {title && <h3 className="mt-3 text-sm font-semibold text-shush-ink">{title}</h3>}
      {text && <p className="mt-1 max-w-xs text-sm text-shush-inkSoft">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
