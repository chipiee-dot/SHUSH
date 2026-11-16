/**
 * Faculty card. Props: title, subtitle, action, children, className (unchanged),
 * plus icon (node shown in an orange-tint chip), tone ('default' | 'accent'), interactive (lifts on hover).
 */
export default function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  icon,
  tone = 'default',
  interactive = false,
}) {
  const surface = tone === 'accent' ? 'border-shush-lineStrong bg-shush-cream' : 'border-shush-line bg-shush-white';
  const lift = interactive
    ? 'transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-18px_rgba(242,95,19,0.5)]'
    : '';
  return (
    <section
      className={`rounded-2xl border px-5 py-4 shadow-[0_10px_30px_-18px_rgba(242,95,19,0.35)] ${surface} ${lift} ${className}`}
    >
      {(title || action || icon) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span
                className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-shush-goldSoft text-shush-orange700 [&>svg]:h-5 [&>svg]:w-5"
                aria-hidden="true"
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold tracking-tight text-shush-ink">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-xs text-shush-inkSoft">{subtitle}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
