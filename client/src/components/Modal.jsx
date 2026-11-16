import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './confirm-dialog.css';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Generic information modal. Shares the scrim / panel animation with ConfirmDialog.
 * Props: open, title, subtitle, icon (node), onClose, children, footer, size (Tailwind max-w-*).
 */
export default function Modal({ open, title, subtitle, icon, onClose, children, footer, size = 'max-w-lg' }) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const latest = useRef({ onClose });
  latest.current = { onClose };
  const lastFocus = useRef(null);

  // Remember the opener even if focus was elsewhere when the modal opened.
  useEffect(() => {
    if (open) return undefined;
    const track = (e) => {
      lastFocus.current = e.target;
    };
    document.addEventListener('focusin', track);
    return () => document.removeEventListener('focusin', track);
  }, [open]);

  // Lock page scroll, move focus into the panel, and restore it on close.
  useEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement;
    const opener = active && active !== document.body ? active : lastFocus.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, [open]);

  // Esc closes; Tab and Shift+Tab stay inside the panel.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        latest.current.onClose();
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`confirm-panel flex max-h-[85vh] w-full ${size} flex-col overflow-hidden rounded-[1.5rem] border border-shush-line bg-shush-white shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-shush-line px-6 py-5">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span
                className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-shush-goldSoft text-shush-orange700 [&>svg]:h-5 [&>svg]:w-5"
                aria-hidden="true"
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl font-semibold tracking-tight text-shush-ink">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-xs text-shush-inkSoft">{subtitle}</p>}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-shush-lineStrong text-shush-inkSoft transition hover:bg-shush-creamDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-shush-orange focus-visible:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm text-shush-inkSoft">{children}</div>
        {footer && <div className="border-t border-shush-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
