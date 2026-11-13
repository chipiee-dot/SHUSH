const STYLES = {
  error: 'bg-shush-dangerSoft border-shush-danger/30 text-shush-danger',
  success: 'bg-shush-successSoft border-shush-success/30 text-shush-success',
  info: 'bg-shush-creamDeep border-shush-line text-shush-inkSoft',
};

export default function Alert({ type = 'error', children }) {
  if (!children) return null;
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm ${STYLES[type] ?? STYLES.info}`}
    >
      {children}
    </div>
  );
}
