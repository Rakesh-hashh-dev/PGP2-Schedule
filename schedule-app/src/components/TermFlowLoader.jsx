import { useId } from "react";

/**
 * TermFlow animated mark.
 *
 * <TermFlowLoader />                      → indeterminate spinner (use during fetches/polling)
 * <TermFlowLoader variant="splash" />     → the 6-beat build sequence (use on first paint / splash)
 *
 * Props:
 *   size       number  px (default 72)
 *   variant    "spin" | "splash"          (default "spin")
 *   label      string  accessible label   (default "Loading…")
 *   className  string  optional wrapper class
 *   style      object  optional inline style
 *
 * Every <svg> instance generates its own gradient / keyframe IDs, so you can
 * drop several on the same page without them clashing. Respects
 * prefers-reduced-motion (shows the finished mark, no motion).
 */
export default function TermFlowLoader({
  size = 72,
  variant = "spin",
  label = "Loading…",
  className,
  style,
}) {
  const u = useId().replace(/:/g, "");
  const id = (n) => `${u}-${n}`;
  const splash = variant === "splash";

  const css = `
    .${u}-mark   { transform-box:view-box; transform-origin:120px 120px; }
    .${u}-amb    { }
    ${splash ? `
    .${u}-ripple { opacity:0; transform-box:view-box; transform-origin:120px 120px; animation:${u}-ripple 1s ease-out both; }
    .${u}-ripple.r2 { animation-delay:.18s; }
    .${u}-ring   { stroke-dasharray:578; stroke-dashoffset:578; animation:${u}-draw .85s ease-out .35s both; }
    .${u}-flow   { opacity:0; transform-box:view-box; transform-origin:120px 200px; animation:${u}-grow .6s cubic-bezier(.2,.7,.3,1.2) 1.2s both; }
    .${u}-arrow  { opacity:0; transform-box:fill-box; transform-origin:50% 62%; animation:${u}-arr .55s cubic-bezier(.2,.7,.3,1.3) 1.55s both; }
    .${u}-card   { opacity:0; transform-box:view-box; transform-origin:120px 120px; animation:${u}-pop .55s cubic-bezier(.2,.7,.3,1.4) 1.9s both; }
    .${u}-amb    { opacity:0; animation:${u}-alive 1.1s ease-in-out 2.1s both; }
    .${u}-mark   { animation:${u}-settle 1.1s ease-in-out 2.1s both; }
    .${u}-comet  { transform-box:view-box; transform-origin:120px 120px; animation:${u}-trace 1.1s ease-in-out .3s both; }
    @keyframes ${u}-ripple { 0%{transform:scale(.15);opacity:0} 25%{opacity:.85} 100%{transform:scale(1.7);opacity:0} }
    @keyframes ${u}-draw   { from{stroke-dashoffset:578} to{stroke-dashoffset:0} }
    @keyframes ${u}-grow   { 0%{opacity:0;transform:scale(0)} 60%{opacity:1} 100%{opacity:1;transform:scale(1)} }
    @keyframes ${u}-arr    { 0%{opacity:0;transform:scale(.5)} 100%{opacity:1;transform:scale(1)} }
    @keyframes ${u}-pop    { 0%{opacity:0;transform:scale(.7)} 70%{transform:scale(1.08)} 100%{opacity:1;transform:scale(1)} }
    @keyframes ${u}-alive  { 0%{opacity:0} 55%{opacity:.42} 100%{opacity:.28} }
    @keyframes ${u}-settle { 0%{transform:scale(1)} 45%{transform:scale(1.04)} 100%{transform:scale(1)} }
    @keyframes ${u}-trace  { 0%{opacity:0;transform:rotate(-95deg)} 12%{opacity:1} 85%{opacity:1;transform:rotate(245deg)} 100%{opacity:0;transform:rotate(265deg)} }
    ` : `
    .${u}-mark  { animation:${u}-breathe 2.6s ease-in-out infinite; }
    .${u}-amb   { opacity:.24; animation:${u}-glow 2.6s ease-in-out infinite; }
    .${u}-comet { transform-box:view-box; transform-origin:120px 120px; animation:${u}-orbit 1.5s linear infinite; }
    @keyframes ${u}-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.028)} }
    @keyframes ${u}-glow    { 0%,100%{opacity:.16} 50%{opacity:.36} }
    @keyframes ${u}-orbit   { to{transform:rotate(360deg)} }
    `}
    @media (prefers-reduced-motion: reduce){
      .${u}-ripple,.${u}-comet{ display:none; }
      .${u}-mark,.${u}-flow,.${u}-arrow,.${u}-card,.${u}-ring{ animation:none; opacity:1; transform:none; stroke-dashoffset:0; }
      .${u}-amb{ animation:none; opacity:.28; }
    }
  `;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      role="img"
      aria-label={label}
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={id("ring")} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#EBD9FF" /><stop offset="0.5" stopColor="#A855F7" /><stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
        <linearGradient id={id("arrow")} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FBF8FF" /><stop offset="0.5" stopColor="#B98CF7" /><stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id={id("arrowDark")} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#A77EE0" /><stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
        <linearGradient id={id("flow")} x1="0.2" y1="0" x2="0.45" y2="1">
          <stop offset="0" stopColor="#5B21B6" /><stop offset="0.5" stopColor="#8B3DF5" /><stop offset="1" stopColor="#C77DFF" />
        </linearGradient>
        <linearGradient id={id("flowHi")} x1="0.2" y1="0" x2="0.45" y2="1">
          <stop offset="0" stopColor="#8B3DF5" /><stop offset="1" stopColor="#E3C2FF" />
        </linearGradient>
        <filter id={id("glow")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={id("soft")} x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="10" /></filter>
        <filter id={id("dot")} x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      <style>{css}</style>

      <ellipse className={`${u}-amb`} cx="120" cy="128" rx="55" ry="66" fill="#8B3DF5" filter={`url(#${id("soft")})`} />

      {splash && (
        <>
          <circle className={`${u}-ripple`} cx="120" cy="120" r="34" fill="none" stroke="#A855F7" strokeWidth="3" />
          <circle className={`${u}-ripple r2`} cx="120" cy="120" r="34" fill="none" stroke="#C77DFF" strokeWidth="2" />
        </>
      )}

      <g className={`${u}-mark`} filter={`url(#${id("glow")})`}>
        <circle className={splash ? `${u}-ring` : undefined} cx="120" cy="120" r="92" fill="none" stroke={`url(#${id("ring")})`} strokeWidth="7" />

        <g className={splash ? `${u}-flow` : undefined}>
          <path fill={`url(#${id("flow")})`} d="M120,200 C 140,192 148,168 136,146 C 128,131 121,127 120,122 C 118,130 112,134 106,146 C 112,150 110,158 104,164 C 110,168 108,178 100,184 C 108,192 113,197 120,200 Z" />
          <path fill={`url(#${id("flowHi")})`} d="M120,194 C 132,188 137,170 129,154 C 124,143 120,138 120,134 C 117,142 112,148 110,158 C 107,170 110,186 120,194 Z" />
        </g>

        <g transform="translate(118,100) rotate(42)">
          <g className={splash ? `${u}-arrow` : undefined}>
            <path d="M0,-50 L25,40 L0,18 L-25,40 Z" fill={`url(#${id("arrow")})`} />
            <path d="M0,-50 L0,18 L-25,40 Z" fill={`url(#${id("arrowDark")})`} />
          </g>
        </g>

        <g className={splash ? `${u}-card` : undefined}>
          <g fill={`url(#${id("ring")})`}>
            <path d="M120,11 L127,28 L120,45 L113,28 Z" /><path d="M229,120 L212,127 L195,120 L212,113 Z" />
            <path d="M120,229 L113,212 L120,195 L127,212 Z" /><path d="M11,120 L28,113 L45,120 L28,127 Z" />
          </g>
          <text x="120" y="39" fontFamily="Arial, sans-serif" fontSize="15" fontWeight="700" fill="#F5EEFF" textAnchor="middle">N</text>
        </g>
      </g>

      <g className={`${u}-comet`}>
        {!splash && (
          <path d="M120,28 A92,92 0 0 0 40,74" fill="none" stroke="#FBF8FF" strokeWidth="4" strokeLinecap="round" opacity="0.55" filter={`url(#${id("dot")})`} />
        )}
        <circle cx="120" cy="28" r="5.5" fill="#F8F2FF" filter={`url(#${id("dot")})`} />
        <circle cx="120" cy="28" r="3" fill="#FFFFFF" />
      </g>
    </svg>
  );
}
