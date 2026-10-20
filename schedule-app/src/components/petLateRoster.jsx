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
  return <svg className="pet-art" viewBox="0 0 32 32" aria-hidden="true">
<defs><PetPaintDefs id={`${id}-coat`} light="#ffd9a0" coat="#f2ad5c" shade="#c97d36" /></defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body" data-part="body">
    <ellipse cx="16" cy="25.9" rx="7.7" ry="4.8" fill={coat} stroke={INK} strokeWidth="1" />
    <ellipse cx="16" cy="26.8" rx="4.9" ry="3.4" fill="#fff1dc" />
    <g fill="#f6b8b0" stroke={INK} strokeWidth=".7"><ellipse cx="12" cy="29.7" rx="1.9" ry="1" /><ellipse cx="20" cy="29.7" rx="1.9" ry="1" /></g>
    {/* The seed, held up in both paws. */}
    <path d="M16 24.5c1.1.7 1.4 2 0 3.5-1.4-1.5-1.1-2.8 0-3.5z" fill="#3d3836" stroke={INK} strokeWidth=".5" />
    <path d="M16 24.9v2.6" stroke="#f4efe6" strokeWidth=".45" strokeLinecap="round" />
    <g fill="#f8c8bf" stroke={INK} strokeWidth=".6"><ellipse cx="14.5" cy="26.6" rx="1.15" ry=".9" /><ellipse cx="17.5" cy="26.6" rx="1.15" ry=".9" /></g>
    <g className="dg-pet-head" data-part="head" style={HEAD}>
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
<PetEyes left={12.4} right={19.6} y={15.9} rx={1.85} ry={2.05} ink={INK} iris="#5a3a24" />
<path d="M15.2 18.6h1.6L16 19.6z" fill="#e88a8a" stroke={INK} strokeWidth=".45" strokeLinejoin="round" />
<path className="dg-pet-mouth-base" d="M16 19.7v.5m0 0q-1 1-2 .3m2-.3q1 1 2 .3" fill="none" stroke={INK} strokeWidth=".75" strokeLinecap="round" />
<path d="M15.45 20.75h1.1v1h-1.1z" fill="#fff" stroke={INK} strokeWidth=".3" />
<path d="M11.4 18.8 8 18.2M11.4 19.6l-3.2.6M20.6 18.8l3.4-.6M20.6 19.6l3.2.6" stroke="#b8865a" strokeWidth=".35" strokeLinecap="round" opacity=".8" />
<PetExpression left={12.4} right={19.6} y={15.9} mouthY={20.2} ink={INK} />
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
  return <svg className="pet-art" viewBox="0 0 32 32" aria-hidden="true">
<defs><PetPaintDefs id={`${id}-coat`} light="#d6c5ad" coat="#b09a80" shade="#87705a" /></defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body" data-part="body">
    <ellipse cx="16" cy="26" rx="7.4" ry="4.6" fill={coat} stroke={INK} strokeWidth="1" />
    <ellipse cx="16" cy="26.6" rx="4.2" ry="3.1" fill="#d9c8ae" />
    {/* Long arms draped down the front, three cream claws each. */}
    <path d="M10.4 22.4c-1.7 1.6-2.1 4.1-1.1 6.4l2.3.2c-.4-1.9 0-3.7 1.3-5z" fill={coat} stroke={INK} strokeWidth=".9" strokeLinejoin="round" />
    <path d="M21.6 22.4c1.7 1.6 2.1 4.1 1.1 6.4l-2.3.2c.4-1.9 0-3.7-1.3-5z" fill={coat} stroke={INK} strokeWidth=".9" strokeLinejoin="round" />
    <path d="M9.4 28.9q-.3.9.2 1.4M10.2 29.1q-.2.9.3 1.3M11.1 29q-.1.8.4 1.2M22.6 28.9q.3.9-.2 1.4M21.8 29.1q.2.9-.3 1.3M20.9 29q.1.8-.4 1.2" fill="none" stroke="#f3e6d0" strokeWidth=".55" strokeLinecap="round" />
    <g className="dg-pet-head" data-part="head" style={HEAD}>
<g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left"><ellipse cx="7.4" cy="14.2" rx="1.3" ry="1.1" fill={coat} stroke={INK} strokeWidth=".8" /></g>
<g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right"><ellipse cx="24.6" cy="14.2" rx="1.3" ry="1.1" fill={coat} stroke={INK} strokeWidth=".8" /></g>
<ellipse className="dg-pet-face" cx="16" cy="16.8" rx="9.4" ry="8.6" fill={coat} stroke={INK} strokeWidth="1.15" />
<path d="M16 10.6c4.4 0 8 2.8 8 6.8 0 3.8-3.6 6.6-8 6.6s-8-2.8-8-6.6c0-4 3.6-6.8 8-6.8z" fill="#f3e6d0" />
<path d="M12 10.3q1.3-1.3 2.4-.4.9-1.3 2.6-.6 1.3-.9 2.6.6" fill="none" stroke="#87705a" strokeWidth=".6" strokeLinecap="round" />
      {/* The mask: two dark bands sloping down and out, so it always smiles. */}
<path d="M9.2 18.6c.2-2.4 1.8-4 3.8-4.2 1.4-.1 2.2.9 2 2.2-.4 1.8-2.4 3.2-4.4 3.4-.9.1-1.4-.4-1.4-1.4z" fill={patch} />
<path d="M22.8 18.6c-.2-2.4-1.8-4-3.8-4.2-1.4-.1-2.2.9-2 2.2.4 1.8 2.4 3.2 4.4 3.4.9.1 1.4-.4 1.4-1.4z" fill={patch} />
<PetEyes left={12.6} right={19.4} y={16.6} rx={1.45} ry={1.6} ink="#241a12" iris="#3b2a1e" />
<g fill="#e9a08f" opacity=".42"><ellipse cx="9.6" cy="20.8" rx="1.4" ry=".8" /><ellipse cx="22.4" cy="20.8" rx="1.4" ry=".8" /></g>
<ellipse cx="16" cy="19.8" rx="1.35" ry=".9" fill="#3a2a20" />
<circle cx="15.6" cy="19.5" r=".3" fill="#fff" opacity=".6" />
<path className="dg-pet-mouth-base" d="M13.6 21.4q2.4 1.8 4.8 0" fill="none" stroke={INK} strokeWidth=".8" strokeLinecap="round" />
<g className="dg-pet-sig dg-pet-sig-sloth">
        <path d="M16.3 8.4c.4-2 2-3.4 4-3.4-.2 2-1.8 3.4-4 3.4z" fill="#7cc46a" stroke={INK} strokeWidth=".5" strokeLinejoin="round" />
        <path d="M16.3 8.4q1.6-1.4 3.2-2.6" fill="none" stroke="#4e9a48" strokeWidth=".35" strokeLinecap="round" />
      </g>
<PetExpression left={12.6} right={19.4} y={16.6} mouthY={21.6} ink={INK} />
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
  return <svg className="pet-art" viewBox="0 0 32 32" aria-hidden="true">
<defs><PetPaintDefs id={`${id}-coat`} light="#e8c294" coat="#c99a66" shade="#9c6f45" /></defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body" data-part="body">
    <ellipse cx="15.6" cy="26.2" rx="7.8" ry="4.4" fill={coat} stroke={INK} strokeWidth="1" />
    <g fill="#6e4a2e" stroke={INK} strokeWidth=".7"><rect x="10" y="28.6" width="3.4" height="1.9" rx=".9" /><rect x="17.6" y="28.6" width="3.4" height="1.9" rx=".9" /></g>
    <g className="dg-pet-sig dg-pet-sig-capy">
      <circle cx="26.2" cy="28.2" r="2.3" fill="#ffb238" stroke={INK} strokeWidth=".7" />
      <path d="M26.2 25.9q.3-.9 1.2-1.2" fill="none" stroke="#4e8a3c" strokeWidth=".55" strokeLinecap="round" />
      <path d="M26.8 25.8c.6-.9 1.7-1.2 2.6-.8-.6.9-1.6 1.2-2.6.8z" fill="#6cbf4f" stroke={INK} strokeWidth=".3" />
      <circle cx="25.4" cy="27.4" r=".55" fill="#fff" opacity=".6" />
    </g>
    <g className="dg-pet-head" data-part="head" style={HEAD}>
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
<path d="M12.8 17.9q3.2-1.4 6.4 0-.5 1.8-3.2 2-2.7-.2-3.2-2z" fill="#4a3324" />
<path d="M14.2 17.8q.8-.3 1.4 0" fill="none" stroke="#fff" strokeWidth=".35" strokeLinecap="round" opacity=".45" />
<PetEyes left={11.8} right={20.2} y={14.4} rx={1.55} ry={1.5} ink={INK} iris="#2e1f15" />
<path d="M10 13q1.8-.9 3.6 0M18.4 13q1.8-.9 3.6 0" fill="none" stroke="#6e4a2e" strokeWidth=".55" strokeLinecap="round" opacity=".8" />
<g fill="#e9997f" opacity=".38"><ellipse cx="8.8" cy="18.2" rx="1.3" ry=".75" /><ellipse cx="23.2" cy="18.2" rx="1.3" ry=".75" /></g>
<path className="dg-pet-mouth-base" d="M16 20.2v.8m0 0q-1.2.9-2.2.4m2.2-.4q1.2.9 2.2.4" fill="none" stroke={INK} strokeWidth=".75" strokeLinecap="round" />
<PetExpression left={11.8} right={20.2} y={14.4} mouthY={21} ink={INK} />
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
    <svg className="pet-art" viewBox="0 0 32 32" aria-hidden="true"><defs>
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
<g className="dg-pet-body" data-part="body">

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
      <g className="dg-pet-tail" data-part="tail" fill="none" strokeLinecap="round">
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

      <g className="dg-pet-head" data-part="head" style={HEAD}>
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
<PetEyes left={12.3} right={19.7} y={16.3} rx={2.05} ry={2.3} ink={ink} iris="#9a7cf0" />
<path d="M10.2 14.7 9.2 14.1M21.8 14.7l1-.6" fill="none" stroke={ink} strokeWidth=".6" strokeLinecap="round" />
<g fill="#ff9ec7" opacity=".45"><ellipse cx="9.2" cy="19.6" rx="1.5" ry=".9" /><ellipse cx="22.8" cy="19.6" rx="1.5" ry=".9" /></g>
<ellipse cx="16" cy="21" rx="3.9" ry="2.6" fill="#fde9f3" />
<circle cx="15" cy="20.4" r=".32" fill={ink} opacity=".6" />
<circle cx="17" cy="20.4" r=".32" fill={ink} opacity=".6" />
<path className="dg-pet-mouth-base" d="M14.4 22.2q1.6 1.3 3.2 0" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />
<PetExpression left={12.3} right={19.7} y={16.3} mouthY={22.1} ink={ink} />
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

// A jade dragon, the level 20 finale and the loudest thing in the roster on
// purpose: an aura that breathes, a ring of gold runes that turns, embers
// rising, smoke from the nostrils and a little hoard that catches the light.
export function Dragon() {
  const id = "dr" + useId().replace(/\W/g, "");
  const ink = "#0b2e22";
  const scale = `url(#${id}-scale)`;
  const gold = `url(#${id}-gold)`;
  const wingL = `url(#${id}-wingl)`;
  const wingR = `url(#${id}-wingr)`;
  return (
    <svg className="pet-art" viewBox="0 0 32 32" aria-hidden="true"><defs>
        <radialGradient id={`${id}-scale`} cx="40%" cy="30%" r="78%">
          <stop offset="0" stopColor="#a6f5c4" />
          <stop offset=".52" stopColor="#38bf83" />
          <stop offset="1" stopColor="#167a52" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff2b8" />
          <stop offset=".55" stopColor="#f5c342" />
          <stop offset="1" stopColor="#c98a1c" />
        </linearGradient>
        <linearGradient id={`${id}-wingl`} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#5fdca0" />
          <stop offset="1" stopColor="#1b7d5c" />
        </linearGradient>
        <linearGradient id={`${id}-wingr`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#5fdca0" />
          <stop offset="1" stopColor="#1b7d5c" />
        </linearGradient>
        <radialGradient id={`${id}-aura`}>
          <stop offset=".45" stopColor="#ffe28a" stopOpacity=".55" />
          <stop offset=".75" stopColor="#5fdca0" stopOpacity=".25" />
          <stop offset="1" stopColor="#5fdca0" stopOpacity="0" />
        </radialGradient>
      </defs>
<ellipse className="dg-pet-ground" cx="16" cy="30.25" rx="7.3" ry=".85" fill="#252333" opacity=".12" />
<g className="dg-pet-canvas" transform="translate(1 .35) scale(.935)">
<g className="dg-pet-body" data-part="body">

      {/* Aura, then the rune ring turning behind everything. */}
      <circle className="dg-pet-dragonaura" cx="16" cy="16.6" r="14.4" fill={`url(#${id}-aura)`} />
      <circle className="dg-pet-runes" cx="16" cy="16.6" r="13.4" fill="none" stroke="#f5c342" strokeWidth=".7" strokeDasharray="1.6 2.2" strokeLinecap="round" opacity=".7" />

      {/* Embers lifting off on four clocks. */}
      <g fill="#ffcf4a" stroke="#e8661e" strokeWidth=".3">
        <path className="dg-pet-ember" d="M4.6 12.6l.5-1.1.5 1.1-.5.9z" />
        <path className="dg-pet-ember dg-pet-ember-b" d="M27.2 10.6l.5-1.1.5 1.1-.5.9z" />
        <path className="dg-pet-ember dg-pet-ember-c" d="M23.4 5.4l.4-.9.4.9-.4.7z" />
        <path className="dg-pet-ember dg-pet-ember-d" d="M8.2 5.8l.4-.9.4.9-.4.7z" />
      </g>

      {/* The hoard: three coins at its feet, one catching the light. */}
      <g fill={gold} stroke="#9a6a14" strokeWidth=".35">
        <ellipse cx="6.8" cy="29.6" rx="1.4" ry=".7" /><ellipse cx="8.6" cy="30.2" rx="1.3" ry=".65" />
        <ellipse cx="25.6" cy="30" rx="1.4" ry=".7" />
      </g>
      <g transform="translate(6.4 29.4) scale(.5)"><path className="dg-pet-glint dg-pet-glint-b" d={GLINT} fill="#fff" /></g>

      {/* Tail ending in a gold spade. */}
      <g className="dg-pet-tail" data-part="tail">
        <path d="M21.2 27.6c3.8 1 6.6-.6 7-3.6.3-2-.8-3.6-2.4-4" fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M21.2 27.6c3.8 1 6.6-.6 7-3.6.3-2-.8-3.6-2.4-4" fill="none" stroke="#38bf83" strokeWidth="2" strokeLinecap="round" />
        <path d="M25.8 20.8 24.6 17.6l3.2 1.2z" fill={gold} stroke={ink} strokeWidth=".55" strokeLinejoin="round" />
      </g>

      {/* Bat wings raised, finger bones fanning out. */}
      <g className="dg-pet-wing dg-pet-wing-left" data-part="wing-left">
        <path d="M10.6 21.8C8 21.6 5.6 20.2 3.8 17.8l1.6-.2-1.8-2.6 1.9.1L4.4 12c2.2.6 4.4 2.2 5.8 4.4.9 1.4 1.2 3.2.4 5.4z" fill={wingL} stroke={ink} strokeWidth=".9" strokeLinejoin="round" />
        <path d="M10.4 21 4.4 12M10.4 21 3.6 15M10.4 21 3.8 17.8" fill="none" stroke="#0f5a40" strokeWidth=".5" strokeLinecap="round" />
      </g>
      <g className="dg-pet-wing dg-pet-wing-right" data-part="wing-right">
        <path d="M21.4 21.8C24 21.6 26.4 20.2 28.2 17.8l-1.6-.2 1.8-2.6-1.9.1L27.6 12c-2.2.6-4.4 2.2-5.8 4.4-.9 1.4-1.2 3.2-.4 5.4z" fill={wingR} stroke={ink} strokeWidth=".9" strokeLinejoin="round" />
        <path d="M21.6 21 27.6 12M21.6 21 28.4 15M21.6 21 28.2 17.8" fill="none" stroke="#0f5a40" strokeWidth=".5" strokeLinecap="round" />
      </g>

      {/* Body with gold belly plates and clawed feet. */}
      <ellipse cx="16" cy="26.5" rx="7.2" ry="4.3" fill={scale} stroke={ink} strokeWidth="1.05" />
      <path d="M12.6 23.9q3.4-1.5 6.8 0l-.4 4.6q-3 1.5-6 0z" fill={gold} stroke="#b07a18" strokeWidth=".35" />
      <path d="M12.8 25.4q3.2.8 6.4 0M13 26.9q3 .8 6 0" fill="none" stroke="#b07a18" strokeWidth=".4" strokeLinecap="round" />
      <ellipse cx="11.7" cy="29.4" rx="2.4" ry="1.25" fill="#2fa572" stroke={ink} strokeWidth=".8" />
      <ellipse cx="20.3" cy="29.4" rx="2.4" ry="1.25" fill="#2fa572" stroke={ink} strokeWidth=".8" />
      <path d="M10.8 29.9l.3-.8.3.8zM12 29.9l.3-.8.3.8zM19.4 29.9l.3-.8.3.8zM20.6 29.9l.3-.8.3.8z" fill="#f4f0e0" />

      {/* Gold crest spikes behind the head. */}
      <path d="M13 9.4l.9-2.4 1.3 1.6L16 5.8l.8 2.8 1.3-1.6.9 2.4z" fill={gold} stroke={ink} strokeWidth=".7" strokeLinejoin="round" />

      <g className="dg-pet-head" data-part="head" style={HEAD}>
<g className="dg-pet-ear dg-pet-ear-left" data-part="ear-left">
        <path d="M8.4 12.6 3.4 10.6l2.4-.6-1.6-2 2.6.2-.4-2.4 3.6 3.4z" fill="#7fe6ad" stroke={ink} strokeWidth=".8" strokeLinejoin="round" />
      </g>
<g className="dg-pet-ear dg-pet-ear-right" data-part="ear-right">
        <path d="M23.6 12.6l5-2-2.4-.6 1.6-2-2.6.2.4-2.4-3.6 3.4z" fill="#7fe6ad" stroke={ink} strokeWidth=".8" strokeLinejoin="round" />
      </g>
<path d="M11.8 9.4c-.8-2.2-.6-4.4.8-6.4.2 1.8.9 3.2 2 4.2zM20.2 9.4c.8-2.2.6-4.4-.8-6.4-.2 1.8-.9 3.2-2 4.2z" fill={gold} stroke={ink} strokeWidth=".6" strokeLinejoin="round" />
<ellipse className="dg-pet-face" cx="16" cy="17" rx="9.6" ry="9.1" fill={scale} stroke={ink} strokeWidth="1.15" />
<ellipse cx="12" cy="11.6" rx="3.2" ry="1.8" fill="#fff" opacity=".26" transform="rotate(-20 12 11.6)" />
<path d="M13.4 10.6q.8.8 1.6 0t1.6 0 1.6 0M7.8 16q.7.7 1.4 0M22.8 16q.7.7 1.4 0" fill="none" stroke="#16774f" strokeWidth=".5" strokeLinecap="round" opacity=".75" />
<path d="M9.6 13.4q2.4-1.4 4.8-.3M22.4 13.4q-2.4-1.4-4.8-.3" fill="none" stroke="#f5c342" strokeWidth=".75" strokeLinecap="round" />
<ellipse cx="16" cy="21.2" rx="4.6" ry="2.9" fill="#c9f5dc" />
<ellipse cx="14.6" cy="20.2" rx=".45" ry=".3" fill={ink} opacity=".75" />
<ellipse cx="17.4" cy="20.2" rx=".45" ry=".3" fill={ink} opacity=".75" />
<PetEyes left={12} right={20} y={15.9} rx={2.1} ry={2.35} ink={ink} iris="#ffc53d" />
<g fill="#ff9886" opacity=".42"><ellipse cx="8.2" cy="19.4" rx="1.4" ry=".85" /><ellipse cx="23.8" cy="19.4" rx="1.4" ry=".85" /></g>
<path d="M11.6 21.4q-3 .2-5 2M20.4 21.4q3 .2 5 2" fill="none" stroke="#f5c342" strokeWidth=".55" strokeLinecap="round" />
<path className="dg-pet-mouth-base" d="M13.4 22.4q2.6 2.2 5.2 0" fill="none" stroke={ink} strokeWidth=".9" strokeLinecap="round" />
<path className="dg-pet-mouth-base" d="M14.4 23.05l.35.95.5-1.1zM17.6 23.05l-.35.95-.5-1.1z" fill="#fff" stroke={ink} strokeWidth=".25" strokeLinejoin="round" />
      {/* Smoke from the nostrils: authored at opacity 0 (see Frost). */}
<g fill="#e7efe9" stroke="#9fb8aa" strokeWidth=".3">
        <g className="dg-pet-breath" opacity="0"><circle cx="12" cy="20.4" r=".9" /><circle cx="10.6" cy="19.8" r="1.1" /></g>
        <g className="dg-pet-breath dg-pet-breath-b" opacity="0"><circle cx="20" cy="20.4" r=".9" /><circle cx="21.4" cy="19.8" r="1.1" /></g>
      </g>
<PetExpression left={12} right={20} y={15.9} mouthY={22.4} ink={ink} />
<PetDetail pet="dragon" />
</g>

      {/* Gold collar with an ember gem. */}
      <g className="dg-pet-accessory">
        <path d="M10.4 24.4c3.6 1.5 7.6 1.5 11.2 0l.35 1.5c-3.8 1.7-8.1 1.7-11.9 0z" fill="#c99a2e" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
        <path d="M16 25.5l1 1.2-1 1.4-1-1.4z" fill="#ff6a3a" stroke={ink} strokeWidth=".4" strokeLinejoin="round" />
        <g transform="translate(16.5 26.1) scale(.45)"><path className="dg-pet-glint dg-pet-glint-c" d={GLINT} fill="#fff" /></g>
      </g>

<PetDetail pet="dragon" layer="body" />
</g></g></svg>
  );
}
