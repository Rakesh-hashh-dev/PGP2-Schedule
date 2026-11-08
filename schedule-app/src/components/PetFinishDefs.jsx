// Shared lighting for every companion, mounted once at the app root.
//
// The pets were lit by painted white "gloss" shapes, identical on every animal,
// which read as vinyl. These filters light the silhouette instead: a soft key
// light inside the upper-left edge, a form shadow inside the lower-right, a thin
// rim light just inside the outline on the back edge, and (heads only) a soft
// contact shadow cast onto the body. Erosion keeps every effect inside the
// outline so line colour is never washed out.
//
// Applied by styles/pet-finish.css only at portrait sizes (container ≥ 96px):
// at the 40px chip the effect is invisible and filters cost paint on every
// breath frame. All values are SVG user units of the 32-unit pet canvas.
//
// Ids are global and fixed on purpose: CSS `filter: url(#…)` cannot be scoped
// per instance, and one copy serves every pet on the page.

const FINISHES = {
  // Standard pets: broad soft light and shade only. A white rim just inside the
  // outline read as a doubled line, so rim light is the rare pets' signature.
  base: { key: "#fff6e4", keyOp: .24, rimOp: 0, shade: "#2a1838", shadeOp: .17 },
  // Higher-tier companions: rarity shows in the finish, not only the props.
  frost: { key: "#f2fbff", keyOp: .3, rim: "#c9eeff", rimOp: .7, shade: "#14284a", shadeOp: .18 },
  unicorn: { key: "#fff8ff", keyOp: .28, rim: "#ffc9ef", rimOp: .65, shade: "#3a2160", shadeOp: .14, rimClass: "pf-rim-iridescent" },
  dragon: { key: "#fff1c8", keyOp: .28, rim: "#ffe08a", rimOp: .6, shade: "#0d2c22", shadeOp: .2, sheen: true },
};

// A crescent just inside the silhouette, on the side opposite (dx, dy).
function Crescent({ dx, dy, blur, result }) {
  return <>
    <feOffset in="core" dx={dx} dy={dy} result={`${result}-o`} />
    <feComposite in="core" in2={`${result}-o`} operator="out" result={`${result}-e`} />
    <feGaussianBlur in={`${result}-e`} stdDeviation={blur} result={`${result}-b`} />
    <feComposite in={`${result}-b`} in2="core" operator="in" result={result} />
  </>;
}

function Tint({ inside, color, opacity, result, className }) {
  return <>
    <feFlood className={className} floodColor={color} floodOpacity={opacity} result={`${result}-f`} />
    <feComposite in={`${result}-f`} in2={inside} operator="in" result={result} />
  </>;
}

function FigureFilter({ id, f }) {
  return <filter id={id} x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
    <feMorphology in="SourceAlpha" operator="erode" radius=".75" result="core" />
    {/* Wide offsets + wide blur = a gradient across the form, not a band. */}
    <Crescent dx={2.6} dy={3} blur={1.8} result="keyA" />
    <Tint inside="keyA" color={f.key} opacity={f.keyOp} result="key" />
    <Crescent dx={-2.2} dy={-2.8} blur={1.9} result="shadeA" />
    <Tint inside="shadeA" color={f.shade} opacity={f.shadeOp} result="shade" />
    {f.rimOp > 0 && <>
      {/* Rim on the shadow side (lower right), where back light would catch. */}
      <Crescent dx={-.45} dy={-.35} blur={.22} result="rimA" />
      <Tint inside="rimA" color={f.rim} opacity={f.rimOp} result="rim" className={f.rimClass} />
    </>}
    {f.sheen && <>
      {/* Dragon scales: a second, broader warm glint across the top plane. */}
      <Crescent dx={.4} dy={2.6} blur={.7} result="sheenA" />
      <Tint inside="sheenA" color="#ffe9a8" opacity={.28} result="sheen" className="pf-sheen" />
    </>}
    <feMerge>
      <feMergeNode in="SourceGraphic" />
      <feMergeNode in="shade" />
      <feMergeNode in="key" />
      {f.sheen && <feMergeNode in="sheen" />}
      {f.rimOp > 0 && <feMergeNode in="rim" />}
    </feMerge>
  </filter>;
}

// Heads: a contact shadow falling onto the body, plus a light form shadow so the
// head reads as a separate volume from the torso behind it.
function HeadFilter({ id }) {
  return <filter id={id} x="-15%" y="-15%" width="130%" height="140%" colorInterpolationFilters="sRGB">
    <feMorphology in="SourceAlpha" operator="erode" radius=".6" result="core" />
    <Crescent dx={-1.4} dy={-2} blur={1.2} result="shadeA" />
    <Tint inside="shadeA" color="#2a1838" opacity={.12} result="shade" />
    <feMorphology in="SourceAlpha" operator="erode" radius="1" result="mass" />
    <feGaussianBlur in="mass" stdDeviation=".8" result="drop-b" />
    <feOffset in="drop-b" dy="1.1" result="drop-o" />
    <Tint inside="drop-o" color="#1d1426" opacity={.26} result="drop" />
    <feMerge>
      <feMergeNode in="drop" />
      <feMergeNode in="SourceGraphic" />
      <feMergeNode in="shade" />
    </feMerge>
  </filter>;
}

export default function PetFinishDefs() {
  return <svg className="pet-finish-defs" width="0" height="0" aria-hidden="true" focusable="false"
    style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
    <defs>
      {Object.entries(FINISHES).map(([name, f]) => <FigureFilter key={name} id={`pf-figure-${name}`} f={f} />)}
      <HeadFilter id="pf-head" />
      {/* Whiskers fade out toward their tips (both sides of the face). */}
      <linearGradient id="pf-fade-x" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#000" />
        <stop offset=".3" stopColor="#fff" />
        <stop offset=".7" stopColor="#fff" />
        <stop offset="1" stopColor="#000" />
      </linearGradient>
      <mask id="pf-whisker-mask" maskContentUnits="objectBoundingBox" x="-.1" y="-.5" width="1.2" height="2">
        <rect x="-.1" y="-.5" width="1.2" height="2" fill="url(#pf-fade-x)" />
      </mask>
    </defs>
  </svg>;
}
