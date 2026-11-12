import { useEffect } from 'react';

const STYLES = {
  info: { bar: 'bg-blue-200', icon: 'bg-blue-500' },
  success: { bar: 'bg-green-200', icon: 'bg-green-500' },
  warning: { bar: 'bg-yellow-200', icon: 'bg-yellow-500' },
  error: { bar: 'bg-red-200', icon: 'bg-red-500' },
};

const ICONS = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01" />
      <path d="M11 12h1v4h1" />
    </>
  ),
  success: <path d="M5 13l4 4L19 7" />,
  warning: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
  error: <path d="M18 6 6 18M6 6l12 12" />,
};

// Pops in at the top right. Dismisses itself after `duration` ms or when X is pressed.
export default function Toast({ type = 'success', children, onClose, duration = 5000 }) {
  useEffect(() => {
    if (!onClose) return undefined;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const style = STYLES[type] ?? STYLES.info;
  return (
    <div role="status" aria-live="polite" className="fixed right-4 top-4 z-50 w-[min(92vw,380px)]">
      <div className={`flex items-center gap-3 rounded-2xl px-3 py-3 shadow-lg ${style.bar}`}>
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl text-white shadow-md ${style.icon}`}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[type] ?? ICONS.info}
          </svg>
        </span>
        <p className="flex-1 text-sm font-medium text-slate-900">{children}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm transition hover:text-slate-700"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
