import { LOGO_PATHS, LOGO_VIEWBOX } from '../lib/logoPaths.js';

// The SHUSH logo: two sound-bar pills and two interlocking bars. It takes its color from the text
// color (text-shush-orange on light, text-white on orange), so one component serves every background.
// Four separate paths so the hover motion in motion.css (.m-logo) can still move each bar.
export default function Logo({ className = 'h-8 w-8 text-shush-orange' }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox={LOGO_VIEWBOX}>
      {LOGO_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
