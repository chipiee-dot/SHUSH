import { useEffect, useState } from 'react';
import CloudBackground from './CloudBackground.jsx';
import Logo from './Logo.jsx';
import './auth-layout.css';

const SLIDE_MS = 6000;

// [height 0-1, tone] for the 17 equalizer bars.
const EQ_BARS = [
  [0.22, 'w'], [0.34, 'w'], [0.48, 'w'], [0.62, 'g'], [0.5, 'w'], [0.78, 'w'],
  [0.95, 'g'], [0.68, 'w'], [1, 'a'], [0.72, 'w'], [0.84, 'g'], [0.56, 'w'],
  [0.4, 'w'], [0.5, 'w'], [0.3, 'w'], [0.24, 'w'], [0.16, 'w'],
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Full-bleed split screen: orange hero on the left, frosted form card on the right.
 * Below 1024px the hero collapses to a compact band above the form.
 * Props: hero (node, usually <AuthHero />), children (form column), formWidth ('md' | 'lg'), labelledBy (id of the form heading),
 * photo (optional image URL: shown behind the form column, with the hero's edge curved over it).
 */
export default function AuthLayout({ hero, children, formWidth = 'md', labelledBy, photo }) {
  return (
    <div className={`auth-page shush-cloud${photo ? ' auth-page--photo' : ''}`}>
      <CloudBackground variant="page" />

      {photo && (
        <div className="auth-photo" aria-hidden="true">
          <img className="auth-photo-img" src={photo} alt="" />
          <div className="auth-photo-tint" />
        </div>
      )}

      <aside className="auth-hero-panel" aria-label="About SHUSH">
        <CloudBackground variant="hero" />
        {hero}
      </aside>

      <main className="auth-main" aria-labelledby={labelledBy}>
        <div className="auth-card-frost" data-width={formWidth}>
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Hero content: brand, title, subtitle, a slide carousel and equalizer bars.
 * Props: title, subtitle, slides [{ title, text }], showBars (default true).
 */
export function AuthHero({ title, subtitle, slides = [], showBars = true }) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const paused = hovering || focusing;
  const canAdvance = !reduced && !paused && slides.length > 1;

  // Auto-advance. The timer restarts whenever the slide changes (also after a dot click).
  useEffect(() => {
    if (!canAdvance) return undefined;
    const id = setTimeout(() => setActive((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(id);
  }, [canAdvance, active, slides.length]);

  return (
    <div className="auth-hero-inner">
      <div className="auth-hero-brand">
        <Logo className="h-8 w-8 text-white" />
        <span>SHUSH</span>
      </div>

      <div className="auth-hero-copy">
        <h1 className="auth-hero-title">{title}</h1>
        {subtitle && <p className="auth-hero-sub">{subtitle}</p>}

        {slides.length > 0 && (
          <div
            className="auth-carousel"
            role="region"
            aria-roledescription="carousel"
            aria-label="Highlights"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onFocus={() => setFocusing(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setFocusing(false);
            }}
          >
            <div className="auth-slides" aria-live={canAdvance ? 'off' : 'polite'}>
              {slides.map((slide, i) => (
                <div
                  key={slide.title}
                  className="auth-slide"
                  data-active={i === active}
                  aria-hidden={i !== active}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${slides.length}`}
                >
                  <h2 className="auth-slide-title">{slide.title}</h2>
                  <p className="auth-slide-text">{slide.text}</p>
                </div>
              ))}
            </div>

            {slides.length > 1 && (
              <div className="auth-dots">
                {slides.map((slide, i) => (
                  <button
                    key={slide.title}
                    type="button"
                    className="auth-dot"
                    aria-label={`Show slide ${i + 1}`}
                    aria-current={i === active}
                    onClick={() => setActive(i)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showBars && (
        <div className="auth-eq" aria-hidden="true">
          {EQ_BARS.map(([h, tone], i) => (
            <span
              key={i}
              className={`auth-eq-bar auth-eq-bar--${tone}`}
              style={{ '--h': h, '--i': i, '--d': `${4 + (i % 5) * 0.6}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
