import SampleBadge from './SampleBadge.jsx';

/** icon: optional node (the page's sidebar icon from navIcons.jsx), shown in an orange-tint chip before the title. */
export default function PageHeader({ title, subtitle, sample, icon, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          {icon && (
            <span
              className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-shush-goldSoft text-shush-orange700 [&>svg]:h-6 [&>svg]:w-6"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-shush-ink">{title}</h1>
          {sample && <SampleBadge />}
        </div>
        {subtitle && <p className="mt-1 text-sm text-shush-inkSoft">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
