import { useId } from "react";
import PetEyes from "./PetEyes.jsx";
import PetExpression from "./PetExpression.jsx";
import PetDetail from "./PetDetail.jsx";

// Luna, redrawn (2026-10-20) from the supplied raster wolf into the roster's
// own vector style: the same grey coat, cream mask and chest, amber eyes and
// cream-tipped brush, plus a crescent-moon charm for the name. It is a normal
// `pet-art` pet now, so it carries the shared eyes, expressions and wardrobe.
//
// Distinct from Frost on purpose: Frost is the white husky mask with ice;
// Luna is the warm grey wolf with a cream face and no ice at all.
export default function Luna() {
  const id = "luna" + useId().replace(/\W/g, "");
  const ink = "#2a2c38";
  const fur = `url(#${id}-fur)`;
  const cream = `url(#${id}-cream)`;
  return (
    <svg className="pet-art" viewBox="0 0 32 32" aria-hidden="true"><defs>
        <radialGradient id={`${id}-fur`} cx="40%" cy="30%" r="78%">
          <stop offset="0" stopColor="#d3d5dc" />
          <stop offset=".58" stopColor="#a3a7b2" />
          <stop offset="1" stopColor="#737886" />
        </radialGradient>
        <radialGradient id={`${id}-cream`} cx="45%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#efdfc4" />
        </radialGradient>
      </defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body" data-part="body">

      {/* A big brush curling up the right side, cream at the tip. */}
      <g className="dg-pet-tail" data-part="tail">
        <path d="M20.6 28c4.4.8 7.8-1.4 8.6-5 .6-2.8-.2-5.6-2-7.6-.4 1.8-1.4 3-2.8 3.6.8 2.8 0 5.4-2.2 6.8-.8.5-1.6.8-2.4.9z" fill={fur} stroke={ink} strokeWidth="1" strokeLinejoin="round" />
        <path d="M27.2 15.4c1.8 2 2.6 4.8 2 7.6-1.1-.1-2.1-.7-2.7-1.7.6-1.9.6-4-.1-5.9z" fill={cream} />
        <path d="M23.4 25.4q2.6-1.1 3.4-3.7M24.8 26.6q2.4-1 3.3-3.1" fill="none" stroke="#5f6472" strokeWidth=".5" strokeLinecap="round" opacity=".7" />
      </g>

      {/* Seated: grey body, a cream chest ruff and cream forepaws. */}
      <path d="M10.4 23c.6-3.4 10.6-3.4 11.2 0l.5 4.6c0 2.2-2.9 3.1-6.1 3.1s-6.1-.9-6.1-3.1z" fill={fur} stroke={ink} strokeWidth="1" strokeLinejoin="round" />
      <path d="M12.1 22.8l1.3 1.5 1.3-1.2 1.3 1.6 1.3-1.6 1.3 1.2 1.3-1.5.4 3.2c-.4 2.2-1.9 3.6-4.3 3.6s-3.9-1.4-4.3-3.6z" fill={cream} />
      <ellipse cx="12.6" cy="29.3" rx="2.5" ry="1.3" fill={cream} stroke={ink} strokeWidth=".85" />
      <path d="M12 29.4v.8M13.2 29.4v.8" stroke={ink} strokeWidth=".45" strokeLinecap="round" opacity=".55" />
      <ellipse cx="19.4" cy="29.3" rx="2.5" ry="1.3" fill={cream} stroke={ink} strokeWidth=".85" />
      <path d="M18.8 29.4v.8M20 29.4v.8" stroke={ink} strokeWidth=".45" strokeLinecap="round" opacity=".55" />

      <g className="dg-pet-head" data-part="head" style={{ "--pet-head-x": "16px", "--pet-head-y": "24px" }}>
<g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left">
        <path d="M12.6 9.6 7 1.8 7.2 11.4z" fill={fur} stroke={ink} strokeWidth="1.05" strokeLinejoin="round" />
        <path d="M11.2 9.6 8 4.6l.2 5.4z" fill={cream} />
      </g>
<g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right">
        <path d="M19.4 9.6 25 1.8l-.2 9.6z" fill={fur} stroke={ink} strokeWidth="1.05" strokeLinejoin="round" />
        <path d="M20.8 9.6 24 4.6l-.2 5.4z" fill={cream} />
      </g>
      {/* Grey head with a spiky cheek ruff cut into the outline. */}
<path
        className="dg-pet-face"
        d="M16 7c5.6 0 9.2 3.4 9.6 8.4l2.5 1.1-2 1 1.6 1.6-2.5.4c-1.2 3.6-4.6 6-9.2 6s-8-2.4-9.2-6l-2.5-.4 1.6-1.6-2-1 2.5-1.1C6.8 10.4 10.4 7 16 7z"
        fill={fur}
        stroke={ink}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* The cream mask: cheeks and muzzle, grey left on the brow. */}
<path d="M16 12.6l1.3 1.8c1.4-1 3.4-1.3 5.2-.5 1.6.8 2.6 2.3 3 3.9l-1.4.6c-1.1 3.4-4.4 5.8-8.1 5.8s-7-2.4-8.1-5.8l-1.4-.6c.4-1.6 1.4-3.1 3-3.9 1.8-.8 3.8-.5 5.2.5z" fill={cream} />
<ellipse cx="11.8" cy="10.4" rx="3" ry="1.6" fill="#fff" opacity=".26" transform="rotate(-22 11.8 10.4)" />
<path d="M10.4 13.2q1.5-1 3-.4M21.6 13.2q-1.5-1-3-.4" fill="none" stroke="#fff6e6" strokeWidth=".75" strokeLinecap="round" />
<PetEyes left={12.3} right={19.7} y={16.4} rx={2.05} ry={2.3} ink={ink} iris="#bb8a4c" />
<g fill="#f2a9b4" opacity=".4"><ellipse cx="8.9" cy="19.2" rx="1.5" ry=".9" /><ellipse cx="23.1" cy="19.2" rx="1.5" ry=".9" /></g>
<ellipse cx="16" cy="20.4" rx="3.3" ry="2.3" fill="#fffaf0" stroke="#e4d2b4" strokeWidth=".35" />
<path className="dg-pet-sig dg-pet-sig-new-nose" d="M14.6 18.9q1.4-.7 2.8 0 0 1-1.4 1.6-1.4-.6-1.4-1.6z" fill={ink} />
<circle cx="15.5" cy="19" r=".28" fill="#fff" opacity=".7" />
<path className="dg-pet-mouth-base" d="M16 20.5v.6m0 0q-1.2 1.3-2.4.3m2.4-.3q1.2 1.3 2.4.3" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />
<PetExpression left={12.3} right={19.7} y={16.4} mouthY={21} ink={ink} />
<PetDetail pet="luna" />
</g>

      {/* Midnight collar with a crescent-moon charm. */}
      <g className="dg-pet-accessory">
        <path d="M10.4 24.3c3.6 1.5 7.6 1.5 11.2 0l.35 1.5c-3.8 1.7-8.1 1.7-11.9 0z" fill="#2d3a6b" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
        <path d="M16.7 25.5a1.55 1.55 0 1 0 .8 2.8 1.25 1.25 0 1 1-.8-2.8z" fill="#f5d36a" stroke="#9a7420" strokeWidth=".3" strokeLinejoin="round" />
      </g>

<PetDetail pet="luna" layer="body" />
</g></g></svg>
  );
}
