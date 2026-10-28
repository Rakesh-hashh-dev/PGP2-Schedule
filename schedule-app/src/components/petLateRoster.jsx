import PetGrowthDetail from "./PetGrowthDetail.jsx";
// The level 13-20 companions after Frost (2026-10-20): three cosy ones on the
// odd levels and two mythic ones on 18/20, replacing Sol and Eclipse (their
// saved keys map onto them, see RENAMED_PETS in lib/pet.js). Lv 16 is Sable,
// from petNewCollection.jsx.
//
// The cosy three are drawn to the roster brief — one quiet `.dg-pet-sig`
// loop each. The mythic three follow the premium brief Frost set: gradients,
// a full-body pose and staged flourishes in named classes (styles.css
// §Unicorn & Dragon), escalating to the Dragon finale.
//
// Same rules as every pet: flourishes never sit on a part that already moves
// (ear, tail, wing, face, eyes) — an element runs one animation — and anything
// that animates opacity is authored in its finished resting state, so the
// reduced-motion guard leaves a complete pet.
import { useId } from "react";
import PetEyes from "./PetEyes.jsx";
import PetExpression from "./PetExpression.jsx";
import PetDetail, { PetPaintDefs } from "./PetDetail.jsx";

const INK = "#292535";
// A four-point glint, drawn at the origin so a translate places it.
const GLINT = "M0-1.5.36-.36 1.5 0 .36.36 0 1.5-.36.36-1.5 0-.36-.36z";
const HEAD = { "--pet-head-x": "16px", "--pet-head-y": "24px" };

// ── Cosy ────────────────────────────────────────────────────────

// A golden hamster with a sunflower seed. The cheek pouches are the signature:
// they fill and empty, the way they do while the seed is "saved for later".
export function Hamster() {
  const id = "hm" + useId().replace(/\W/g, "");
  const coat = `url(#${id}-coat)`;
  return <svg className="pet-art pet-rig" viewBox="0 0 32 32" aria-hidden="true">
<defs><PetPaintDefs id={`${id}-coat`} light="#ffd9a0" coat="#f2ad5c" shade="#c97d36" /></defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body pet-rig-frame" data-part="body" data-pet-part="body">
    <ellipse cx="16" cy="25.9" rx="7.7" ry="4.8" fill={coat} stroke={INK} strokeWidth="1" />
    <ellipse cx="16" cy="26.8" rx="4.9" ry="3.4" fill="#fff1dc" />
    <g fill="#f6b8b0" stroke={INK} strokeWidth=".7"><ellipse cx="12" cy="29.7" rx="1.9" ry="1" /><ellipse cx="20" cy="29.7" rx="1.9" ry="1" /></g>
    {/* The seed, held up in both paws. */}
    <path d="M16 24.5c1.1.7 1.4 2 0 3.5-1.4-1.5-1.1-2.8 0-3.5z" fill="#3d3836" stroke={INK} strokeWidth=".5" />
    <path d="M16 24.9v2.6" stroke="#f4efe6" strokeWidth=".45" strokeLinecap="round" />
    <g fill="#f8c8bf" stroke={INK} strokeWidth=".6"><ellipse cx="14.5" cy="26.6" rx="1.15" ry=".9" /><ellipse cx="17.5" cy="26.6" rx="1.15" ry=".9" /></g>
    <g className="dg-pet-head pet-rig-head" data-part="head" style={HEAD} data-pet-part="head">
<PetGrowthDetail pet="hamster" />
<g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left">
        <ellipse cx="9.4" cy="9.5" rx="2.9" ry="2.7" fill={coat} stroke={INK} strokeWidth="1" />
        <ellipse cx="9.6" cy="9.8" rx="1.6" ry="1.4" fill="#f6b8b0" />
      </g>
<g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right">
        <ellipse cx="22.6" cy="9.5" rx="2.9" ry="2.7" fill={coat} stroke={INK} strokeWidth="1" />
        <ellipse cx="22.4" cy="9.8" rx="1.6" ry="1.4" fill="#f6b8b0" />
      </g>
<ellipse className="dg-pet-face" cx="16" cy="16.6" rx="9.8" ry="8.7" fill={coat} stroke={INK} strokeWidth="1.15" />
<path d="M16 11.4c3.8 0 7.2 2.5 7.2 6.4 0 3.5-3.1 6-7.2 6s-7.2-2.5-7.2-6c0-3.9 3.4-6.4 7.2-6.4z" fill="#fff1dc" />
<path d="M16 8q-1 2.1 0 4.2 1-2.1 0-4.2z" fill="#c97d36" />
<ellipse cx="11.6" cy="11.2" rx="2.8" ry="1.4" fill="#fff" opacity=".3" transform="rotate(-20 11.6 11.2)" />
      {/* Cheek pouches: the signature. */}
<g className="dg-pet-sig dg-pet-sig-hamster" fill="#ffe6d6" stroke="#e2ab8c" strokeWidth=".4">
        <ellipse cx="9.3" cy="19.4" rx="2.6" ry="2" /><ellipse cx="22.7" cy="19.4" rx="2.6" ry="2" />
      </g>
<g fill="#f59a9a" opacity=".45"><ellipse cx="9.4" cy="19.6" rx="1.4" ry=".8" /><ellipse cx="22.6" cy="19.6" rx="1.4" ry=".8" /></g>
<g className="pet-design-marking" data-design-marking="hamster"><path d="M8.5 20q.6 2.6 3.6 2.9m11.4-2.9q-.6 2.6-3.6 2.9" fill="none" stroke="#fce0ab" strokeWidth="1.2" strokeLinecap="round" /></g>
<PetEyes pet="hamster" left={12.4} right={19.6} y={15.9} rx={1.85} ry={2.05} ink={INK} iris="#5a3a24" />
<path d="M15.2 18.6h1.6L16 19.6z" fill="#e88a8a" stroke={INK} strokeWidth=".45" strokeLinejoin="round" />
<path className="dg-pet-mouth-base" d="M16 19.7v.5m0 0q-1 1-2 .3m2-.3q1 1 2 .3" fill="none" stroke={INK} strokeWidth=".75" strokeLinecap="round" />
<path d="M15.45 20.75h1.1v1h-1.1z" fill="#fff" stroke={INK} strokeWidth=".3" />
<path d="M11.4 18.8 8 18.2M11.4 19.6l-3.2.6M20.6 18.8l3.4-.6M20.6 19.6l3.2.6" stroke="#b8865a" strokeWidth=".35" strokeLinecap="round" opacity=".8" />
<PetExpression pet="hamster" rx={1.85} ry={2.05} left={12.4} right={19.6} y={15.9} mouthY={20.2} ink={INK} />
<PetDetail pet="hamster" />
</g>
    <g className="dg-pet-accessory">
      <path d="M10.6 23.4q5.4 1.8 10.8 0l.3 1.2q-5.7 1.9-11.4 0z" fill="#e8616b" stroke={INK} strokeWidth=".5" strokeLinejoin="round" />
      <circle cx="16" cy="25.2" r=".85" fill="#ffd34a" stroke={INK} strokeWidth=".4" />
    </g>
<PetDetail pet="hamster" layer="body" />
</g></g></svg>;
}

// A three-toed sloth with a sprig on its head. Everything about it is slow,
// and the signature is the slowest thing in the roster: the leaf barely sways.
export function Sloth() {
  const id = "sl" + useId().replace(/\W/g, "");
  const coat = `url(#${id}-coat)`;
  const patch = "#5b4636";
  return <svg className="pet-art pet-rig" viewBox="0 0 32 32" aria-hidden="true">
<defs><PetPaintDefs id={`${id}-coat`} light="#d6c5ad" coat="#b09a80" shade="#87705a" /></defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body pet-rig-frame" data-part="body" data-pet-part="body">
    <ellipse cx="16" cy="26" rx="7.4" ry="4.6" fill={coat} stroke={INK} strokeWidth="1" />
    <ellipse cx="16" cy="26.6" rx="4.2" ry="3.1" fill="#d9c8ae" />
    {/* Long arms draped down the front, three cream claws each. */}
    <path d="M10.4 22.4c-1.7 1.6-2.1 4.1-1.1 6.4l2.3.2c-.4-1.9 0-3.7 1.3-5z" fill={coat} stroke={INK} strokeWidth=".9" strokeLinejoin="round" />
    <path d="M21.6 22.4c1.7 1.6 2.1 4.1 1.1 6.4l-2.3.2c.4-1.9 0-3.7-1.3-5z" fill={coat} stroke={INK} strokeWidth=".9" strokeLinejoin="round" />
    <path d="M9.4 28.9q-.3.9.2 1.4M10.2 29.1q-.2.9.3 1.3M11.1 29q-.1.8.4 1.2M22.6 28.9q.3.9-.2 1.4M21.8 29.1q.2.9-.3 1.3M20.9 29q.1.8-.4 1.2" fill="none" stroke="#f3e6d0" strokeWidth=".55" strokeLinecap="round" />
    <g className="dg-pet-head pet-rig-head" data-part="head" style={HEAD} data-pet-part="head">
<PetGrowthDetail pet="sloth" />
<g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left"><ellipse cx="7.4" cy="14.2" rx="1.3" ry="1.1" fill={coat} stroke={INK} strokeWidth=".8" /></g>
<g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right"><ellipse cx="24.6" cy="14.2" rx="1.3" ry="1.1" fill={coat} stroke={INK} strokeWidth=".8" /></g>
<ellipse className="dg-pet-face" cx="16" cy="16.8" rx="9.4" ry="8.6" fill={coat} stroke={INK} strokeWidth="1.15" />
<path d="M16 10.6c4.4 0 8 2.8 8 6.8 0 3.8-3.6 6.6-8 6.6s-8-2.8-8-6.6c0-4 3.6-6.8 8-6.8z" fill="#f3e6d0" />
<path d="M12 10.3q1.3-1.3 2.4-.4.9-1.3 2.6-.6 1.3-.9 2.6.6" fill="none" stroke="#87705a" strokeWidth=".6" strokeLinecap="round" />
      {/* The mask: two dark bands sloping down and out, so it always smiles. */}
<path d="M9.2 18.6c.2-2.4 1.8-4 3.8-4.2 1.4-.1 2.2.9 2 2.2-.4 1.8-2.4 3.2-4.4 3.4-.9.1-1.4-.4-1.4-1.4z" fill={patch} />
<path d="M22.8 18.6c-.2-2.4-1.8-4-3.8-4.2-1.4-.1-2.2.9-2 2.2.4 1.8 2.4 3.2 4.4 3.4.9.1 1.4-.4 1.4-1.4z" fill={patch} />
<g className="pet-design-marking" data-design-marking="sloth"><path d="m13.4 9.1 1.1 1 1.5-.6 1.5.6 1.1-1" fill="none" stroke="#d7c4a0" strokeWidth="1.1" strokeLinecap="round" /></g>
<PetEyes pet="sloth" left={12.6} right={19.4} y={16.6} rx={1.45} ry={1.6} ink="#241a12" iris="#3b2a1e" />
<g fill="#e9a08f" opacity=".42"><ellipse cx="9.6" cy="20.8" rx="1.4" ry=".8" /><ellipse cx="22.4" cy="20.8" rx="1.4" ry=".8" /></g>
<ellipse cx="16" cy="19.8" rx="1.35" ry=".9" fill="#3a2a20" />
<circle cx="15.6" cy="19.5" r=".3" fill="#fff" opacity=".6" />
<path className="dg-pet-mouth-base" d="M13.6 21.4q2.4 1.8 4.8 0" fill="none" stroke={INK} strokeWidth=".8" strokeLinecap="round" />
<g className="dg-pet-sig dg-pet-sig-sloth">
        <path d="M16.3 8.4c.4-2 2-3.4 4-3.4-.2 2-1.8 3.4-4 3.4z" fill="#7cc46a" stroke={INK} strokeWidth=".5" strokeLinejoin="round" />
        <path d="M16.3 8.4q1.6-1.4 3.2-2.6" fill="none" stroke="#4e9a48" strokeWidth=".35" strokeLinecap="round" />
      </g>
<PetExpression pet="sloth" rx={1.45} ry={1.6} left={12.6} right={19.4} y={16.6} mouthY={21.6} ink={INK} />
<PetDetail pet="sloth" />
</g>
    <g className="dg-pet-accessory">
      <path d="M10.8 23.3q5.2 1.8 10.4 0l.3 1.2q-5.5 1.9-11 0z" fill="#5fae5a" stroke={INK} strokeWidth=".5" strokeLinejoin="round" />
      <path d="M15.2 24.6c-.9-.9-.8-2 .2-2.6.3 1 .2 1.8-.2 2.6zM16.8 24.6c.9-.9.8-2-.2-2.6-.3 1-.2 1.8.2 2.6z" fill="#8fd47b" stroke={INK} strokeWidth=".35" />
    </g>
<PetDetail pet="sloth" layer="body" />
</g></g></svg>;
}

// A capybara with a yuzu at its feet. The calmest animal on the roster, and
// the signature is the yuzu rocking, not the capybara — it cannot be bothered.
export function Capy() {
  const id = "cp" + useId().replace(/\W/g, "");
  const coat = `url(#${id}-coat)`;
  return <svg className="pet-art pet-rig" viewBox="0 0 32 32" aria-hidden="true">
<defs><PetPaintDefs id={`${id}-coat`} light="#e8c294" coat="#c99a66" shade="#9c6f45" /></defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body pet-rig-frame" data-part="body" data-pet-part="body">
    <ellipse cx="15.6" cy="26.2" rx="7.8" ry="4.4" fill={coat} stroke={INK} strokeWidth="1" />
    <g fill="#6e4a2e" stroke={INK} strokeWidth=".7"><rect x="10" y="28.6" width="3.4" height="1.9" rx=".9" /><rect x="17.6" y="28.6" width="3.4" height="1.9" rx=".9" /></g>
    <g className="dg-pet-sig dg-pet-sig-capy">
      <circle cx="26.2" cy="28.2" r="2.3" fill="#ffb238" stroke={INK} strokeWidth=".7" />
      <path d="M26.2 25.9q.3-.9 1.2-1.2" fill="none" stroke="#4e8a3c" strokeWidth=".55" strokeLinecap="round" />
      <path d="M26.8 25.8c.6-.9 1.7-1.2 2.6-.8-.6.9-1.6 1.2-2.6.8z" fill="#6cbf4f" stroke={INK} strokeWidth=".3" />
      <circle cx="25.4" cy="27.4" r=".55" fill="#fff" opacity=".6" />
    </g>
    <g className="dg-pet-head pet-rig-head" data-part="head" style={HEAD} data-pet-part="head">
<PetGrowthDetail pet="capy" />
<g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left">
        <path d="M9.4 10.4c-.7-1.5 0-3 1.5-3.2 1.3-.2 2.3.9 2.1 2.1z" fill={coat} stroke={INK} strokeWidth=".9" strokeLinejoin="round" />
        <path d="M10.3 9.6c-.2-.7.2-1.3.8-1.4" fill="none" stroke="#6e4a2e" strokeWidth=".6" strokeLinecap="round" />
      </g>
<g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right">
        <path d="M22.6 10.4c.7-1.5 0-3-1.5-3.2-1.3-.2-2.3.9-2.1 2.1z" fill={coat} stroke={INK} strokeWidth=".9" strokeLinejoin="round" />
        <path d="M21.7 9.6c.2-.7-.2-1.3-.8-1.4" fill="none" stroke="#6e4a2e" strokeWidth=".6" strokeLinecap="round" />
      </g>
<rect className="dg-pet-face" x="6.6" y="8" width="18.8" height="16.6" rx="7.2" fill={coat} stroke={INK} strokeWidth="1.15" />
<ellipse cx="11.4" cy="10.8" rx="2.8" ry="1.3" fill="#fff" opacity=".24" transform="rotate(-14 11.4 10.8)" />
      {/* The long muzzle and that broad, dark nose bridge. */}
<path d="M9.4 18.4c0-2 3-3 6.6-3s6.6 1 6.6 3v1.6c0 2.6-3 4-6.6 4s-6.6-1.4-6.6-4z" fill="#ddb583" stroke="#a87449" strokeWidth=".4" />
<g fill="#4a3324"><ellipse cx="13.8" cy="18.6" rx=".75" ry=".5" /><ellipse cx="18.2" cy="18.6" rx=".75" ry=".5" /></g>

<g className="pet-design-marking" data-design-marking="capy"><path d="M11 20.1q5-1.6 10 0" fill="none" stroke="#c89765" strokeWidth="1" strokeLinecap="round" /></g>
<PetEyes pet="capy" left={11.8} right={20.2} y={14.4} rx={1.55} ry={1.5} ink={INK} iris="#2e1f15" />
<path d="M10 13q1.8-.9 3.6 0M18.4 13q1.8-.9 3.6 0" fill="none" stroke="#6e4a2e" strokeWidth=".55" strokeLinecap="round" opacity=".8" />
<g fill="#e9997f" opacity=".38"><ellipse cx="8.8" cy="18.2" rx="1.3" ry=".75" /><ellipse cx="23.2" cy="18.2" rx="1.3" ry=".75" /></g>
<path className="dg-pet-mouth-base" d="M16 20.2v.8m0 0q-1.2.9-2.2.4m2.2-.4q1.2.9 2.2.4" fill="none" stroke={INK} strokeWidth=".75" strokeLinecap="round" />
<PetExpression pet="capy" rx={1.55} ry={1.5} left={11.8} right={20.2} y={14.4} mouthY={21} ink={INK} />
<PetDetail pet="capy" />
</g>
    <g className="dg-pet-accessory">
      <path d="M10.6 23.8q5.4 1.6 10.8 0l-1.1 1.4q-4.3 1.3-8.6 0z" fill="#4fb3a9" stroke={INK} strokeWidth=".5" strokeLinejoin="round" />
      <path d="M14.3 24.9h3.4L16 27z" fill="#4fb3a9" stroke={INK} strokeWidth=".45" strokeLinejoin="round" />
    </g>
<PetDetail pet="capy" layer="body" />
</g></g></svg>;
}

// ── Mythic ──────────────────────────────────────────────────────

// A unicorn: white coat, pastel rainbow mane and tail, a spiral gold horn.
// A rainbow breathes behind it and stars rise off it; the horn catches a glint.
export function Unicorn() {
  const id = "un" + useId().replace(/\W/g, "");
  const ink = "#3b2d5c";
  const coat = `url(#${id}-coat)`;
  const horn = `url(#${id}-horn)`;
  return (
    <svg className="pet-art pet-rig" viewBox="0 0 32 32" aria-hidden="true"><defs>
        <radialGradient id={`${id}-coat`} cx="42%" cy="32%" r="76%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".62" stopColor="#f1efff" />
          <stop offset="1" stopColor="#d3d2f2" />
        </radialGradient>
        <linearGradient id={`${id}-horn`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f0b83c" />
          <stop offset=".6" stopColor="#ffd978" />
          <stop offset="1" stopColor="#fff4c8" />
        </linearGradient>
      </defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body pet-rig-frame" data-part="body" data-pet-part="body">

      {/* A soft rainbow behind the head that brightens and fades. */}
      <g className="dg-pet-rainbow" fill="none" strokeLinecap="round" opacity=".55">
        <path d="M2.6 20.4a13.4 13.4 0 0 1 26.8 0" stroke="#ff9ec7" strokeWidth="1.1" />
        <path d="M4 20.4a12 12 0 0 1 24 0" stroke="#ffd08a" strokeWidth="1.1" />
        <path d="M5.4 20.4a10.6 10.6 0 0 1 21.2 0" stroke="#8fe3c4" strokeWidth="1.1" />
        <path d="M6.8 20.4a9.2 9.2 0 0 1 18.4 0" stroke="#9ac8ff" strokeWidth="1.1" />
      </g>

      {/* Stars rising off the coat. */}
      <g fill="#ffe6a6" stroke="#d9a63a" strokeWidth=".25">
        <g transform="translate(4.4 24.6)"><path className="dg-pet-sparkle" d={GLINT} /></g>
        <g transform="translate(27.8 21.4) scale(.8)"><path className="dg-pet-sparkle dg-pet-sparkle-b" d={GLINT} /></g>
        <g transform="translate(26 5.6) scale(.7)"><path className="dg-pet-sparkle dg-pet-sparkle-c" d={GLINT} /></g>
      </g>

      {/* Rainbow tail, three strands. */}
      <g className="dg-pet-tail pet-rig-tail" data-part="tail" fill="none" strokeLinecap="round" data-pet-part="tail">
        <path d="M21 27.4c3.2 1 6-.4 6.8-3.4.4-1.6 1.5-2.6 2.8-2.8" stroke="#f77fb5" strokeWidth="1.6" />
        <path d="M21.2 28.3c3.6.6 6.6-1 7.4-3.8" stroke="#46c9a2" strokeWidth="1.5" />
        <path d="M21.4 29.1c3.4.4 6.2-.8 7.4-2.8" stroke="#5aa9f0" strokeWidth="1.4" />
      </g>

      <ellipse cx="16" cy="26.6" rx="7" ry="4.2" fill={coat} stroke={ink} strokeWidth="1" />
      <ellipse cx="12.2" cy="29.2" rx="2.3" ry="1.35" fill={coat} stroke={ink} strokeWidth=".75" />
      <ellipse cx="19.8" cy="29.2" rx="2.3" ry="1.35" fill={coat} stroke={ink} strokeWidth=".75" />
      <path d="M10.3 29.7q1.9 1.3 3.8 0M17.9 29.7q1.9 1.3 3.8 0" fill="none" stroke="#b996ff" strokeWidth=".8" strokeLinecap="round" />

      {/* The mane: a pink and mint sweep down the left of the neck, one lilac lock right. */}
      <path d="M10.4 9.2C6.6 10 4.4 13.4 4.8 17.2c-.9.6-1.8.8-2.8.6.8 1.5 2.1 2.3 3.6 2.4-.4 1-1 1.7-1.9 2.1 1.9.6 3.9.2 5.3-1.1z" fill="#ffadd2" stroke={ink} strokeWidth=".6" strokeLinejoin="round" />
      <path d="M10.6 10.6c-2.6 1-4.2 3.6-4 6.6.2 1.6 1 3 2.2 3.8.8-.4 1.4-1 1.8-1.8z" fill="#9ce8cb" />
      <path d="M21.6 9.4c2.2.6 3.8 2.2 4.4 4.4-.9-.4-1.8-.4-2.6 0z" fill="#cdb2ff" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />

      <g className="dg-pet-head pet-rig-head" data-part="head" style={HEAD} data-pet-part="head">
<PetGrowthDetail pet="unicorn" />
<g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left">
        <path d="M11.2 9.8 9.2 3.6Q12.8 5 13.6 8.8z" fill={coat} stroke={ink} strokeWidth=".9" strokeLinejoin="round" />
        <path d="M11.4 9 10.2 5.2q2 1 2.4 3.2z" fill="#ffc5de" />
      </g>
<g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right">
        <path d="M20.8 9.8 22.8 3.6Q19.2 5 18.4 8.8z" fill={coat} stroke={ink} strokeWidth=".9" strokeLinejoin="round" />
        <path d="M20.6 9 21.8 5.2q-2 1-2.4 3.2z" fill="#ffc5de" />
      </g>
<ellipse className="dg-pet-face" cx="16" cy="16.9" rx="9.3" ry="9.1" fill={coat} stroke={ink} strokeWidth="1.15" />
<ellipse cx="12" cy="11.8" rx="3" ry="1.6" fill="#fff" opacity=".6" transform="rotate(-20 12 11.8)" />
      {/* Spiral horn, then the forelock over its base. */}
<path d="M15 8.9 16.3 1.4 17.6 8.9z" fill={horn} stroke="#8a5c12" strokeWidth=".5" strokeLinejoin="round" />
<path d="M15.3 7.6l2-.8M15.6 5.8l1.6-.6M15.9 4l1.2-.5" fill="none" stroke="#c7932a" strokeWidth=".4" strokeLinecap="round" />
<g transform="translate(16.6 2.6) scale(.7)"><path className="dg-pet-glint" d={GLINT} fill="#fff" /></g>
<path d="M12.6 9.4c1.2-1.4 3.4-1.8 5-.8-1.2.2-2 .9-2.4 1.8 1.4-.4 2.8 0 3.6 1-1.8-.2-3.4.3-4.6 1.4-.2-1.4-.8-2.4-1.6-3.4z" fill="#9ac8ff" stroke={ink} strokeWidth=".45" strokeLinejoin="round" />
<g className="pet-design-marking" data-design-marking="unicorn"><path d="M8.4 10.4q1.3 1.3 1.2 3m12.8-3q-1.3 1.3-1.2 3" fill="none" stroke="#e0b5e8" strokeWidth="1.1" strokeLinecap="round" /></g>
<PetEyes pet="unicorn" left={12.3} right={19.7} y={16.3} rx={2.05} ry={2.3} ink={ink} iris="#9a7cf0" />
<path d="M10.2 14.7 9.2 14.1M21.8 14.7l1-.6" fill="none" stroke={ink} strokeWidth=".6" strokeLinecap="round" />
<g fill="#ff9ec7" opacity=".45"><ellipse cx="9.2" cy="19.6" rx="1.5" ry=".9" /><ellipse cx="22.8" cy="19.6" rx="1.5" ry=".9" /></g>
<ellipse cx="16" cy="21" rx="3.9" ry="2.6" fill="#fde9f3" />
<circle cx="15" cy="20.4" r=".32" fill={ink} opacity=".6" />
<circle cx="17" cy="20.4" r=".32" fill={ink} opacity=".6" />
<path className="dg-pet-mouth-base" d="M14.4 22.2q1.6 1.3 3.2 0" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />
<PetExpression pet="unicorn" rx={2.05} ry={2.3} left={12.3} right={19.7} y={16.3} mouthY={22.1} ink={ink} />
<PetDetail pet="unicorn" />
</g>

      {/* A daisy chain. */}
      <g className="dg-pet-accessory" stroke={ink} strokeWidth=".3">
        <path d="M10.4 24.4c3.6 1.5 7.6 1.5 11.2 0" fill="none" stroke="#7cc46a" strokeWidth=".6" />
        <circle cx="11.6" cy="25" r=".8" fill="#fff" /><circle cx="13.9" cy="25.6" r=".8" fill="#ffd1e6" />
        <circle cx="16" cy="25.9" r="1" fill="#fff" /><circle cx="18.1" cy="25.6" r=".8" fill="#d8ccff" />
        <circle cx="20.4" cy="25" r=".8" fill="#fff" />
        <circle cx="16" cy="25.9" r=".38" fill="#ffd34a" stroke="none" />
      </g>

<PetDetail pet="unicorn" layer="body" />
</g></g></svg>
  );
}

// A jade guardian: swept horns, folded bat wings and a broad dragon muzzle.
// The stable dragon key and existing part classes preserve progression/behaviour.
export function Dragon() {
  const id = "dr" + useId().replace(/\W/g, "");
  const ink = "#173b35";
  const scale = `url(#${id}-scale)`;
  const gold = `url(#${id}-gold)`;
  return <svg className="pet-art pet-rig" viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <radialGradient id={`${id}-scale`} cx="34%" cy="22%" r="88%"><stop offset="0" stopColor="#86d9b3" /><stop offset=".55" stopColor="#36a582" /><stop offset="1" stopColor="#236857" /></radialGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0bf" /><stop offset=".6" stopColor="#e5bb73" /><stop offset="1" stopColor="#b77e43" /></linearGradient>
      <radialGradient id={`${id}-aura`}><stop offset="0" stopColor="#d8c18b" stopOpacity=".18" /><stop offset="1" stopColor="#d8c18b" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
    <g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)"><g className="dg-pet-body pet-rig-frame" data-part="body" data-pet-part="body">
      <circle className="dg-pet-dragonaura" cx="16" cy="18" r="13.5" fill={`url(#${id}-aura)`} />
      <g className="dg-pet-tail pet-rig-tail" data-part="tail" data-pet-part="tail">
        <path d="M21 28.2q8.8 3.7 8-3.8-.4-2.7-2.5-3.7" fill="none" stroke={ink} strokeWidth="3.7" strokeLinecap="round" />
        <path d="M21 28.2q8.8 3.7 8-3.8-.4-2.7-2.5-3.7" fill="none" stroke="#38997b" strokeWidth="2.1" strokeLinecap="round" />
        <path d="m26.5 22 1.1-3-3.4.6z" fill={gold} stroke={ink} strokeWidth=".65" strokeLinejoin="round" />
        <path className="pet-design-fine" d="m24.6 28.7.2-1.1m2.6-.2-.8-.8" stroke="#9bd4ad" strokeWidth=".55" />
      </g>
      <g className="dg-pet-wing dg-pet-wing-left pet-rig-wing-left" data-part="wing-left" data-pet-part="wing">
        <path d="M11 26.5q-2.7-3.1-5.6-.7.4-3.7-2.6-3.6 1-4.3-.7-10 4.6 1.1 8.1 5.4z" fill="#327665" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
        <path d="M9.6 24q-1.7-1.4-3.2-.5-.4-2.9-2.4-2.5.6-2.6-.9-7l2.5 1.3q3.3 2.8 4 8.7z" fill="#d5ba89" />
        <path d="m3.1 14 6.5 9.1M5.6 20.2l4 2.9" fill="none" stroke="#8b7759" strokeWidth=".55" />
      </g>
      <g className="dg-pet-wing dg-pet-wing-right pet-rig-wing-right" data-part="wing-right" data-pet-part="wing">
        <path d="M21 26.5q2.7-3.1 5.6-.7-.4-3.7 2.6-3.6-1-4.3.7-10-4.6 1.1-8.1 5.4z" fill="#327665" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
        <path d="M22.4 24q1.7-1.4 3.2-.5.4-2.9 2.4-2.5-.6-2.6.9-7l-2.5 1.3q-3.3 2.8-4 8.7z" fill="#d5ba89" />
        <path d="m28.9 14-6.5 9.1m4-2.9-4 2.9" fill="none" stroke="#8b7759" strokeWidth=".55" />
      </g>
      <path d="M10.8 20.8q5.2-2.7 10.4 0l1.9 6.3q-.5 3-7.1 3t-7.1-3z" fill={scale} stroke={ink} strokeWidth="1" />
      <path d="M12.4 23.1q3.6-1.4 7.2 0l-.5 5q-3.1 1.7-6.2 0z" fill={gold} stroke="#9b7748" strokeWidth=".45" />
      <path d="M12.7 25q3.3 1.1 6.6 0m-6.4 1.7q3.1 1 6.2 0" fill="none" stroke="#b28a53" strokeWidth=".55" />
      <g fill="#3c9577" stroke={ink} strokeWidth=".75"><path d="M9.9 27q3-1 3.6 1.7.3 1.6-2.8 1.6-3.3-.1-2.7-1.8z" /><path d="M22.1 27q-3-1-3.6 1.7-.3 1.6 2.8 1.6 3.3-.1 2.7-1.8z" /></g>
      <path d="m9 29.5.5-.8.5.8m1 0 .5-.8.5.8m8 0 .5-.8.5.8m1 0 .5-.8.5.8" fill="#f2e5c5" stroke={ink} strokeWidth=".25" />
      <g className="dg-pet-head pet-rig-head" data-part="head" data-pet-part="head" style={HEAD}>
        <g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left"><path d="M11.2 9.4Q7.1 6.9 9.2 2.2q.1 3.6 3.4 4.7z" fill={gold} stroke={ink} strokeWidth=".9" /><path d="m9 5.7 1.8-.3m-1.2 1.5 1.8-.3" fill="none" stroke="#b78951" strokeWidth=".55" /></g>
        <g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right"><path d="M20.8 9.4q4.1-2.5 2-7.2-.1 3.6-3.4 4.7z" fill={gold} stroke={ink} strokeWidth=".9" /><path d="m23 5.7-1.8-.3m1.2 1.5-1.8-.3" fill="none" stroke="#b78951" strokeWidth=".55" /></g>
        <path d="m8.3 12-4.9-1.7 1.1 6.2 3.1 1.1m16.1-5.6 4.9-1.7-1.1 6.2-3.1 1.1" fill="#5ab795" stroke={ink} strokeWidth=".8" strokeLinejoin="round" />
        <path className="dg-pet-face" d="M12 7.4h8q5.2.8 5.3 7l-.4 5.1Q23.6 25 16 25t-8.9-5.5l-.4-5.1q.1-6.2 5.3-7z" fill={scale} stroke={ink} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="m16 8.5-2 3.1 2-.7 2 .7z" fill="#a6dab2" />
        <path d="M10.2 12.4q2-.8 4 .2m3.6 0q2-1 4-.2" fill="none" stroke="#257b60" strokeWidth="1.1" strokeLinecap="round" />
        <PetGrowthDetail pet="dragon" />
        <PetEyes pet="dragon" left={12} right={20} y={15.9} rx={1.8} ry={2.05} ink={ink} iris="#e6b76b" />
        <path d="M11.5 18.4q4.5-1.4 9 0l1.4 2q.6 3.6-5.9 3.7-6.5-.1-5.9-3.7z" fill="#c0dcb4" stroke="#3c8067" strokeWidth=".55" />
        <g fill={ink}><ellipse cx="13.3" cy="20.1" rx=".65" ry=".45" transform="rotate(-18 13.3 20.1)" /><ellipse cx="18.7" cy="20.1" rx=".65" ry=".45" transform="rotate(18 18.7 20.1)" /></g>
        <path className="dg-pet-mouth-base" d="M13.4 22.4q2.6 1.6 5.2 0" fill="none" stroke={ink} strokeWidth=".7" strokeLinecap="round" />
        <g fill="#edf1e3" stroke="#b1c4b3" strokeWidth=".3"><g className="dg-pet-breath" opacity="0"><circle cx="12" cy="20.4" r=".9" /><circle cx="10.6" cy="19.8" r="1.1" /></g><g className="dg-pet-breath dg-pet-breath-b" opacity="0"><circle cx="20" cy="20.4" r=".9" /><circle cx="21.4" cy="19.8" r="1.1" /></g></g>
        <PetExpression pet="dragon" rx={1.8} ry={2.05} left={12} right={20} y={15.9} mouthY={22.4} ink={ink} />
        <PetDetail pet="dragon" />
      </g>
      <g className="dg-pet-accessory"><path d="M10.8 24.6q5.2 1.5 10.4 0l.2 1.1q-5.4 1.6-10.8 0z" fill="#b8874c" stroke={ink} strokeWidth=".5" /><path d="m16 25.5 1.1 1.3-1.1 1.4-1.1-1.4z" fill="#d78951" stroke={ink} strokeWidth=".4" /></g>
      <PetDetail pet="dragon" layer="body" />
    </g></g>
  </svg>;
}
