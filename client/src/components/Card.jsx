export default function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-shush-line bg-shush-white px-5 py-4 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold tracking-tight text-shush-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-shush-inkSoft">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
