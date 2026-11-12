import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Toast from '../components/Toast.jsx';

const ToastContext = createContext(null);
const LIFETIME_MS = 5000;
let nextId = 1;

// Shows messages as toasts at the top right. Usage: const { notify } = useToast(); notify('error', 'Text');
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (type, text) => {
      const id = nextId++;
      setItems((list) => [...list, { id, type, text }].slice(-4));
      setTimeout(() => dismiss(id), LIFETIME_MS);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-3">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast type={t.type} duration={LIFETIME_MS} onClose={() => dismiss(t.id)}>
              {t.text}
            </Toast>
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
