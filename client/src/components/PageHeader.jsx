import SampleBadge from './SampleBadge.jsx';

export default function PageHeader({ title, subtitle, sample, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-[#152549]">{title}</h1>
          {sample && <SampleBadge />}
        </div>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
