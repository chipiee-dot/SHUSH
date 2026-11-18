import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import './toast.css';

// Every toast slides in on the right and goes away by itself after this long.
export const TOAST_MS = 5000;
const LEAVE_MS = 220; // matches the slide-out in toast.css
const MAX_TOASTS = 4; // the oldest one is dropped if more arrive

const ToastContext = createContext(null);

const ICONS = {
  success: <path d="M5 13l4 4L19 7" />,
  error: <path d="M12 8v5m0 3.5h.01" />,
  info: <path d="M12 11v5m0-8.5h.01" />,
};

/**
 * Wrap the app once (main.jsx). Anywhere inside, call:
 *   const toast = useToast();
 *   toast.success('Saved.');  toast.error('Could not save.');  toast.info('...');
 * The same message shown twice in a row is merged into one toast (its timer restarts).
 */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]); // source of truth, so quick back-to-back calls never miss each other
  const timers = useRef(new Map());
  const nextId = useRef(1);

  const commit = (next) => {
    itemsRef.current = next;
    setItems(next);
  };

  const clearTimer = (id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  };

  const remove = useCallback((id) => {
    clearTimer(id);
    commit(itemsRef.current.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback(
    (id) => {
      clearTimer(id);
      if (!itemsRef.current.some((t) => t.id === id)) return;
      commit(itemsRef.current.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      timers.current.set(id, setTimeout(() => remove(id), LEAVE_MS));
    },
    [remove]
  );

  const show = useCallback(
    (type, text) => {
      const message = String(text ?? '').trim();
      if (!message) return;

      const same = itemsRef.current.find((t) => t.type === type && t.text === message && !t.leaving);
      let id;
      if (same) {
        id = same.id;
        clearTimer(id);
        commit(itemsRef.current.map((t) => (t.id === id ? { ...t, stamp: t.stamp + 1 } : t))); // restarts the countdown bar
      } else {
        id = nextId.current++;
        let next = [...itemsRef.current, { id, type, text: message, stamp: 0, leaving: false }];
        while (next.length > MAX_TOASTS) {
          clearTimer(next[0].id);
          next = next.slice(1);
        }
        commit(next);
      }
      timers.current.set(id, setTimeout(() => dismiss(id), TOAST_MS));
    },
    [dismiss]
  );

  useEffect(() => {
    const active = timers.current;
    return () => active.forEach((timer) => clearTimeout(timer));
  }, []);

  const api = useMemo(
    () => ({
      success: (text) => show('success', text),
      error: (text) => show('error', text),
      info: (text) => show('info', text),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="shush-toasts" aria-live="polite">
        {items.map((t) => (
          <div
            key={`${t.id}-${t.stamp}`}
            className={`shush-toast shush-toast--${t.type}${t.leaving ? ' is-leaving' : ''}`}
            role={t.type === 'error' ? 'alert' : 'status'}
          >
            <span className="shush-toast__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[t.type] ?? ICONS.info}
              </svg>
            </span>
            <p className="shush-toast__text">{t.text}</p>
            <button type="button" className="shush-toast__close" aria-label="Dismiss message" onClick={() => dismiss(t.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <span className="shush-toast__bar" aria-hidden="true" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>.');
  return ctx;
}

/** Shows an error toast whenever `message` changes to something non-empty. For errors that come from usePolling. */
export function useErrorToast(message) {
  const toast = useToast();
  useEffect(() => {
    if (message) toast.error(message);
  }, [message, toast]);
}
