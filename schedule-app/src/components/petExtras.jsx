import PetGrowthDetail from "./PetGrowthDetail.jsx";
import { useId } from "react";
import PetEyes from "./PetEyes.jsx";
import PetDetail, { PetPaintDefs } from "./PetDetail.jsx";
import PetExpression from "./PetExpression.jsx";

const INK = "#292535";

export function Hoot() {
  const id = "hoot" + useId().replace(/\W/g, "");
  return <svg className="pet-art pet-rig" viewBox="0 0 32 32" aria-hidden="true">
<defs><PetPaintDefs id={`${id}-coat`} light="#cda17a" coat="#a87653" shade="#80553f" /></defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body pet-rig-frame" data-part="body" data-pet-part="body">
    <g fill="#d8a653" stroke={INK} strokeWidth=".85"><path d="M11 27v3m-2 0h4M21 27v3m-2 0h4" strokeLinecap="round" /></g>
    <g className="dg-pet-head pet-rig-head" data-part="head" style={{ "--pet-head-x": "16px", "--pet-head-y": "24px" }} data-pet-part="head">
<PetGrowthDetail pet="hoot" />
<path className="dg-pet-face" d="M6 10 5 4l6 3c3-1.5 7-1.5 10 0l6-3-1 6c2 3 2.4 7 1.4 11C26 27 21 29 16 29S6 27 4.6 21C3.6 17 4 13 6 10z" fill={`url(#${id}-coat)`} stroke={INK} strokeWidth="1.15" strokeLinejoin="round" />
<path d="M16 12c-5-5-11-2-9 5 1 4 5 5 9 5 4 0 8-1 9-5 2-7-4-10-9-5z" fill="#f6e6c5" />
<ellipse cx="16" cy="24.5" rx="6" ry="3.2" fill="#e3c79c" />
<path d="m12 23 1 1m3-1 1 1m3-1 1 1m-7 1 1 1m3-1 1 1" stroke="#a87653" strokeWidth=".7" strokeLinecap="round" />
<PetEyes left={11.3} right={20.7} y={15.2} rx={1.75} ry={1.75} ink="#252333" iris="#c9974c" />
<PetExpression left={11.3} right={20.7} y={15.2} ink={INK} beak />
<path className="dg-pet-beak" d="m16 18-1.6 1.2 1.6 2 1.6-2z" fill="#e8ad49" stroke={INK} strokeWidth=".65" />
<g className="dg-pet-sig dg-pet-sig-hoot dg-pet-glasses" fill="none" stroke={INK} strokeWidth="1">
      <circle cx="11.3" cy="15.2" r="3.8" /><circle cx="20.7" cy="15.2" r="3.8" /><path d="M15.1 15h1.8M7.5 14l-2-1M24.5 14l2-1" />
    </g>
<PetDetail pet="hoot" />
</g>

    <g className="dg-pet-wing dg-pet-wing-left pet-rig-wing-left" fill="#8d6048" stroke={INK} strokeWidth=".9" data-part="wing-left" data-pet-part="wing"><path d="M6 17c-3 1-3 8 1 9 2-3 2-6-1-9z" /></g>
    <g className="dg-pet-wing dg-pet-wing-right pet-rig-wing-right" fill="#8d6048" stroke={INK} strokeWidth=".9" data-part="wing-right" data-pet-part="wing"><path d="M26 17c3 1 3 8-1 9-2-3-2-6 1-9z" /></g>

    {/* Glasses are part of Hoot's identity, independent of wardrobe toggles. */}

    <path className="dg-pet-accessory" d="M11 23.3q5 1.8 10 0l.4 1.3q-5.4 1.8-10.8 0z" fill="#547e81" stroke={INK} strokeWidth=".55" />

<PetDetail pet="hoot" layer="body" />
</g></g></svg>;
}

export function Byte() {
  const id = "byte" + useId().replace(/\W/g, "");
  return <svg className="pet-art pet-rig" viewBox="0 0 32 32" aria-hidden="true">
<defs><PetPaintDefs id={`${id}-coat`} light="#d3eee4" coat="#a3d8cd" shade="#71aba3" /></defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body pet-rig-frame" data-part="body" data-pet-part="body">
    <g className="dg-pet-foot" fill="#6caea9" stroke={INK} strokeWidth=".9"><rect x="10" y="26" width="4.5" height="4" rx="1.4" /><rect x="17.5" y="26" width="4.5" height="4" rx="1.4" /></g>
    <rect x="10" y="20" width="12" height="7.5" rx="3" fill="#b4e2d6" stroke={INK} strokeWidth="1" />
    <circle cx="16" cy="23.7" r="1.5" fill="#f4bd67" stroke={INK} strokeWidth=".6" />
    <g className="dg-pet-wing dg-pet-wing-left dg-pet-arm pet-rig-wing-left" fill="#6caea9" stroke={INK} strokeWidth=".95" data-part="wing-left" data-pet-part="wing"><path d="M10 21 5 23" /><circle cx="4.8" cy="23" r="2" /></g>
    <g className="dg-pet-wing dg-pet-wing-right dg-pet-arm pet-rig-wing-right" fill="#6caea9" stroke={INK} strokeWidth=".95" data-part="wing-right" data-pet-part="wing"><path d="m22 21 5 2" /><circle cx="27.2" cy="23" r="2" /></g>
    <g className="dg-pet-head pet-rig-head" data-part="head" style={{ "--pet-head-x": "16px", "--pet-head-y": "24px" }} data-pet-part="head">
<PetGrowthDetail pet="byte" />
    <g className="dg-pet-antenna dg-pet-sig dg-pet-sig-byte" stroke={INK} strokeWidth="1"><path d="M16 7V3" /><circle cx="16" cy="2.8" r="1.6" fill="#f4bd67" /></g>
<rect className="dg-pet-face" x="5.8" y="7" width="20.4" height="14.7" rx="6" fill={`url(#${id}-coat)`} stroke={INK} strokeWidth="1.2" />
<path d="M9 9h14" stroke="#e6fff3" strokeWidth="1.2" strokeLinecap="round" />
<rect x="8.2" y="10.5" width="15.6" height="9" rx="3.5" fill="#253e49" />
<PetEyes left={12} right={20} y={14.7} rx={1.5} ry={1.85} ink="#253e49" iris="#92f0dc" digital square />
<path className="dg-pet-mouth-base" d="M14.4 17.6q1.6 1.2 3.2 0" fill="none" stroke="#92f0dc" strokeWidth=".7" strokeLinecap="round" />
<PetExpression y={14.7} mouthY={17.6} ink="#92f0dc" digital />
<PetDetail pet="byte" />
</g>

    <g className="dg-pet-accessory" fill="#f2bf68" stroke={INK} strokeWidth=".45"><path d="m16 21-3-1v3l3-1 3 1v-3z" /><circle cx="16" cy="21.5" r=".8" /></g>

<PetDetail pet="byte" layer="body" />
</g></g></svg>;
}

export function Pebble() {
  const id = "pebble" + useId().replace(/\W/g, "");
  return <svg className="pet-art pet-rig" viewBox="0 0 32 32" aria-hidden="true">
<defs><PetPaintDefs id={`${id}-coat`} light="#b7cd9c" coat="#78966d" shade="#526f4c" /><PetPaintDefs id={`${id}-skin`} light="#e4eacb" coat="#c4d6a5" shade="#9db57c" /></defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body pet-rig-frame" data-part="body" data-pet-part="body">
    <g className="dg-pet-shell" fill={`url(#${id}-coat)`} stroke={INK} strokeWidth="1.1">
      <path d="M3.2 25c-1-8 3-14 10.3-14s11 6 10 14z" />
      <path d="m13.5 14 4 3-1 5h-6l-1-5z" fill="#aec894" strokeWidth=".65" />
      <path d="M13.5 11v3m-10 6 6-3m14 3-6-3M9 25l1.5-3M18 25l-1.5-3" fill="none" strokeWidth=".65" />
    </g>
    <g className="dg-pet-foot" fill={`url(#${id}-skin)`} stroke={INK} strokeWidth=".85"><ellipse cx="7" cy="27" rx="2.5" ry="1.5" /><ellipse cx="17" cy="27" rx="2.5" ry="1.5" /></g>
    <g className="dg-pet-neck-stretch">
      <path d="M20 24h5v3h-5z" fill={`url(#${id}-skin)`} stroke={INK} strokeWidth=".85" />

      <g className="dg-pet-head pet-rig-head" data-part="head" style={{ "--pet-head-x": "23.7px", "--pet-head-y": "24px" }} data-pet-part="head">
<PetGrowthDetail pet="pebble" />
<g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left"><ellipse cx="19.7" cy="14.2" rx="1.3" ry="1.7" fill="#a3bc87" /></g>
<g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right"><ellipse cx="28" cy="14.2" rx="1.3" ry="1.7" fill="#a3bc87" /></g>
<path className="dg-pet-face" d="M17.5 18c0-5.2 3-7 6.4-7s6 2.8 6 7c0 4.8-2.9 7-6.2 7s-6.2-2.6-6.2-7z" fill={`url(#${id}-skin)`} stroke={INK} strokeWidth="1.1" />
<PetEyes left={21} right={26.5} y={17.2} rx={1.3} ry={1.3} ink="#252333" iris="#719563" />
<path className="dg-pet-mouth-base" d="M22 20.2q1.8 1.5 3.6 0" fill="none" stroke={INK} strokeWidth=".75" strokeLinecap="round" />
<PetExpression left={21} right={26.5} y={17.2} mouthY={20.2} ink={INK} />
<PetDetail pet="pebble" />
</g>

      <g className="dg-pet-accessory" fill="#cc896b" stroke={INK} strokeWidth=".5"><path d="M19.3 23q4 2 8 0v1.6q-4 2-8 0z" /><path d="m25 24 1 4 2-1-1-3z" /></g>
    </g>
    <path className="dg-pet-tail dg-pet-sig dg-pet-sig-pebble pet-rig-tail" d="m3 23-2 2 3 .4" fill={`url(#${id}-skin)`} stroke={INK} strokeWidth=".8" data-part="tail"  data-pet-part="tail" />

<PetDetail pet="pebble" layer="body" />
</g></g></svg>;
}

// A little seated hedgehog: a domed back, short rounded quills, and a
// cream face peeking out to one side. The back stays visible when it curls.
export function Prickle() {
  const id = "pk" + useId().replace(/\W/g, "");
  const ink = "#49372f";
  const quills = `url(#${id}-quills)`;
  const cream = `url(#${id}-cream)`;
  return <svg className="pet-art pet-rig" viewBox="0 0 32 32" aria-hidden="true"><defs>
      <radialGradient id={`${id}-quills`} cx="40%" cy="25%" r="80%">
        <stop offset="0" stopColor="#b99478" />
        <stop offset=".6" stopColor="#92715b" />
        <stop offset="1" stopColor="#6e5143" />
      </radialGradient>
      <radialGradient id={`${id}-cream`} cx="40%" cy="25%" r="85%">
        <stop offset="0" stopColor="#fff3db" />
        <stop offset=".7" stopColor="#f1d6ac" />
        <stop offset="1" stopColor="#dcb78b" />
      </radialGradient>
    </defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body pet-rig-frame" data-part="body" data-pet-part="body">

    {/* The quill tips follow a round back instead of a radial starburst. */}
    <g className="dg-pet-spines">
      <path d="M4.2 26.5c-1.8-1.5-2.3-4-1.6-6.2l-.8-1.1q-.3-1 .8-1.4l.8-.3-.8-1.6q-.3-.8.6-1.2l1.5-.5-.4-1.8q-.2-.8.7-1l1.7-.2.1-1.9q0-.8.9-.8l1.9.2.7-1.8q.3-.7 1.1-.3l1.7.8 1.2-1.5q.5-.6 1.2 0l1.4 1.2 1.6-1q.7-.4 1.2.3l1.1 1.6 1.8-.5q.8-.1 1 .7l.6 2 1.7.2q.8.1.8.9l-.1 2 1.4.9q.6.4.3 1.2l-.7 1.7.9 1.6q.5.7-.1 1.3l-1.2 1.2c.4 3.4-1.4 6.7-4.8 7.7-5.2 1.8-13.5 1.1-16.9-2z" fill={quills} stroke={ink} strokeWidth="1.1" strokeLinejoin="round" />
      {/* A few cream quill strokes read as texture even at greeting size. */}
      <path d="m8.5 12 .5-1.1.7 1m3.1-2 .5-1 .8 1.1m3.2-.8.7-.8.5 1.1M5.9 16.8l.4-1.1.8.9m2-2.1.4-1.1.8.9M5 21l.5-1.2.8.9m.7 3.1.4-1.1.8.9m.3-5.8.5-1.1.7.9" fill="none" stroke="#e2c2a0" strokeWidth=".65" strokeLinecap="round" strokeLinejoin="round" opacity=".8" />
    </g>

    <g className="dg-pet-unfurled">
      {/* Low body, little feet and a peachy belly. */}
      <path d="M11 22.5q8-4 14 0l.6 3.6q.2 4-7.4 4-7.8 0-7.7-3.5z" fill={cream} stroke={ink} strokeWidth=".9" />
      <ellipse cx="18.5" cy="27.4" rx="3.5" ry="2" fill="#fae8cc" />
      <g className="dg-pet-foot" fill="#c99c7c" stroke={ink} strokeWidth=".75">
        <ellipse cx="12.5" cy="29.2" rx="2.5" ry="1.1" />
        <ellipse cx="23" cy="29.2" rx="2.5" ry="1.1" />
        <path d="M11.9 29.2v.6m1.2-.6v.6m9.3-.6v.6m1.2-.6v.6" strokeWidth=".4" strokeLinecap="round" />
      </g>

      {/* Small round ears keep their shared mood posture hooks. */}

      {/* A pear-shaped face narrows into the nose, with soft cheek puffs. */}
      <g className="dg-pet-head pet-rig-head" data-part="head" style={{ "--pet-head-x": "19px", "--pet-head-y": "24px" }} data-pet-part="head">
<PetGrowthDetail pet="prickle" />
<g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left">
        <circle cx="12.1" cy="11.5" r="2.45" fill={cream} stroke={ink} strokeWidth=".85" />
        <circle cx="12.1" cy="11.7" r="1.25" fill="#dba399" />
      </g>
<g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right">
        <circle cx="25.3" cy="11.5" r="2.1" fill={cream} stroke={ink} strokeWidth=".85" />
        <circle cx="25.3" cy="11.7" r="1.05" fill="#dba399" />
      </g>
<path className="dg-pet-face" d="M19 9.3c5.2 0 8.4 3.1 8.4 7.5 0 2.5-1.1 4.2-3.2 5.5L21 24.4q-2 1.2-4 0l-3.2-2.1c-2.1-1.3-3.2-3-3.2-5.5 0-4.4 3.2-7.5 8.4-7.5z" fill={cream} stroke={ink} strokeWidth="1.05" strokeLinejoin="round" />
<path d="M15.2 11.1q2-1.1 3.4-.8" fill="none" stroke="#fff9ea" strokeWidth="1" strokeLinecap="round" />
<PetEyes left={15.6} right={22.4} y={16.8} rx={1.7} ry={1.95} ink="#49372f" iris="#b27e55" />
<g fill="#dc9a90" opacity=".55"><ellipse cx="12.9" cy="19.3" rx="1.6" ry=".8" /><ellipse cx="25.1" cy="19.3" rx="1.6" ry=".8" /></g>
<path d="M15.2 21q3.8-4.2 7.6 0l-1.9 2.6q-1.9 1.7-3.8 0z" fill="#fff1d7" />
<g className="dg-pet-sig dg-pet-sig-prickle">
        <path d="M17.4 20.2q1.6-1 3.2 0c.2.8-.7 1.6-1.6 1.6s-1.8-.8-1.6-1.6z" fill={ink} />
        <ellipse cx="18.5" cy="20.2" rx=".45" ry=".25" fill="#fff" opacity=".6" />
      </g>
<path className="dg-pet-mouth-base" d="M19 21.8v.6m0 0q-1 1.1-1.8.1m1.8-.1q1 1.1 1.8.1" fill="none" stroke={ink} strokeWidth=".65" strokeLinecap="round" />
<PetExpression left={15.6} right={22.4} y={16.8} mouthY={22.6} ink={ink} />
<PetDetail pet="prickle" />
</g>

      {/* A mint collar and two small front paws complete the seated pose. */}
      <g className="dg-pet-accessory">
        <path d="M14.4 24.7q4.6 1.4 9.2 0l.2 1.2q-4.8 1.5-9.6 0z" fill="#86b3a0" stroke={ink} strokeWidth=".45" />
        <circle cx="19" cy="26.6" r=".9" fill="#efc27a" stroke={ink} strokeWidth=".4" />
      </g>
      <g className="dg-pet-paw" fill="#f1d6ac" stroke={ink} strokeWidth=".65">
        <ellipse cx="13.4" cy="26.1" rx="1.55" ry="1.9" transform="rotate(15 13.4 26.1)" />
        <ellipse cx="24.4" cy="26.1" rx="1.55" ry="1.9" transform="rotate(-15 24.4 26.1)" />
      </g>
    </g>

<PetDetail pet="prickle" layer="body" />
</g></g></svg>;
}
