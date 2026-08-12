// Small hand-drawn Indian tricolor + Ashoka Chakra. Rendered as SVG rather
// than the 🇮🇳 emoji — Windows Chrome/Edge frequently fall back to showing
// the raw regional-indicator letters ("IN") instead of an actual flag glyph.
// Fewer, thicker spokes than a "real" chakra (24) — at the small pixel sizes
// this renders at inline with text, 24 hairlines just anti-alias into a grey
// smudge. 12 thicker spokes stay legible as a wheel down to ~14px.
const SPOKES = Array.from({ length: 12 });

export default function IndiaFlagIcon({ size = 16, className = "" }) {
  const w = Math.round(size * 1.5);
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 36 24"
      aria-hidden="true"
      className={className}
      style={{ display: "inline-block", verticalAlign: "-3px", borderRadius: 3, boxShadow: "0 0 0 1px rgba(0,0,0,.12)", flexShrink: 0 }}
    >
      <rect width="36" height="24" fill="#F5F5F0" />
      <rect width="36" height="8" fill="#FF9933" />
      <rect y="16" width="36" height="8" fill="#138808" />
      {SPOKES.map((_, i) => (
        <line key={i} x1="18" y1="12" x2="18" y2="9" stroke="#0A3161" strokeWidth="0.8" transform={`rotate(${i * 30} 18 12)`} />
      ))}
      <circle cx="18" cy="12" r="3" fill="none" stroke="#0A3161" strokeWidth="0.9" />
    </svg>
  );
}
