// The six devotion companions from PR #22 (Maple, Ember, Mochi, Nimbus, Sable,
// Inky), ported onto the `pet-art` structure every other vector pet uses:
// ground, canvas, a breathing body, and a head group carrying the ears, face,
// shared PetEyes (pointer-tracking pupils, blink, eye-open) and PetExpression.
// The drawings are the PR's own; only the scaffolding around them changed.
//
// Signatures are single-class `.dg-pet-sig-new-*` rules (styles.css), sitting
// before both motion guards like the rest of the roster.
import { useId } from "react";
import PetEyes from "./PetEyes.jsx";
import PetExpression, { PetGesture } from "./PetExpression.jsx";

const INK = "#302333";
const CREAM = "#fff1d9";
const HEAD = { "--pet-head-x": "16px", "--pet-head-y": "24px" };

function Palette({ id, light, mid, dark }) {
  return <defs>
    <radialGradient id={id} cx="34%" cy="20%" r="86%">
      <stop offset="0" stopColor={light} /><stop offset=".6" stopColor={mid} /><stop offset="1" stopColor={dark} />
    </radialGradient>
  </defs>;
}

/** The shared wrapper: ground shadow, canvas inset and the breathing body. */
function Art({ defs, children, rig = false, moth = false }) {
  return <svg className={`pet-art${rig ? " pet-rig" : ""}${moth ? " pet-rig-moth" : ""}`} viewBox="0 0 32 32" aria-hidden="true">
    {defs}
    <ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
    <g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
      <g className="dg-pet-body" data-part="body">{children}</g>
    </g>
  </svg>;
}

function Eyes({ iris = "#e5ae51", y = 16, left = 12, right = 20 }) {
  return <PetEyes left={left} right={right} y={y} rx={2.1} ry={2.45} ink={INK} iris={iris} />;
}

function Smile({ y = 22, nose = true }) {
  return <>
    {nose && <path className="dg-pet-sig dg-pet-sig-new-nose" d={`M14.8 ${y - 2.8}q1.2-.8 2.4 0Q17.5 ${y - 1.7} 16 ${y - 1.4}q-1.5-.3-1.2-1.4z`} fill={INK} />}
    <path className="dg-pet-mouth-base" d={`M14.2 ${y}q1.8 1.5 3.6 0`} fill="none" stroke={INK} strokeWidth=".7" strokeLinecap="round" />
  </>;
}

function Scarf({ color = "#839b68" }) {
  return <g className="dg-pet-accessory" fill={color} stroke={INK} strokeWidth=".55" strokeLinejoin="round">
    <path d="M10.9 24q5.1 1.4 10.2 0l.3 1.5q-5.4 1.9-10.8 0z" />
    <path d="m18.8 25.6 2.8 3-2.5.3-1.6-3z" />
    <path d="m12.2 24.9 6.8.2" fill="none" stroke="#fff" opacity=".35" />
  </g>;
}

// A red panda: ringed tail, cream mask, a moss scarf.
export function Maple() {
  const id = "maple" + useId().replace(/\W/g, "");
  const fur = `url(#${id})`;
  return <Art defs={<Palette id={id} light="#ffbc73" mid="#db763d" dark="#a24e31" />}>
    <g className="dg-pet-tail" data-part="tail">
      <path d="M20.6 29c7.4 2 11-3.8 9.6-10.3-.7-3.2-3.3-5.1-5.2-3.8-2.4 1.6.9 4.6-.9 8.4-1 2.1-2.5 2.6-4.3 2.8z" fill={fur} stroke={INK} strokeWidth="1" />
      <path d="m24.9 17 4.7 1.4m-4.3 2.1 5 .6m-6 2.8 5.3 1.3m-7.7 1.2 3.1 3.2" fill="none" stroke="#843b2b" strokeWidth="1.7" />
    </g>
    <ellipse cx="15.6" cy="25.8" rx="7.5" ry="4.5" fill="#673d38" stroke={INK} strokeWidth="1" />
    <ellipse cx="15.6" cy="25" rx="4.4" ry="3.5" fill={fur} />
    <ellipse cx="11.6" cy="29" rx="2.4" ry="1.5" fill="#673d38" stroke={INK} strokeWidth=".7" />
    <ellipse cx="19.8" cy="29" rx="2.4" ry="1.5" fill="#673d38" stroke={INK} strokeWidth=".7" />
    <g className="dg-pet-head" data-part="head" style={HEAD}>
      <g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left"><path d="M7.8 12Q2.4 8 5.5 3.9q4.8-.5 7 5z" fill={fur} stroke={INK} strokeWidth="1" /><path d="M7.6 9.3 6.3 5.8q3 .5 4.2 3z" fill={CREAM} /></g>
      <g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right"><path d="M24.2 12q5.4-4 2.3-8.1-4.8-.5-7 5z" fill={fur} stroke={INK} strokeWidth="1" /><path d="m24.4 9.3 1.3-3.5q-3 .5-4.2 3z" fill={CREAM} /></g>
      <path className="dg-pet-face" d="M16 7.5c6.2 0 10.1 3.7 10.1 9.1l1.5 1.4-2 1q-1.1 6-9.6 6-8.5 0-9.6-6l-2-1 1.5-1.4C5.9 11.2 9.8 7.5 16 7.5z" fill={fur} stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M7.1 17q1.5-5 5-4 1.8 2 3.9 5 2.1-3 3.9-5 3.5-1 5 4 .2 6.7-8.9 7.3-9.1-.6-8.9-7.3z" fill={CREAM} />
      <path d="m10.7 10.8 2.3-.3m6 0 2.3.3" stroke={CREAM} strokeWidth="1.5" strokeLinecap="round" />
      <Eyes y={16.5} /><Smile y={22} />
      <PetExpression y={16.5} mouthY={22} ink={INK} />
    </g>
    <Scarf />
    <PetGesture fur="#673d38" ink={INK} />
  </Art>;
}

// A baby dragon: teal scales, violet wings, a flame on the tail tip.
export function Ember() {
  const id = "ember" + useId().replace(/\W/g, "");
  const fur = `url(#${id})`;
  return <Art rig defs={<Palette id={id} light="#91e7cf" mid="#3eaaab" dark="#28657c" />}>
    <g className="dg-pet-tail pet-rig-tail" data-pet-part="tail" data-part="tail"><path d="M21 28q9.5 3 7.4-6" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" /><path d="M21 28q9.5 3 7.4-6" fill="none" stroke="#429e9e" strokeWidth="2.2" strokeLinecap="round" /><path className="dg-pet-sig dg-pet-sig-new-flame" d="M28.5 23q-3.6-1.6-1.1-5.1.1 1.4 1.3 1.7l1.3-2q2.8 4-1.5 5.4z" fill="#ffba62" stroke="#a86644" strokeWidth=".6" /></g>
    <g className="dg-pet-wing dg-pet-wing-left pet-rig-wing-left" data-pet-part="wing" data-part="wing-left"><path d="M10.5 22Q.8 25 2.6 12q5.8.6 9.5 6z" fill="#8973bb" stroke={INK} strokeWidth=".9" /><path d="m10 21-6-7 1 6 3-2" fill="none" stroke="#b8a3df" strokeWidth=".65" /></g>
    <g className="dg-pet-wing dg-pet-wing-right pet-rig-wing-right" data-pet-part="wing" data-part="wing-right"><path d="M21.5 22q9.7 3 7.9-10-5.8.6-9.5 6z" fill="#8973bb" stroke={INK} strokeWidth=".9" /><path d="m22 21 6-7-1 6-3-2" fill="none" stroke="#b8a3df" strokeWidth=".65" /></g>
    <g className="pet-rig-body" data-pet-part="body"><ellipse cx="16" cy="25.6" rx="6.4" ry="4.6" fill={fur} stroke={INK} strokeWidth="1" /><ellipse cx="16" cy="26" rx="3.5" ry="3.7" fill={CREAM} />
    <path d="M13 25.6q3 1 6 0m-5.5 2q2.5 1 5 0" fill="none" stroke="#d7be8c" strokeWidth=".55" />
    </g><g className="pet-rig-feet" data-pet-part="body"><ellipse cx="11.3" cy="29.2" rx="2.5" ry="1.4" fill={fur} stroke={INK} strokeWidth=".7" /><ellipse cx="20.7" cy="29.2" rx="2.5" ry="1.4" fill={fur} stroke={INK} strokeWidth=".7" />
    </g><g className="dg-pet-head pet-rig-head" data-part="head" data-pet-part="head" style={HEAD}>
      <path d="M9.2 10.6q-4-2.4-2.7-6.8 1.5 2.9 4.9 3.6m9.4 3.2q4-2.4 2.7-6.8-1.5 2.9-4.9 3.6" fill={CREAM} stroke={INK} strokeWidth=".8" />
      <path className="dg-pet-face" d="M16 7q10 0 10 10c0 5.5-4.4 8.2-10 8.2S6 22.5 6 17Q6 7 16 7z" fill={fur} stroke={INK} strokeWidth="1.1" />
      <path d="m13.1 8.2 1.4-3 1.5 2.3 1.5-2.3 1.4 3" fill="#378991" stroke={INK} strokeWidth=".6" strokeLinejoin="round" />
      <ellipse cx="16" cy="21.2" rx="5.2" ry="3" fill={CREAM} /><Eyes iris="#f4c269" />
      <circle cx="14.4" cy="20.1" r=".4" fill={INK} /><circle cx="17.6" cy="20.1" r=".4" fill={INK} />
      <Smile y={22.1} nose={false} />
      <path className="pet-rig-mature" d="m11 12 1-1 1 1m6 0 1-1 1 1" fill="none" stroke="#b3efe0" strokeWidth=".6" /><PetExpression mouthY={22.1} ink={INK} />
    </g>
    <g className="pet-rig-neck"><g className="dg-pet-accessory"><path d="M11.1 24.6q4.9 1.4 9.8 0" fill="none" stroke="#8a65b8" strokeWidth="1.5" /><circle cx="16" cy="26" r=".8" fill="#f5c66c" /></g>
    </g><PetGesture fur="#4bb3ac" ink={INK} />
  </Art>;
}

// A capybara with a leaf on its head.
export function Mochi() {
  const id = "mochi" + useId().replace(/\W/g, "");
  const fur = `url(#${id})`;
  return <Art rig defs={<Palette id={id} light="#eac894" mid="#c69465" dark="#996c4d" />}>
    <g className="pet-rig-body" data-pet-part="body"><ellipse cx="16" cy="25.5" rx="8.2" ry="5" fill={fur} stroke={INK} strokeWidth="1" />
    <ellipse cx="16" cy="26.4" rx="4.4" ry="3.1" fill="#e2b788" />
    </g><g className="pet-rig-feet" data-pet-part="body"><ellipse cx="11" cy="29.3" rx="2.9" ry="1.3" fill="#b48a6a" stroke={INK} strokeWidth=".7" /><ellipse cx="21" cy="29.3" rx="2.9" ry="1.3" fill="#b48a6a" stroke={INK} strokeWidth=".7" />
    </g><g className="dg-pet-head pet-rig-head" data-part="head" data-pet-part="head" style={HEAD}>
      <g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left"><ellipse cx="7.4" cy="9.5" rx="2.9" ry="3.3" fill={fur} stroke={INK} strokeWidth=".9" /><ellipse cx="7.4" cy="9.5" rx="1.45" ry="1.8" fill="#a26b54" /></g>
      <g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right"><ellipse cx="24.6" cy="9.5" rx="2.9" ry="3.3" fill={fur} stroke={INK} strokeWidth=".9" /><ellipse cx="24.6" cy="9.5" rx="1.45" ry="1.8" fill="#a26b54" /></g>
      <path className="dg-pet-face" d="M16 8Q6 8 5.6 17.8C5.1 23.6 9.4 26 16 26s10.9-2.4 10.4-8.2Q26 8 16 8z" fill={fur} stroke={INK} strokeWidth="1.1" />
      <ellipse cx="16" cy="21.1" rx="6.5" ry="3.8" fill="#b48a6a" />
      <Eyes iris="#bb804f" y={16} />
      <g className="dg-pet-sig dg-pet-sig-new-nose" fill={INK}><ellipse cx="14" cy="20" rx=".65" ry=".45" /><ellipse cx="18" cy="20" rx=".65" ry=".45" /></g>
      <path d="M16 20.7v1.2" fill="none" stroke="#88624f" strokeWidth=".55" /><Smile y={22.4} nose={false} />
      <path className="pet-rig-mature" d="m10 12 1-.4m10 .4 1 .4" stroke="#f5dfb5" strokeWidth=".7" /><PetExpression mouthY={22.4} ink={INK} />
      <g className="dg-pet-accessory"><path d="M15.8 9q-4.6-6.7 5.8-5.8Q21.2 9.5 15.8 9z" fill="#80a86b" stroke={INK} strokeWidth=".6" /><path d="m16 8.6 4-4" stroke="#d3df9b" strokeWidth=".5" /></g>
    </g>
    <PetGesture fur="#c69465" ink={INK} />
  </Art>;
}

// A moon moth: lavender wings, feathered antennae and a gold crescent.
export function Nimbus() {
  const id = "nimbus" + useId().replace(/\W/g, "");
  const fur = `url(#${id})`;
  return <Art rig moth defs={<Palette id={id} light="#eee6ff" mid="#b09bdc" dark="#7364a5" />}>
    {[false, true].map(right => <g key={String(right)} transform={right ? "translate(32 0) scale(-1 1)" : undefined}>
      <g className={right ? "pet-rig-wing-right" : "pet-rig-wing-left"} data-pet-part="wing">
        <path className="dg-pet-wing" d="M14 14C10 9 2 6 1.4 11.8.7 16.8 4.3 20 8.8 20.2 3.4 21.5 3.4 27 7.4 27.3c3.1.2 5.5-3.5 7.2-6.2z" fill={fur} stroke={INK} strokeWidth=".85" />
        <path d="M12.6 15.8Q7 10.5 3.5 11.6m9.4 7.6Q8.6 16.5 3 16m9.9 5.3-5.1 4" fill="none" stroke="#e8d6f7" strokeWidth=".65" />
        <ellipse cx="6.9" cy="15.1" rx="2.2" ry="2.7" fill="#5f5289" transform="rotate(-25 6.9 15.1)" />
        <ellipse cx="6.9" cy="15.1" rx="1.3" ry="1.7" fill="#e9c887" />
        <circle cx="7.1" cy="14.8" r=".7" fill="#fff4cf" />
        <path className="pet-rig-mature" d="m5.2 23 1 .2m2-1.6.9.5" stroke="#f6dca8" strokeWidth=".8" strokeLinecap="round" />
      </g>
    </g>)}
    <g className="pet-rig-body" data-pet-part="body">
      <path d="M11.3 21q4.7-2 9.4 0l-.8 5q-3.9 5-7.8 0z" fill="#c7b6df" stroke={INK} strokeWidth=".9" />
      <path d="M13.4 25q2.6 1.5 5.2 0m-4.7 2q2.1 1.2 4.2 0" fill="none" stroke="#8b76aa" strokeWidth=".65" />
    </g>
    <g className="dg-pet-head pet-rig-head" data-part="head" data-pet-part="head" style={HEAD}>
      <g className="dg-pet-ear dg-pet-ear-left"><path d="M12 10Q8 6 9.3 2.6m-.1 2.1-2-1m2.2 2.8-2.2-.8m3.1 2.6-2.2-.4" fill="none" stroke="#65517d" strokeWidth=".8" strokeLinecap="round" /></g>
      <g className="dg-pet-ear dg-pet-ear-right"><path d="M20 10q4-4 2.7-7.4m.1 2.1 2-1m-2.2 2.8 2.2-.8m-3.1 2.6 2.2-.4" fill="none" stroke="#65517d" strokeWidth=".8" strokeLinecap="round" /></g>
      <path className="dg-pet-face" d="M16 8.2q8.1 0 8.4 7.7l1 1.4-1.6.8Q24 24 16 24t-7.8-5.9l-1.6-.8 1-1.4q.3-7.7 8.4-7.7z" fill="#f5edee" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      <path d="M9.7 12.4q6.3 3.3 12.6 0" fill="none" stroke="#e1d2e8" strokeWidth="1.4" />
      <Eyes iris="#9980c7" left={12.3} right={19.7} y={17} />
      <ellipse cx="10" cy="20.2" rx="1.4" ry=".7" fill="#e6a9bf" opacity=".55" /><ellipse cx="22" cy="20.2" rx="1.4" ry=".7" fill="#e6a9bf" opacity=".55" />
      <Smile y={21.7} nose={false} />
      <path className="dg-pet-accessory dg-pet-sig" d="M17.8 10.2q-3 .3-2.2-2.4-3.1 1.6-.9 3.6 2.1 1.3 3.1-1.2z" fill="#e7bd6b" stroke="#9c7646" strokeWidth=".35" />
      <PetExpression left={12.3} right={19.7} y={17} mouthY={21.7} ink={INK} />
    </g>
  </Art>;
}

export function Sable() {
  const id = "sable" + useId().replace(/\W/g, "");
  const fur = `url(#${id})`;
  return <Art defs={<Palette id={id} light="#f9f5f2" mid="#c5c3ce" dark="#9294a9" />}>
    <g className="dg-pet-tail" data-part="tail"><path d="M20.6 28.2c8.7 4.4 12.4-1.9 8.6-6.8-2-2.6-4.5-1.1-3.5 1.2q1.9 2.7-3 2.7" fill={fur} stroke={INK} strokeWidth=".95" /><path d="m25.5 28.8 1-2.4m2-2.6-2.1.2m.1-3.8-1.2 1.3" stroke="#6a687f" strokeWidth="1.2" /></g>
    <ellipse cx="15.5" cy="26" rx="7.2" ry="4.5" fill={fur} stroke={INK} strokeWidth="1" /><ellipse cx="15.5" cy="26.2" rx="3.8" ry="3.6" fill="#f9f3ed" />
    <ellipse cx="11.4" cy="29.1" rx="2.5" ry="1.5" fill="#f9f3ed" stroke={INK} strokeWidth=".7" /><ellipse cx="19.8" cy="29.1" rx="2.5" ry="1.5" fill="#f9f3ed" stroke={INK} strokeWidth=".7" />
    <g className="dg-pet-head" data-part="head" style={HEAD}>
      <g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left"><circle cx="7.6" cy="8.1" r="3.4" fill={fur} stroke={INK} strokeWidth="1" /><circle cx="7.6" cy="8.1" r="1.8" fill="#c59bad" /></g>
      <g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right"><circle cx="24.4" cy="8.1" r="3.4" fill={fur} stroke={INK} strokeWidth="1" /><circle cx="24.4" cy="8.1" r="1.8" fill="#c59bad" /></g>
      <path className="dg-pet-face" d="M16 7.4Q26 7.4 26 17l1.2 1.2-1.7 1Q24 25 16 25T6.5 19.2l-1.7-1L6 17q0-9.6 10-9.6z" fill={fur} stroke={INK} strokeWidth="1.05" />
      <g fill="none" stroke="#6a687f" strokeWidth=".85" strokeLinecap="round"><path d="M11.3 10.2q-2-.4-1.7 1.3m5.7-2.3q-1.6.8-.4 1.8m5.5-.8q1.7-.4 1.4 1.2M8.5 18.1l1 .8m12.9-.8-1 .8M8 14.2l.8.5m14.4-.5-.8.5" /></g>
      <ellipse cx="14" cy="21.2" rx="2.7" ry="2" fill="#fff7ee" /><ellipse cx="18" cy="21.2" rx="2.7" ry="2" fill="#fff7ee" />
      <Eyes iris="#85b5e8" y={16.2} /><Smile y={22.3} />
      <path d="M10.7 21 5 20m5.7 2.3L5.8 24M21.3 21l5.7-1m-5.7 2.3 4.9 1.7" stroke="#6a687f" strokeWidth=".5" strokeLinecap="round" />
      <PetExpression y={16.2} mouthY={22.3} ink={INK} />
    </g>
    <Scarf color="#a39acb" />
    <PetGesture fur="#c5c3ce" ink={INK} />
  </Art>;
}

// An octopus. Eight individually drawn arms; the two outside ones carry the
// shared wing hooks, so moods droop them and wave/flutter beats move them.
export function Inky() {
  const id = "inky" + useId().replace(/\W/g, "");
  const fur = `url(#${id})`;
  return <Art defs={<Palette id={id} light="#b8adff" mid="#8772d3" dark="#63529e" />}>
    <g className="dg-pet-new-arms" fill={fur} stroke={INK} strokeWidth=".8" strokeLinejoin="round">
      <path d="M10 22q-5-6-7-2-1 2 1.3 2.5.7-2.1 3.5 2z" />
      <path d="M22 22q5-6 7-2 1 2-1.3 2.5-.7-2.1-3.5 2z" />
      <g className="dg-pet-wing dg-pet-wing-left" data-part="wing-left"><path d="M10 23Q2 16 1.5 23q-.3 4.5 4.4 3.4 2.2-.5 1.2-2.3-2.9.5-2.2-1.2Q6 22 10 26z" /><path d="M4.2 24.6q.7 1.2 2 .4" fill="none" stroke="#f3bfd9" strokeWidth="1.2" strokeLinecap="round" /></g>
      <g className="dg-pet-wing dg-pet-wing-right" data-part="wing-right"><path d="M22 23q5-3.1 5.2-8.2-.2-2.3 2-1.4 3.2 2.1-.9 8.2-2.1 3.1-5.2 4.5z" /><path d="M29.1 16q-.1 2.8-2.7 5.9" fill="none" stroke="#f3bfd9" strokeWidth="1.5" strokeLinecap="round" /></g>
      <path d="M12 24q-7 1-7 4 0 2.8 4 2 2-.5.9-1.8-2.2.6-1.6-.4l4.7-1z" />
      <path d="M20 24q7 1 7 4 0 2.8-4 2-2-.5-.9-1.8 2.2.6 1.6-.4l-4.7-1z" />
      <path d="M14 24q-4 1.1-3 5.1.6 2.4 3.6 1.3 2-1-.2-1.6-1 .6-1-1l2.6-3z" />
      <path d="M18 24q4 1.1 3 5.1-.6 2.4-3.6 1.3-2-1 .2-1.6 1 .6 1-1l-2.6-3z" />
    </g>
    <g className="dg-pet-head" data-part="head" style={HEAD}>
      <path className="dg-pet-face" d="M16 7.4q9.6 0 9.2 9.6-.3 8.6-9.2 8.6T6.8 17Q6.4 7.4 16 7.4z" fill={fur} stroke={INK} strokeWidth="1.05" />
      <ellipse cx="12.3" cy="10.6" rx="3" ry="1.3" fill="#fff" opacity=".25" transform="rotate(-20 12.3 10.6)" />
      <g fill="#63529e" opacity=".55"><circle cx="8.5" cy="14.1" r=".8" /><circle cx="9.1" cy="12.3" r=".65" /><circle cx="23.4" cy="14.2" r=".7" /><circle cx="21.9" cy="11.5" r=".55" /></g>
      <Eyes iris="#7edbdc" y={16.5} />
      <g className="dg-pet-sig dg-pet-sig-new-cloud" fill="#eeabc9" opacity=".7"><ellipse cx="9.5" cy="20.2" rx="1.3" ry=".8" /><ellipse cx="22.5" cy="20.2" rx="1.3" ry=".8" /></g>
      <Smile y={22.5} nose={false} />
      <PetExpression y={16.5} mouthY={22.5} ink={INK} />
    </g>
    <g className="dg-pet-accessory"><path d="M11.1 24.6q4.9 1.4 9.8 0" fill="none" stroke="#61c6c3" strokeWidth="1.2" /><circle cx="16" cy="25.8" r=".65" fill="#f8d28c" /></g>
  </Art>;
}
