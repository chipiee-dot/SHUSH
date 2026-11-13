import { useEffect } from 'react';

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy = false,
  tone = 'default',
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-shush-ink/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-[1.5rem] border border-shush-line bg-shush-white p-6 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-xl font-semibold tracking-tight text-shush-ink">
          {title}
        </h2>
        <div className="mt-3 text-sm text-shush-inkSoft">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-shush-lineStrong px-4 py-2.5 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-md transition disabled:opacity-60 ${
              tone === 'danger'
                ? 'bg-shush-danger hover:bg-shush-danger/90'
                : 'bg-shush-orange hover:bg-shush-orange600'
            }`}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
