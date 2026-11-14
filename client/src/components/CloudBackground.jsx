import './cloud-background.css';

/* Adapted from BrewedOps Motion Library: Clouds parallax, Radial glow, Wave lines */

// One wave line: a cubic curve repeated 8 times (period 300). The SVG is 200% wide
// and slides by exactly half of itself, so the loop has no visible seam.
const PERIOD = 300;
const WAVE_PATH =
  'M0 60 ' +
  Array.from({ length: 8 }, (_, i) => {
    const x = i * PERIOD;
    return `C ${x + 100} 20, ${x + 200} 100, ${x + PERIOD} 60`;
  }).join(' ');

/**
 * Decorative drifting clouds, a pulsing glow and slow wave lines.
 * variant: 'hero' (over the orange panel), 'page' (cream-gold page), 'card' (very faint, inside cards).
 */
export default function CloudBackground({ variant = 'page' }) {
  return (
    <div className={`cloud-bg cloud-bg--${variant}`} aria-hidden="true">
      <span className="cloud-bg__glow" />
      <span className="cloud-bg__cloud cloud-bg__cloud--a" />
      <span className="cloud-bg__cloud cloud-bg__cloud--b" />
      <span className="cloud-bg__cloud cloud-bg__cloud--c" />
      <div className="cloud-bg__waves">
        <svg viewBox={`0 0 ${PERIOD * 8} 120`} preserveAspectRatio="none" focusable="false">
          <path d={WAVE_PATH} className="cloud-bg__wave cloud-bg__wave--1" />
          <path d={WAVE_PATH} className="cloud-bg__wave cloud-bg__wave--2" transform="translate(0 22)" />
        </svg>
      </div>
    </div>
  );
}
