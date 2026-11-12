export default function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_16px_rgba(16,24,40,0.06)] ${className}`}>
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
