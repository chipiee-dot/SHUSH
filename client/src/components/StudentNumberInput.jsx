import { useRef } from 'react';

// Six separate boxes with a dash between the 2nd and 3rd, e.g. 2 1 - 0 0 0 1.
export default function StudentNumberInput({ id, value = '', onChange, autoFocus = false }) {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  const chars = Array.from({ length: 6 }, (_, i) => digits[i] ?? '');
  const refs = useRef([]);

  function commit(next) {
    onChange(next.join('').slice(0, 6));
  }

  function handleChange(i, e) {
    const typed = e.target.value.replace(/\D/g, '');
    const next = [...chars];
    next[i] = typed ? typed[typed.length - 1] : '';
    commit(next);
    if (typed && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !chars[i] && i > 0) {
      e.preventDefault();
      const next = [...chars];
      next[i - 1] = '';
      commit(next);
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus();
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    refs.current[Math.min(text.length, 5)]?.focus();
  }

  const box = (i) => (
    <input
      key={i}
      ref={(el) => {
        refs.current[i] = el;
      }}
      id={i === 0 ? id : undefined}
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus && i === 0}
      maxLength={1}
      aria-label={`Student number digit ${i + 1}`}
      value={chars[i]}
      onChange={(e) => handleChange(i, e)}
      onKeyDown={(e) => handleKeyDown(i, e)}
      onFocus={(e) => e.target.select()}
      onPaste={handlePaste}
      className="h-14 w-11 rounded-xl border border-[#d6cfbe] bg-transparent text-center text-xl font-semibold text-[#152549] focus:border-[#1b2d5a] focus:outline-none focus:ring-2 focus:ring-[#1b2d5a]/30"
    />
  );

  return (
    <div role="group" aria-label="Student number" className="flex items-center justify-center gap-2">
      {[0, 1].map(box)}
      <span aria-hidden="true" className="px-1 text-2xl font-semibold text-slate-500">-</span>
      {[2, 3, 4, 5].map(box)}
    </div>
  );
}
