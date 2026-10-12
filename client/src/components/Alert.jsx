const STYLES = {
  error: 'bg-red-50 border-red-200 text-red-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
};

export default function Alert({ type = 'error', children }) {
  if (!children) return null;
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm ${STYLES[type]}`}
    >
      {children}
    </div>
  );
}
