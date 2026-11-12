export default function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-[#d6cfbe] px-5 py-4 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold tracking-tight text-[#152549]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
