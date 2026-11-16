import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './confirm-dialog.css';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2';

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
  const uid = useId();
  const titleId = `${uid}-title`;
  const bodyId = `${uid}-body`;
  const panelRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const latest = useRef({ busy, onCancel });
  latest.current = { busy, onCancel };
  const lastFocus = useRef(null);

  // Remember what had focus before the pop-up, even if a busy state blurred it first.
  useEffect(() => {
    if (open) return undefined;
    const track = (e) => { lastFocus.current = e.target; };
    document.addEventListener('focusin', track);
    return () => document.removeEventListener('focusin', track);
  }, [open]);

  // Lock page scroll, move focus in, and give it back to the opener on close.
  useEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement;
    const opener = active && active !== document.body ? active : lastFocus.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (tone === 'danger' ? cancelRef : confirmRef).current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, [open, tone]);

  // Esc cancels (unless busy). Tab and Shift+Tab stay inside the panel.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        if (!latest.current.busy) {
          e.preventDefault();
          latest.current.onCancel();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="confirm-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="confirm-panel w-full max-w-md rounded-[1.5rem] border border-shush-line bg-shush-white p-6 shadow-2xl"
      >
        <h2 id={titleId} className="text-xl font-semibold tracking-tight text-shush-ink">
          {title}
        </h2>
        <div id={bodyId} className="mt-3 text-sm text-shush-inkSoft">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`rounded-xl border border-shush-lineStrong px-4 py-2.5 text-sm font-medium text-shush-ink transition hover:bg-shush-creamDeep disabled:opacity-60 ${RING}`}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition disabled:opacity-60 ${RING} ${
              tone === 'danger'
                ? 'bg-shush-danger hover:bg-shush-danger/90'
                : 'bg-shush-orange hover:bg-shush-orange600'
            }`}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
