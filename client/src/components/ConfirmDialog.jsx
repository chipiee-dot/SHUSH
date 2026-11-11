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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1b3a]/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-[1.5rem] bg-[#f7f5ed] p-6 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-xl font-semibold tracking-tight text-[#152549]">
          {title}
        </h2>
        <div className="mt-3 text-sm text-slate-700">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-[#d6cfbe] px-4 py-2.5 text-sm font-medium text-[#1b2d5a] transition hover:bg-[#1b2d5a] hover:text-white disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-[#1b2d5a] px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-[#16254a] disabled:opacity-60"
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
