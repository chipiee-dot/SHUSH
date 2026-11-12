import { useEffect, useRef } from 'react';

export default function GlowButton({ children, className = '', type = 'button', disabled = false, onClick, ...props }) {
  const btnRef = useRef(null);
  const glowRef = useRef(null);
  const posRef = useRef({ cx: 0, cy: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const btn = btnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    posRef.current = {
      cx: rect.width / 2,
      cy: rect.height / 2,
      tx: rect.width / 2,
      ty: rect.height / 2,
    };

    function handlePointerMove(e) {
      const r = btn.getBoundingClientRect();
      posRef.current.tx = e.clientX - r.left;
      posRef.current.ty = e.clientY - r.top;
    }

    function handleFocus() {
      const r = btn.getBoundingClientRect();
      posRef.current.tx = r.width / 2;
      posRef.current.ty = r.height / 2;
    }

    btn.addEventListener('pointermove', handlePointerMove);
    btn.addEventListener('focus', handleFocus);

    let rafId;
    function animate() {
      const pos = posRef.current;
      pos.cx += (pos.tx - pos.cx) * 0.16;
      pos.cy += (pos.ty - pos.cy) * 0.16;
      
      btn.style.setProperty('--glow-x', `${pos.cx.toFixed(1)}px`);
      btn.style.setProperty('--glow-y', `${pos.cy.toFixed(1)}px`);
      
      rafId = requestAnimationFrame(animate);
    }
    
    rafId = requestAnimationFrame(animate);

    return () => {
      btn.removeEventListener('pointermove', handlePointerMove);
      btn.removeEventListener('focus', handleFocus);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <button
      ref={btnRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`glow-btn ${className}`}
      {...props}
    >
      <span ref={glowRef} className="glow-light" />
      <span className="glow-text">{children}</span>
    </button>
  );
}
