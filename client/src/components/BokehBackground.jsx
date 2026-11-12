import './bokeh.css';

// Soft floating bokeh circles behind the student pages. Decorative only.
const DOTS = [
  [8, 14, 46, 0],
  [30, 62, 34, 1.4],
  [62, 12, 54, 2.8],
  [80, 58, 40, 0.7],
  [48, 40, 28, 3.6],
  [18, 80, 52, 2.1],
  [70, 80, 30, 4.4],
  [90, 22, 26, 1.9],
  [40, 84, 24, 3.1],
  [56, 66, 44, 5],
  [4, 48, 30, 4],
];

export default function BokehBackground() {
  return (
    <div className="bokeh" aria-hidden="true">
      {DOTS.map(([left, top, size, delay], i) => (
        <i
          key={i}
          className="bokeh-dot"
          style={{ left: `${left}%`, top: `${top}%`, '--s': `${size}px`, '--dl': `${delay}s` }}
        />
      ))}
    </div>
  );
}
