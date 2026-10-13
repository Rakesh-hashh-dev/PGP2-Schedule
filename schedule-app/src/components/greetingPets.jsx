/* eslint-disable react-refresh/only-export-components */
// This module deliberately exports the pet registry and lookup helpers alongside
// the presentational SVG components, so Fast Refresh's "components only" rule
// doesn't apply — the pets are static and rarely edited.

// Companion artwork shared by the greeting, adoption flow, and pet page.
//
// Each pet is a small inline SVG (no external assets → CSP-safe) drawn with
// flat, mid-tone illustrative colors that read on both light and dark grounds.
// White-bodied pets carry a faint outline so they don't vanish on the light
// theme. The eyes live in a `.dg-pet-eyes` group so CSS can blink them, and the
// whole figure gets a gentle idle bob — both disabled under reduced-motion
// (see styles.css).
//
// The SVGs are `aria-hidden` on purpose: they only ever render inside a labelled
// control (the greeting button) or a decorative preview (the admin panel), so a
// role/label here would double-announce the pet.

import { useId } from "react";
import PetExpression, { PetGesture } from "./PetExpression.jsx";
import { Hoot, Byte, Pebble, Prickle } from "./petExtras.jsx";
import Luna from "./Luna.jsx";

const EYE = "#22242e";

// The cat is the first companion in the roster and one of the three starters,
// so more people see it than any other pet — and it was the oldest drawing in
// the file: a near-black disc with two big yellow eyes, which read closer to
// spooky than friendly.
//
// Redrawn to the same brief as the dog: a heavy outline, a grey tabby coat with
// real markings, cheek tufts, and a tail that curls rather than hooks. Same
// class hooks, same signature (the whiskers twitch), same collar.
//
// Gradient ids come from useId — two cats on one page (greeting chip +
// pet-page hero) must not reference each other's defs.
function Cat() {
  const id = "ct" + useId().replace(/\W/g, "");
  const ink = "#241f2b";
  const coat = `url(#${id}-coat)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-coat`} cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="#b4bbcd" />
          <stop offset=".56" stopColor="#8d95ab" />
          <stop offset="1" stopColor="#6b7288" />
        </radialGradient>
        <linearGradient id={`${id}-ear`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0aec4" />
          <stop offset="1" stopColor="#d98aa6" />
        </linearGradient>
      </defs>

      {/* Tail: a real curl with a banded tip, rooted at the hip so the shared
          wag (origin: bottom-left of its own box) swings the whole sweep. */}
      <g className="dg-pet-tail">
        <path d="M21.8 27.4c3.2 1 5.8.2 7-2 1.2-2.2.4-4.4-1.4-5-1.7-.6-3.2.5-3.2 2 0 1.2.9 1.9 1.8 1.7" fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M21.8 27.4c3.2 1 5.8.2 7-2 1.2-2.2.4-4.4-1.4-5-1.7-.6-3.2.5-3.2 2 0 1.2.9 1.9 1.8 1.7" fill="none" stroke="#8d95ab" strokeWidth="2" strokeLinecap="round" />
        <path d="M26.2 26.9q1.4.5 2.3-.5M27.9 24.2q.9-.2 1.2-1.2" fill="none" stroke="#5d6478" strokeWidth=".9" strokeLinecap="round" />
      </g>

      {/* Chest, with the cream bib and two front paws under it. */}
      <path d="M11.6 22.8h8.8v4.6c0 1.6-1.5 2.5-4.4 2.5s-4.4-.9-4.4-2.5z" fill={coat} stroke={ink} strokeWidth="1.05" strokeLinejoin="round" />
      <path d="M13.4 24.4c1.7.7 3.5.7 5.2 0v2.9c0 1.1-.9 1.7-2.6 1.7s-2.6-.6-2.6-1.7z" fill="#f3efe4" />
      {/* Paws with cute toe bean separators */}
      <ellipse cx="13.1" cy="29.2" rx="2.2" ry="1.2" fill="#f3efe4" stroke={ink} strokeWidth=".85" />
      <path d="M12.4 29.3v.8M13.8 29.3v.8" stroke={ink} strokeWidth=".5" strokeLinecap="round" opacity=".65" />
      <ellipse cx="18.9" cy="29.2" rx="2.2" ry="1.2" fill="#f3efe4" stroke={ink} strokeWidth=".85" />
      <path d="M18.2 29.3v.8M19.6 29.3v.8" stroke={ink} strokeWidth=".5" strokeLinecap="round" opacity=".65" />

      {/* Ears. Upright triangles with a soft outer edge and inner white fur tufts */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M11.9 9.6 5.4 3.2c-.8-.8-2-.2-2 .9l.4 8z" fill={coat} stroke={ink} strokeWidth="1.15" strokeLinejoin="round" />
        <path d="M10.4 9.4 5.5 5.1l.3 4.6z" fill={`url(#${id}-ear)`} />
        <path d="M5.8 9.8c.8-1.4 2.2-2.2 3.6-2.4-.6 1.2-1.4 2-2.2 2.6z" fill="#ffffff" opacity=".85" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M20.1 9.6 26.6 3.2c.8-.8 2-.2 2 .9l-.4 8z" fill={coat} stroke={ink} strokeWidth="1.15" strokeLinejoin="round" />
        <path d="M21.6 9.4 26.5 5.1l-.3 4.6z" fill={`url(#${id}-ear)`} />
        <path d="M26.2 9.8c-.8-1.4-2.2-2.2-3.6-2.4.6 1.2 1.4 2 2.2 2.6z" fill="#ffffff" opacity=".85" />
      </g>

      {/* Head, with cheek tufts cut into the outline rather than drawn on top. */}
      <path
        className="dg-pet-face"
        d="M16 6.4c5.9 0 9.4 3.4 9.7 8.6l1.9 1.5-2.1 1.2c-.5 4.5-4 7.6-9.5 7.6s-9-3.1-9.5-7.6L4.4 16.5l1.9-1.5C6.6 9.8 10.1 6.4 16 6.4z"
        fill={coat}
        stroke={ink}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <ellipse cx="11.6" cy="10.6" rx="3.4" ry="2" fill="#fff" opacity=".2" transform="rotate(-24 11.6 10.6)" />

      {/* Tabby markings: the forehead M and double cheek stripes. */}
      <path d="M13.4 8.7q1.1 1.3 1.2 2.6M16 8.1v3.1M18.6 8.7q-1.1 1.3-1.2 2.6" fill="none" stroke="#52596b" strokeWidth="1" strokeLinecap="round" opacity=".8" />
      <path d="M7.4 14.8q2-.8 3.2-.2M7.2 16.4q1.8-.4 2.8.2M24.6 14.8q-2-.8-3.2-.2M24.8 16.4q-1.8-.4-2.8.2" fill="none" stroke="#52596b" strokeWidth=".85" strokeLinecap="round" opacity=".7" />

      {/* Cream muzzle: two soft lobes, small enough that the coat still owns the face. */}
      <ellipse cx="14.2" cy="21.1" rx="2.5" ry="2" fill="#f3efe4" />
      <ellipse cx="17.8" cy="21.1" rx="2.5" ry="2" fill="#f3efe4" />
      <ellipse cx="7.9" cy="19.4" rx="1.9" ry="1.2" fill="#e88fa6" opacity=".45" />
      <ellipse cx="24.1" cy="19.4" rx="1.9" ry="1.2" fill="#e88fa6" opacity=".45" />

      {/* Big round eyes, set low and wide with amber iris rings and bright catchlights. */}
      <g className="dg-pet-eyes">
        <ellipse cx="11.7" cy="16.5" rx="3.15" ry="3.4" fill={ink} />
        <ellipse cx="20.3" cy="16.5" rx="3.15" ry="3.4" fill={ink} />
        <ellipse cx="11.7" cy="18.2" rx="2.35" ry="1.35" fill="#f6c453" />
        <ellipse cx="20.3" cy="18.2" rx="2.35" ry="1.35" fill="#f6c453" />
        <ellipse cx="11.7" cy="17.6" rx="2.35" ry="1.15" fill={ink} />
        <ellipse cx="20.3" cy="17.6" rx="2.35" ry="1.15" fill={ink} />
        <circle cx="10.5" cy="15.1" r="1.15" fill="#fff" />
        <circle cx="19.1" cy="15.1" r="1.15" fill="#fff" />
        <circle cx="12.9" cy="17.9" r=".5" fill="#fff" opacity=".85" />
        <circle cx="21.5" cy="17.9" r=".5" fill="#fff" opacity=".85" />
      </g>

      {/* Nose and mouth: a small pink triangle over a wide w-mouth. */}
      <path d="M16 19.6c.9 0 1.4.3 1.4.9 0 .65-.65 1.2-1.4 1.2s-1.4-.55-1.4-1.2c0-.6.5-.9 1.4-.9z" fill="#e88fa6" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
      <path className="dg-pet-mouth-base" d="M16 21.7v.7M16 22.4q-1.25 1.25-2.2 0M16 22.4q1.25 1.25 2.2 0" fill="none" stroke={ink} strokeWidth=".9" strokeLinecap="round" />

      {/* Whiskers — the signature twitch. */}
      <path
        className="dg-pet-sig dg-pet-sig-cat"
        d="M11.6 20.2 2.9 18.9M11.6 21.9 3.6 23.2M20.4 20.2l8.7-1.3M20.4 21.9l8 1.3"
        fill="none"
        stroke={ink}
        strokeWidth=".95"
        strokeLinecap="round"
      />

      {/* Default collar with 3D brass jingle bell */}
      <path className="dg-pet-accessory" d="M11.4 23.9c3 1.1 6.2 1.1 9.2 0l.35 1.5c-3.3 1.3-6.6 1.3-9.9 0z" fill="#d8688f" stroke={ink} strokeWidth=".55" strokeLinejoin="round" />
      <g className="dg-pet-accessory">
        <circle cx="16" cy="26" r="1.3" fill="#f6ca59" stroke={ink} strokeWidth=".55" />
        <circle cx="15.6" cy="25.5" r=".35" fill="#ffffff" />
        <path d="M15 26.2h2" stroke="#92400e" strokeWidth=".35" strokeLinecap="round" />
        <circle cx="16" cy="26.8" r=".25" fill="#543807" />
      </g>
      <PetExpression left={11.7} right={20.3} y={16.5} mouthY={22.4} ink="#241f2b" />
      <PetGesture fur="#8d95ab" />
    </svg>
  );
}

// Sticker-style fox, drawn to the same brief as the dog and the cat: a heavy
// dark outline around every mass, a cream muzzle and bib, big round eyes.
//
// The previous fox was a flat orange disc with two white zig-zag ruffs pinned
// to its cheeks — the ruffs were doing the work the silhouette should do, and
// at 17px they read as noise on either side of a circle. What actually says
// "fox", in order of how much work each cue does: the big brush tail with the
// cream tip, the tall pointed ears, the narrow snout, the pale brow ticks.
//
// The head is deliberately SMALLER than the dog's and the cat's (r≈7.4 against
// their ≈9.5). Those two are portraits — head, a suggestion of chest, done. The
// fox has to be a seated body, because the tail is the cue and a tail needs a
// hip to grow out of and clear canvas to sweep through. Drawn at the roster's
// usual head size the brush had nowhere to go: it wrapped the skull and read as
// a hood.
//
// The tail roots at the hip on its RIGHT edge, so it needs the per-pet
// `transform-origin` override in styles.css — the same fix the dog's floppy
// ears needed, at the opposite corner.
//
// The raised paw rides `.dg-pet-tuft` (2.05s), out of phase with the ears
// (2.8s), the tail (1.55s) and the head's breathe (3.3s), so the fox has four
// unsynchronised moving parts at idle. It cannot use `.dg-pet-sig` — that is
// the smirk, and a part may only carry one animation.
//
// Gradient ids come from useId — two foxes on one page (greeting chip +
// pet-page hero) must not reference each other's defs.
function Fox() {
  const id = "fx" + useId().replace(/\W/g, "");
  const ink = "#231710";
  const coat = `url(#${id}-coat)`;
  const earFluff = `url(#${id}-ear-fluff)`;
  const cream = "#fdf7ee";
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-coat`} cx="40%" cy="24%" r="80%">
          <stop offset="0" stopColor="#fa9442" />
          <stop offset=".52" stopColor="#eb6a1e" />
          <stop offset="1" stopColor="#c5470d" />
        </radialGradient>
        <linearGradient id={`${id}-ear-fluff`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f7ebd9" />
        </linearGradient>
      </defs>

      {/* Voluminous brush tail. Sweeps out from the left hip with a thick
          curving plume and a fluffy cream tip peaking beside the flank.
          Its bounding box roots at the hip on its right edge, matching the
          transform-origin in styles.css. */}
      <g className="dg-pet-tail">
        {/* Tail base plume */}
        <path
          d="M11.6 28.6C6.2 29.4 2 26 1.6 20.4c-.4-5.4 2.2-9.8 5.2-10.8 1.6-.6 3 .4 2.8 2-.4 3.2 0 7.4 2.8 11.2z"
          fill={coat}
          stroke={ink}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Fluffy jagged cream tail tip */}
        <path
          d="M6.8 9.6c1.6-.6 3 .4 2.8 2-.3 2.4-.8 4.6.2 5.9-1.3-.5-2.6.1-3.4 1.3-.8-1.3-2-1.4-3.2-.8-.8-2.4 0-5.4 3.6-8.4z"
          fill={cream}
          stroke={ink}
          strokeWidth=".95"
          strokeLinejoin="round"
        />
        {/* Tail fur texture ticks */}
        <path d="M4.6 23.6q1.4-.7 1.8-2M3.8 19q1.2-.4 1.6-1.5" fill="none" stroke="#be430c" strokeWidth=".75" strokeLinecap="round" opacity=".55" />
      </g>

      {/* Seated body with dark-socked front paws. */}
      <path
        d="M10.8 19.2h10.4c2.6 0 4.6 2 4.6 5.2 0 2.2-1.6 3.8-4.6 3.8H10.8c-3 0-4.6-1.6-4.6-3.8 0-3.2 2-5.2 4.6-5.2z"
        fill={coat}
        stroke={ink}
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      {/* Cream bib / chest ruff */}
      <path d="M12.8 20.6c2.1.9 4.3.9 6.4 0v4.4c0 1.6-1.2 2.6-3.2 2.6s-3.2-1-3.2-2.6z" fill={cream} />
      {/* Front paws with signature fox black socks */}
      <ellipse cx="12.7" cy="28.9" rx="2.3" ry="1.25" fill="#2a1b14" stroke={ink} strokeWidth=".85" />
      <ellipse cx="19.3" cy="28.9" rx="2.3" ry="1.25" fill="#2a1b14" stroke={ink} strokeWidth=".85" />
      {/* Toe highlights on socks */}
      <circle cx="12.2" cy="29.2" r=".35" fill="#fdf7ee" opacity=".7" />
      <circle cx="13.2" cy="29.2" r=".35" fill="#fdf7ee" opacity=".7" />
      <circle cx="18.8" cy="29.2" r=".35" fill="#fdf7ee" opacity=".7" />
      <circle cx="19.8" cy="29.2" r=".35" fill="#fdf7ee" opacity=".7" />

      {/* Tall pointed ears with iconic black backs/tips and cream inner fluff.
          Drawn before the head so the skull cleanly overlaps the ear roots. */}
      <g className="dg-pet-ear dg-pet-ear-left">
        {/* Main ear mass */}
        <path d="M12.4 9.6 6.5 1.9c-.7-.9-2.05-.45-2.15.75L3.7 11.2c.6 1.4 2.2 2.2 4 2.2z" fill={coat} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        {/* Black outer tip */}
        <path d="M6.5 1.9 4.3 6.6c.8-.4 2-.8 3.1-.6L6.5 1.9z" fill="#231710" />
        {/* Cream inner ear fluff */}
        <path d="M11 9.4 6.8 4.6l-.6 4.8c1.3.6 3.4.6 4.8 0z" fill={earFluff} />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        {/* Main ear mass */}
        <path d="M19.6 9.6 25.5 1.9c.7-.9 2.05-.45 2.15.75l.65 8.55c-.6 1.4-2.2 2.2-4 2.2z" fill={coat} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        {/* Black outer tip */}
        <path d="M25.5 1.9 27.7 6.6c-.8-.4-2-.8-3.1-.6l.9-4.1z" fill="#231710" />
        {/* Cream inner ear fluff */}
        <path d="M21 9.4 25.2 4.6l.6 4.8c-1.3.6-3.4.6-4.8 0z" fill={earFluff} />
      </g>

      {/* Head with distinct fox cheek ruffs: double flare points on each side
          that taper sharply into a refined chin and snout. */}
      <path
        className="dg-pet-face"
        d="M16 6.2c4.6 0 7.5 2.6 8.1 6.2l3 2.4-2.4 1.4 1.8 2.2-3.3 1c-1.2 1.8-3.8 3.8-7.2 3.8s-6-2-7.2-3.8l-3.3-1 1.8-2.2-2.4-1.4 3-2.4c.6-3.6 3.5-6.2 8.1-6.2z"
        fill={coat}
        stroke={ink}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <ellipse cx="12" cy="9.6" rx="2.8" ry="1.6" fill="#fff" opacity=".22" transform="rotate(-24 12 9.6)" />

      {/* Fox mask & cheek ruffs: white/cream fur wrapping from the outer cheek
          spikes inward around the muzzle, leaving an orange forehead blaze. */}
      <path
        d="M7.4 16.2c1.2-1.8 3.5-2.6 5.6-2.2.8.9 1.4 2.4 3 2.7 1.6-.3 2.2-1.8 3-2.7 2.1-.4 4.4.4 5.6 2.2 1.4 2 .4 4-2 5.2-1.8 1-4.2 1.6-6.6 1.6s-4.8-.6-6.6-1.6c-2.4-1.2-3.4-3.2-2-5.2z"
        fill={cream}
      />

      {/* Expressive fox brow markings */}
      <path d="M10.8 11.2q1.5-1.2 2.8-.2M21.2 11.2q-1.5-1.2-2.8-.2" fill="none" stroke="#ffe5c7" strokeWidth=".85" strokeLinecap="round" />

      {/* Sleek, clever fox eyes: almond-tilted with dark eyeliner, amber warmth, and lively highlights */}
      <g className="dg-pet-eyes">
        {/* Almond tilted eye contours */}
        <ellipse cx="12.2" cy="15.2" rx="2.35" ry="2.0" fill={ink} transform="rotate(8 12.2 15.2)" />
        <ellipse cx="19.8" cy="15.2" rx="2.35" ry="2.0" fill={ink} transform="rotate(-8 19.8 15.2)" />
        {/* Warm amber iris crescent at bottom */}
        <ellipse cx="12.2" cy="16.0" rx="1.6" ry=".85" fill="#e88d2a" />
        <ellipse cx="19.8" cy="16.0" rx="1.6" ry=".85" fill="#e88d2a" />
        <ellipse cx="12.2" cy="15.5" rx="1.6" ry=".65" fill={ink} />
        <ellipse cx="19.8" cy="15.5" rx="1.6" ry=".65" fill={ink} />
        {/* Primary catchlight */}
        <circle cx="11.5" cy="14.4" r=".8" fill="#fff" />
        <circle cx="19.1" cy="14.4" r=".8" fill="#fff" />
        {/* Secondary soft catchlight */}
        <circle cx="12.9" cy="15.9" r=".34" fill="#fff" opacity=".85" />
        <circle cx="20.5" cy="15.9" r=".34" fill="#fff" opacity=".85" />
      </g>

      {/* Soft warm cheek blush */}
      <ellipse cx="8.6" cy="18.2" rx="1.3" ry=".8" fill="#e8855e" opacity=".35" />
      <ellipse cx="23.4" cy="18.2" rx="1.3" ry=".8" fill="#e8855e" opacity=".35" />

      {/* Dainty black fox nose with subtle highlight */}
      <path d="M14.7 18.4c0-.8.6-1.3 1.3-1.3s1.3.5 1.3 1.3c0 .8-.6 1.4-1.3 1.4s-1.3-.6-1.3-1.4z" fill={ink} />
      <circle cx="15.6" cy="18.1" r=".32" fill="#fff" opacity=".55" />

      {/* Fox smirk: philtrum and sly w-mouth (dgPetSigSmirk) */}
      <path
        className="dg-pet-sig dg-pet-sig-fox dg-pet-mouth-base"
        d="M16 19.8v.5M16 20.3q-.95.85-1.7 0M16 20.3q.95.85 1.7 0"
        fill="none"
        stroke={ink}
        strokeWidth=".85"
        strokeLinecap="round"
      />

      {/* Delicate fox whiskers */}
      <path
        d="M11.4 19.5 4.8 19.8M11.6 20.8 5.6 22M20.6 19.5l6.6.3M20.4 20.8l6 1.2"
        fill="none"
        stroke={ink}
        strokeWidth=".65"
        strokeLinecap="round"
        opacity=".65"
      />

      {/* Default collar with gold bell, replaced when custom neckwear is worn */}
      <path className="dg-pet-accessory" d="M11.4 24.6c2.9 1.1 6.3 1.1 9.2 0l.35 1.4c-3.3 1.2-6.5 1.2-9.9 0z" fill="#3f8576" stroke={ink} strokeWidth=".55" strokeLinejoin="round" />
      <circle className="dg-pet-accessory" cx="16" cy="26.4" r="1.1" fill="#f6ca59" stroke={ink} strokeWidth=".55" />
      <PetExpression left={12.2} right={19.8} y={15.2} mouthY={20} ink="#241f2b" />
    </svg>
  );
}

function Dog() {
  const id = "dg" + useId().replace(/\W/g, "");
  const ink = "#241a15";
  const coat = `url(#${id}-coat)`;
  const earShade = `url(#${id}-ear)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-coat`} cx="38%" cy="26%" r="80%">
          <stop offset="0" stopColor="#fedfbe" />
          <stop offset=".54" stopColor="#e5a769" />
          <stop offset="1" stopColor="#c58444" />
        </radialGradient>
        <linearGradient id={`${id}-ear`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ce8a48" />
          <stop offset=".58" stopColor="#b46f2e" />
          <stop offset="1" stopColor="#94541e" />
        </linearGradient>
        <radialGradient id={`${id}-muzzle`} cx="42%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fffaf3" />
          <stop offset="1" stopColor="#f3e2cd" />
        </radialGradient>
      </defs>

      {/* Feathered golden retriever / spaniel tail wagging */}
      <g className="dg-pet-tail">
        <path d="M21.2 28c2.8.5 5.5-.4 6.8-2.8 1.1-2.1.6-4.2-.6-4.8-1.2-.6-2.4.2-2.4 1.4 0 1 .6 1.8 1.4 1.8" fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round" />
        <path d="M21.2 28c2.8.5 5.5-.4 6.8-2.8 1.1-2.1.6-4.2-.6-4.8-1.2-.6-2.4.2-2.4 1.4 0 1 .6 1.8 1.4 1.8" fill="none" stroke="#e5a769" strokeWidth="1.9" strokeLinecap="round" />
      </g>

      {/* Chest with cream bib and seated front paws */}
      <path d="M11.4 23.2h9.2v4.3c0 1.5-1.5 2.4-4.6 2.4s-4.6-.9-4.6-2.4z" fill={coat} stroke={ink} strokeWidth="1.05" strokeLinejoin="round" />
      <ellipse cx="12.2" cy="29.2" rx="2.2" ry="1.15" fill="#f3e2cd" stroke={ink} strokeWidth=".85" />
      <path d="M11.5 29.3v.8M12.9 29.3v.8" stroke={ink} strokeWidth=".5" strokeLinecap="round" opacity=".6" />
      <ellipse cx="19.8" cy="29.2" rx="2.2" ry="1.15" fill="#f3e2cd" stroke={ink} strokeWidth=".85" />
      <path d="M19.1 29.3v.8M20.5 29.3v.8" stroke={ink} strokeWidth=".5" strokeLinecap="round" opacity=".6" />

      {/* Long velvety floppy hound / spaniel ears */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M10.8 7.6c-2 .5-4.4 2.4-5.8 5.4-1.7 3.6-2.2 8.2-1.3 11.2.7 2.3 2.4 3.3 4 2.8 1.7-.5 2.8-2.4 3-5.2.3-3.8.1-7.2.6-10.2.3-1.9.9-3.6-.5-4z" fill={coat} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M9.8 9.6c-1.3.7-3 2.4-4 5-1.2 3-1.4 6.8-.7 9.2.4 1.4 1.5 1.9 2.5 1.4.9-.4 1.5-1.7 1.7-4.1.2-2.8.2-5.8.6-8.3.2-1.6.3-2.6-.1-3.2z" fill={earShade} opacity=".88" />
        <path d="M4.6 15c.8 3.6 1.4 7.4 3.2 9.8" fill="none" stroke="#fed8a8" strokeWidth=".7" strokeLinecap="round" opacity=".6" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M21.2 7.6c2 .5 4.4 2.4 5.8 5.4 1.7 3.6 2.2 8.2 1.3 11.2-.7 2.3-2.4 3.3-4 2.8-1.7-.5-2.8-2.4-3-5.2-.3-3.8-.1-7.2-.6-10.2-.3-1.9-.9-3.6.5-4z" fill={coat} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M22.2 9.6c1.3.7 3 2.4 4 5 1.2 3 1.4 6.8.7 9.2-.4 1.4-1.5 1.9-2.5 1.4-.9-.4-1.5-1.7-1.7-4.1-.2-2.8-.2-5.8-.6-8.3-.2-1.6-.3-2.6.1-3.2z" fill={earShade} opacity=".88" />
        <path d="M27.4 15c-.8 3.6-1.4 7.4-3.2 9.8" fill="none" stroke="#fed8a8" strokeWidth=".7" strokeLinecap="round" opacity=".6" />
      </g>

      {/* Head shape */}
      <path
        className="dg-pet-face"
        d="M16 6.2c5.8 0 9.6 3.6 9.6 9.4 0 4.2-2.2 7.8-5.6 8.8-2.6.8-5.4.8-8 0-3.4-1-5.6-4.6-5.6-8.8 0-5.8 3.8-9.4 9.6-9.4z"
        fill={coat}
        stroke={ink}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {/* Forehead white blaze mark */}
      <path d="M16 6.4c1.1 0 1.8.8 1.8 2.2 0 2.2-.8 4.4-1.8 5.8-1-1.4-1.8-3.6-1.8-5.8 0-1.4.7-2.2 1.8-2.2z" fill="#fffdf8" opacity=".7" />
      <ellipse cx="11.4" cy="9.2" rx="2.8" ry="1.4" fill="#fff" opacity=".2" transform="rotate(-22 11.4 9.2)" />

      {/* Cream muzzle */}
      <ellipse cx="13.7" cy="20.4" rx="3.3" ry="2.6" fill={`url(#${id}-muzzle)`} />
      <ellipse cx="18.3" cy="20.4" rx="3.3" ry="2.6" fill={`url(#${id}-muzzle)`} />
      <ellipse cx="16" cy="21.6" rx="4.5" ry="2.6" fill={`url(#${id}-muzzle)`} />
      <ellipse cx="8.8" cy="18.8" rx="1.6" ry="1" fill="#e88fa6" opacity=".4" />
      <ellipse cx="23.2" cy="18.8" rx="1.6" ry="1" fill="#e88fa6" opacity=".4" />

      {/* Puppy eyes */}
      <g className="dg-pet-eyes">
        <ellipse cx="12" cy="15.8" rx="2.4" ry="2.7" fill={ink} />
        <ellipse cx="20" cy="15.8" rx="2.4" ry="2.7" fill={ink} />
        <ellipse cx="12" cy="17.1" rx="1.7" ry="1" fill="#c6762c" />
        <ellipse cx="20" cy="17.1" rx="1.7" ry="1" fill="#c6762c" />
        <ellipse cx="12" cy="16.6" rx="1.7" ry=".85" fill={ink} />
        <ellipse cx="20" cy="16.6" rx="1.7" ry=".85" fill={ink} />
        <circle cx="11.1" cy="14.7" r=".95" fill="#fff" />
        <circle cx="19.1" cy="14.7" r=".95" fill="#fff" />
        <circle cx="12.7" cy="16.8" r=".4" fill="#fff" opacity=".85" />
        <circle cx="20.7" cy="16.8" r=".4" fill="#fff" opacity=".85" />
      </g>
      <path d="M10 11.8q1.8-1.5 3.6-.3M22 11.8q-1.8-1.5-3.6-.3" fill="none" stroke={ink} strokeWidth="1" strokeLinecap="round" />

      {/* Nose and smiling mouth with panting tongue */}
      <path d="M14.2 18.6c0-1.1.8-1.7 1.8-1.7s1.8.6 1.8 1.7c0 1.2-.8 2-1.8 2s-1.8-.8-1.8-2z" fill={ink} />
      <ellipse cx="15.3" cy="18.1" rx=".5" ry=".25" fill="#fff" opacity=".55" transform="rotate(-15 15.3 18.1)" />
      <path className="dg-pet-mouth-base" d="M16 20.4v.9" stroke={ink} strokeWidth=".8" strokeLinecap="round" />
      <path className="dg-pet-mouth-base" d="M13.8 21.2q2.2 2 4.4 0c.1 2.8-.9 3.9-2.2 3.9s-2.3-1.1-2.2-3.9z" fill={ink} />
      <path className="dg-pet-sig dg-pet-sig-dog dg-pet-mouth-base" d="M14.7 22.1q1.3 1.1 2.6 0c.05 2.1-.4 2.9-1.3 2.9s-1.35-.8-1.3-2.9z" fill="#f4788f" />
      <path className="dg-pet-mouth-base" d="M16 22.8v1.7" stroke="#d8586f" strokeWidth=".35" strokeLinecap="round" opacity=".7" />

      {/* Collar with gold bone tag */}
      <path className="dg-pet-accessory" d="M11.6 24.2c2.8 1.1 6 1.1 8.8 0l.3 1.4c-3.1 1.2-6.3 1.2-9.4 0z" fill="#4d82b2" stroke={ink} strokeWidth=".55" strokeLinejoin="round" />
      <g className="dg-pet-accessory">
        <path d="M14.7 26.2c-.3-.3-.7-.3-.9 0-.3.3-.2.8.1 1-.3.2-.4.6-.1.9.3.3.7.3.9 0h2.6c.3.3.7.3.9 0 .3-.3.2-.8-.1-1 .3-.2.4-.6.1-.9-.3-.3-.7-.3-.9 0z" fill="#f6ca59" stroke={ink} strokeWidth=".35" />
        <circle cx="15.2" cy="26.8" r=".25" fill="#ffffff" />
      </g>
      <PetExpression left={12} right={20} y={15.8} mouthY={21.8} ink="#241f2b" />
    </svg>
  );
}

function Bunny() {
  const id = "bn" + useId().replace(/\W/g, "");
  const ink = "#1e1728";
  const coat = `url(#${id}-coat)`;
  const earOuter = `url(#${id}-earOuter)`;
  const earInner = `url(#${id}-earInner)`;
  const muzzle = `url(#${id}-muzzle)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-coat`} cx="40%" cy="28%" r="78%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".52" stopColor="#edf0f8" />
          <stop offset="1" stopColor="#cfd4e5" />
        </radialGradient>
        <linearGradient id={`${id}-earOuter`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0f2f8" />
          <stop offset="1" stopColor="#d4d8ea" />
        </linearGradient>
        <linearGradient id={`${id}-earInner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f9c8db" />
          <stop offset=".7" stopColor="#f0a0c0" />
          <stop offset="1" stopColor="#e07fa8" />
        </linearGradient>
        <radialGradient id={`${id}-muzzle`} cx="45%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fffcfe" />
          <stop offset=".7" stopColor="#fdf0f5" />
          <stop offset="1" stopColor="#f5dce8" />
        </radialGradient>
      </defs>

      {/* Fluffy cotton-ball pom tail */}
      <g className="dg-pet-tail">
        <circle cx="24.2" cy="23.8" r="3.6" fill={coat} stroke={ink} strokeWidth="1.05" />
        <circle cx="25.1" cy="23.2" r="2.1" fill="#ffffff" opacity=".85" />
        <circle cx="24.6" cy="24.4" r="1.1" fill="#ffffff" opacity=".9" />
      </g>

      {/* Seated body with cream chest bib */}
      <path d="M11.2 20.4h9.6v5.8c0 2.2-2 3.2-4.8 3.2s-4.8-1-4.8-3.2z" fill={coat} stroke={ink} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M13.2 21.6c1.8.8 3.8.8 5.6 0v4.2c0 1.4-1.4 2.2-2.8 2.2s-2.8-.8-2.8-2.2z" fill="#ffffff" />
      {/* Front paws with toe beans */}
      <ellipse cx="12.8" cy="28.6" rx="2.2" ry="1.15" fill="#fff" stroke={ink} strokeWidth=".85" />
      <path d="M12.1 28.6v.75M13.5 28.6v.75" stroke={ink} strokeWidth=".45" strokeLinecap="round" opacity=".55" />
      <ellipse cx="19.2" cy="28.6" rx="2.2" ry="1.15" fill="#fff" stroke={ink} strokeWidth=".85" />
      <path d="M18.5 28.6v.75M19.9 28.6v.75" stroke={ink} strokeWidth=".45" strokeLinecap="round" opacity=".55" />

      {/* Long upright ears with sculpted inner lobe */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M12.6 12.6c-2.8-3.4-3-8.8-.8-10.8 1.8-1.6 4.4.6 4.6 4.2.2 3.4-.2 5.6-1.8 7z" fill={earOuter} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M12.2 11c-1.8-2.4-1.6-6-.4-7 1-.8 2.2.8 2.2 3.2.1 1.8-.4 3.2-1.8 3.8z" fill={earInner} />
        <path d="M11.6 7.4c.2 1.8.5 3.4 1.2 4.4" fill="none" stroke="#fff" strokeWidth=".55" strokeLinecap="round" opacity=".7" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M19.4 12.6c2.8-3.4 3-8.8.8-10.8-1.8-1.6-4.4.6-4.6 4.2-.2 3.4.2 5.6 1.8 7z" fill={earOuter} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M19.8 11c1.8-2.4 1.6-6 .4-7-1-.8-2.2.8-2.2 3.2-.1 1.8.4 3.2 1.8 3.8z" fill={earInner} />
        <path d="M20.4 7.4c-.2 1.8-.5 3.4-1.2 4.4" fill="none" stroke="#fff" strokeWidth=".55" strokeLinecap="round" opacity=".7" />
      </g>

      {/* Head with forehead fluff tuft */}
      <path
        className="dg-pet-face"
        d="M16 7.8c5.8 0 9.6 3.6 9.6 9.2l1.6 1.4-1.8 1.1c-.5 4.2-3.8 7-9.4 7s-8.9-2.8-9.4-7L4.8 19.5l1.6-1.4C6.4 12.4 10.2 7.8 16 7.8z"
        fill={coat}
        stroke={ink}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <ellipse cx="12.2" cy="11.4" rx="2.8" ry="1.55" fill="#fff" opacity=".28" transform="rotate(-22 12.2 11.4)" />
      {/* Crown fluff tuft */}
      <path className="dg-pet-tuft" d="M12.2 12.2c1.3-2 2.6-2.8 3.8-2.8s2.5.8 3.8 2.8c-1.4-.8-2.6-.8-3.8 0-1.2-.8-2.4-.8-3.8 0z" fill="#ffffff" />

      {/* Cream muzzle lobes with blush cheeks */}
      <ellipse cx="13.6" cy="21.2" rx="3" ry="2.4" fill={muzzle} />
      <ellipse cx="18.4" cy="21.2" rx="3" ry="2.4" fill={muzzle} />
      <ellipse cx="16" cy="22.2" rx="4.2" ry="2.2" fill={muzzle} />
      <ellipse cx="8.8" cy="19.4" rx="1.7" ry="1.05" fill="#f5aabf" opacity=".5" />
      <ellipse cx="23.2" cy="19.4" rx="1.7" ry="1.05" fill="#f5aabf" opacity=".5" />

      {/* Soulful eyes with ruby-mauve iris rings and double catchlights */}
      <g className="dg-pet-eyes">
        <ellipse cx="12.4" cy="16.8" rx="2.15" ry="2.5" fill={ink} />
        <ellipse cx="19.6" cy="16.8" rx="2.15" ry="2.5" fill={ink} />
        <ellipse cx="12.4" cy="18" rx="1.5" ry=".85" fill="#b06070" />
        <ellipse cx="19.6" cy="18" rx="1.5" ry=".85" fill="#b06070" />
        <ellipse cx="12.4" cy="17.5" rx="1.5" ry=".75" fill={ink} />
        <ellipse cx="19.6" cy="17.5" rx="1.5" ry=".75" fill={ink} />
        <circle cx="11.6" cy="15.8" r=".85" fill="#fff" />
        <circle cx="18.8" cy="15.8" r=".85" fill="#fff" />
        <circle cx="13.1" cy="17.8" r=".36" fill="#fff" opacity=".9" />
        <circle cx="20.3" cy="17.8" r=".36" fill="#fff" opacity=".9" />
      </g>

      {/* Velvety triangular nose with twitching mouth */}
      <path className="dg-pet-sig dg-pet-sig-bunny" d="M16 19.6l-1.4 1.2h2.8z" fill="#e8789c" stroke={ink} strokeWidth=".4" strokeLinejoin="round" />
      <path className="dg-pet-mouth-base" d="M16 20.8v.65M16 21.45q-1.1 1-2 0M16 21.45q1.1 1 2 0" fill="none" stroke={ink} strokeWidth=".75" strokeLinecap="round" />
      {/* Whisker ticks */}
      <path d="M6.6 20h3.6M6.4 21.6l3.4-.5M25.4 20h-3.6M25.6 21.6l-3.4-.5" fill="none" stroke="#8a92a8" strokeWidth=".65" strokeLinecap="round" opacity=".85" />

      {/* Bow tie accessory with dimensional knot */}
      <path className="dg-pet-accessory" d="M16 25.2l-2.8-1.7-1.7 1.9 1.9 1.7 2.6-1.4 2.6 1.4 1.9-1.7-1.7-1.9z" fill="#9f6abf" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
      <path d="M16 25.2l-2.8-1.7" stroke="#b988d4" strokeWidth=".6" strokeLinecap="round" opacity=".6" />
      <path d="M16 25.2l2.6 1.4" stroke="#b988d4" strokeWidth=".6" strokeLinecap="round" opacity=".6" />
      <circle className="dg-pet-accessory" cx="16" cy="25.2" r="1.1" fill="#f8ce5e" stroke={ink} strokeWidth=".4" />
      <circle cx="15.7" cy="24.9" r=".3" fill="#fff" opacity=".9" />
      <PetExpression left={12.4} right={19.6} y={16.8} mouthY={21.45} ink="#252333" />
    </svg>
  );
}

function Penguin() {
  const id = "pg" + useId().replace(/\W/g, "");
  const ink = "#141822";
  const coat = `url(#${id}-coat)`;
  const gold = `url(#${id}-gold)`;
  const belly = `url(#${id}-belly)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-coat`} cx="36%" cy="22%" r="85%">
          <stop offset="0" stopColor="#3d4960" />
          <stop offset=".52" stopColor="#252e40" />
          <stop offset="1" stopColor="#141924" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffca42" />
          <stop offset="1" stopColor="#f5931e" />
        </linearGradient>
        <radialGradient id={`${id}-belly`} cx="42%" cy="32%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".7" stopColor="#f4f7fb" />
          <stop offset="1" stopColor="#dce3f0" />
        </radialGradient>
      </defs>

      {/* Penguin flipper wings with sculpted curve and white under-trim */}
      <g className="dg-pet-wing dg-pet-wing-left">
        <path d="M8.4 15.6c-3.6 1.6-4.4 7.6-1.6 9.6 1.8 1.3 3.6-.8 3.2-4.4l-.4-4.8z" fill={coat} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M6.6 22.8c.8 1.4 2.2 1.6 3.2.4" fill="none" stroke="#fff" strokeWidth=".7" strokeLinecap="round" opacity=".7" />
      </g>
      <g className="dg-pet-wing dg-pet-wing-right">
        <path d="M23.6 15.6c3.6 1.6 4.4 7.6 1.6 9.6-1.8 1.3-3.6-.8-3.2-4.4l.4-4.8z" fill={coat} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M25.4 22.8c-.8 1.4-2.2 1.6-3.2.4" fill="none" stroke="#fff" strokeWidth=".7" strokeLinecap="round" opacity=".7" />
      </g>

      {/* Chubby tuxedo body / head */}
      <ellipse className="dg-pet-face" cx="16" cy="16.8" rx="10.2" ry="11.4" fill={coat} stroke={ink} strokeWidth="1.25" strokeLinejoin="round" />
      <ellipse cx="12.2" cy="10.8" rx="3.4" ry="1.8" fill="#fff" opacity=".2" transform="rotate(-24 12.2 10.8)" />

      {/* Emperor penguin golden cheek flares */}
      <path d="M7 14.6c1.8-3.6 4.6-5.2 7.4-4.6-2.6.9-4.3 2.8-5.2 5.4z" fill={gold} />
      <path d="M25 14.6c-1.8-3.6-4.6-5.2-7.4-4.6 2.6.9 4.3 2.8 5.2 5.4z" fill={gold} />
      <circle cx="7.6" cy="12.6" r=".8" fill="#ffd454" opacity=".8" />
      <circle cx="24.4" cy="12.6" r=".8" fill="#ffd454" opacity=".8" />

      {/* Snowy down belly with soft blush */}
      <path d="M16 11.2c2.4 0 5.2 2 5.6 5.2.5 4-1.6 8.8-5.6 8.8s-6.1-4.8-5.6-8.8c.4-3.2 3.2-5.2 5.6-5.2z" fill={belly} stroke={ink} strokeWidth=".85" strokeLinejoin="round" />
      <ellipse cx="16" cy="18.2" rx="4.6" ry="6.2" fill="#ffffff" />
      <ellipse cx="10" cy="17.6" rx="1.6" ry="1" fill="#f89ea6" opacity=".55" />
      <ellipse cx="22" cy="17.6" rx="1.6" ry="1" fill="#f89ea6" opacity=".55" />

      {/* Sweet eyes with glossy catchlights */}
      <g className="dg-pet-eyes">
        <ellipse cx="12.4" cy="14.4" rx="2.3" ry="2.6" fill={ink} />
        <ellipse cx="19.6" cy="14.4" rx="2.3" ry="2.6" fill={ink} />
        <ellipse cx="12.4" cy="15.8" rx="1.6" ry=".9" fill="#587ea8" />
        <ellipse cx="19.6" cy="15.8" rx="1.6" ry=".9" fill="#587ea8" />
        <circle cx="11.5" cy="13.4" r=".95" fill="#fff" />
        <circle cx="18.7" cy="13.4" r=".95" fill="#fff" />
        <circle cx="13.1" cy="15.4" r=".38" fill="#fff" opacity=".9" />
        <circle cx="20.3" cy="15.4" r=".38" fill="#fff" opacity=".9" />
      </g>

      {/* Sculpted orange beak */}
      <path d="M16 15.6l-2.4 1.8 2.4 1.8 2.4-1.8z" fill="#f2882c" stroke={ink} strokeWidth=".7" strokeLinejoin="round" />
      <path d="M14.6 16.6l1.4-1 1.4 1" stroke="#ffb454" strokeWidth=".5" fill="none" strokeLinecap="round" />

      {/* Waddling webbed feet with shuffling motion */}
      <g className="dg-pet-sig dg-pet-sig-penguin">
        <path d="M9.6 27.2c.4-.8 1.4-1.2 2.6-1.2 1.4 0 2.4.6 2.8 1.6.3.8-.2 1.6-1.2 1.8-1.4.3-3.2.1-4.2-.6-.4-.3-.4-1.1 0-1.6z" fill="#f2882c" stroke={ink} strokeWidth=".85" strokeLinejoin="round" />
        <path d="M22.4 27.2c-.4-.8-1.4-1.2-2.6-1.2-1.4 0-2.4.6-2.8 1.6-.3.8.2 1.6 1.2 1.8 1.4.3 3.2.1 4.2-.6.4-.3.4-1.1 0-1.6z" fill="#f2882c" stroke={ink} strokeWidth=".85" strokeLinejoin="round" />
      </g>

      {/* Cozy sailor neck scarf accessory */}
      <path className="dg-pet-accessory" d="M9.4 21.6c4 1.6 9.2 1.6 13.2 0l-.35 2c-3.8 1.5-8.8 1.5-12.5 0z" fill="#3a82a6" stroke={ink} strokeWidth=".55" strokeLinejoin="round" />
      <circle className="dg-pet-accessory" cx="16" cy="22.8" r="1.15" fill="#f6ca59" stroke={ink} strokeWidth=".4" />
      <circle className="dg-pet-accessory" cx="15.7" cy="22.4" r=".3" fill="#fff" />
      <PetExpression left={12.4} right={19.6} y={14.4} mouthY={19} ink="#252333" beak />
    </svg>
  );
}

function Panda() {
  const id = "pd" + useId().replace(/\W/g, "");
  const ink = "#1a1d24";
  const coat = `url(#${id}-coat)`;
  const black = `url(#${id}-black)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-coat`} cx="38%" cy="26%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".6" stopColor="#f0f2f7" />
          <stop offset="1" stopColor="#d8dde8" />
        </radialGradient>
        <radialGradient id={`${id}-black`} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor="#3c404d" />
          <stop offset=".62" stopColor="#222631" />
          <stop offset="1" stopColor="#14171e" />
        </radialGradient>
      </defs>

      {/* Fuzzy black ears */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <circle cx="8.4" cy="8.4" r="3.8" fill={black} stroke={ink} strokeWidth="1.15" />
        <circle cx="8.8" cy="8.6" r="2.2" fill="#2b2f3b" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <circle cx="23.6" cy="8.4" r="3.8" fill={black} stroke={ink} strokeWidth="1.15" />
        <circle cx="23.2" cy="8.6" r="2.2" fill="#2b2f3b" />
      </g>

      {/* Seated black shoulders and body */}
      <path d="M9.8 21.2h12.4c2.2 0 4 1.8 4 4.8 0 2.2-1.6 3.4-4 3.4H9.8c-2.4 0-4-1.2-4-3.4 0-3 1.8-4.8 4-4.8z" fill={black} stroke={ink} strokeWidth="1.15" strokeLinejoin="round" />

      {/* Round head with cheek tufts */}
      <path
        className="dg-pet-face"
        d="M16 7c5.8 0 9.8 3.8 10 9.4l1.6 1.4-1.8 1.1c-.5 4.4-4 7.2-9.8 7.2s-9.3-2.8-9.8-7.2L4.4 18.9l1.6-1.4C6.2 10.8 10.2 7 16 7z"
        fill={coat}
        stroke={ink}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <ellipse cx="12" cy="11.2" rx="3.2" ry="1.8" fill="#fff" opacity=".22" transform="rotate(-24 12 11.2)" />

      {/* Teardrop black eye patches */}
      <ellipse cx="11.8" cy="16.4" rx="2.8" ry="3.5" fill={black} transform="rotate(-16 11.8 16.4)" />
      <ellipse cx="20.2" cy="16.4" rx="2.8" ry="3.5" fill={black} transform="rotate(16 20.2 16.4)" />

      {/* Cute sparkling eyes inside patches */}
      <g className="dg-pet-eyes">
        <circle cx="12" cy="16.2" r="1.4" fill="#ffffff" />
        <circle cx="20" cy="16.2" r="1.4" fill="#ffffff" />
        <circle cx="12.2" cy="16.3" r=".95" fill={ink} />
        <circle cx="19.8" cy="16.3" r=".95" fill={ink} />
        <circle cx="11.8" cy="15.8" r=".4" fill="#fff" />
        <circle cx="19.4" cy="15.8" r=".4" fill="#fff" />
      </g>

      {/* Nose and cheerful mouth */}
      <ellipse cx="16" cy="19.6" rx="1.6" ry="1.1" fill={ink} />
      <circle cx="15.5" cy="19.3" r=".3" fill="#fff" opacity=".5" />
      <path className="dg-pet-sig dg-pet-sig-panda dg-pet-mouth-base" d="M16 20.7v.8M16 21.5q-1.4.9-2.1 0M16 21.5q1.4.9 2.1 0" fill="none" stroke={ink} strokeWidth=".85" strokeLinecap="round" />

      {/* Blushing cheeks */}
      <ellipse cx="8.8" cy="19.6" rx="1.5" ry=".85" fill="#f4b2be" opacity=".5" />
      <ellipse cx="23.2" cy="19.6" rx="1.5" ry=".85" fill="#f4b2be" opacity=".5" />

      {/* Front paws holding bamboo */}
      <ellipse cx="11.4" cy="27.4" rx="2.2" ry="1.4" fill={black} stroke={ink} strokeWidth=".85" />
      <ellipse cx="20.6" cy="27.4" rx="2.2" ry="1.4" fill={black} stroke={ink} strokeWidth=".85" />

      {/* Fresh leafy bamboo stalk */}
      <g className="dg-pet-accessory">
        <path d="M22.8 28.2c1.8-3.4 3-6.2 3.4-8.8" fill="none" stroke="#488c42" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M24.2 23.4q2.4-2.8 4.2-1.4-1.2 2.8-3.6 2z" fill="#69b85c" stroke={ink} strokeWidth=".4" />
        <path d="M25.6 20.2q2.2-2.4 3.8-1.2-.8 2.6-3.2 1.8z" fill="#7ecb6f" stroke={ink} strokeWidth=".4" />
      </g>
      <PetExpression left={12} right={20} y={16.2} mouthY={21.5} ink="#252333" />
      <PetGesture fur="#313646" />
    </svg>
  );
}

function Chick() {
  const id = "ck" + useId().replace(/\W/g, "");
  const ink = "#261c10";
  const coat = `url(#${id}-down)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-down`} cx="38%" cy="26%" r="80%">
          <stop offset="0" stopColor="#fff282" />
          <stop offset=".56" stopColor="#fcd346" />
          <stop offset="1" stopColor="#e5a41b" />
        </radialGradient>
      </defs>

      {/* Head feather crest tufts */}
      <path className="dg-pet-tuft" d="M14 4.8l1.4 4.6h-3.8z" fill="#fcd346" stroke={ink} strokeWidth=".9" strokeLinejoin="round" />
      <path className="dg-pet-tuft" d="M18 4.8l-1.4 4.6h3.8z" fill="#fcd346" stroke={ink} strokeWidth=".9" strokeLinejoin="round" />

      {/* Soft downy winglets */}
      <g className="dg-pet-wing dg-pet-wing-left">
        <path d="M8.2 18.2c-3.4.6-3.8 4.8-1.2 5.8 1.8.6 3.2-1.8 2.8-4.8z" fill="#f0c136" stroke={ink} strokeWidth="1.1" strokeLinejoin="round" />
      </g>
      <g className="dg-pet-wing dg-pet-wing-right">
        <path d="M23.8 18.2c3.4.6 3.8 4.8 1.2 5.8-1.8.6-3.2-1.8-2.8-4.8z" fill="#f0c136" stroke={ink} strokeWidth="1.1" strokeLinejoin="round" />
      </g>

      {/* Round plump body */}
      <circle className="dg-pet-face" cx="16" cy="18" r="10.2" fill={coat} stroke={ink} strokeWidth="1.25" />
      <ellipse cx="12" cy="12.2" rx="3.2" ry="1.8" fill="#fff" opacity=".25" transform="rotate(-24 12 12.2)" />
      {/* Cream belly patch */}
      <ellipse cx="16" cy="21.6" rx="5.6" ry="4.8" fill="#fff5ab" opacity=".75" />

      {/* Big round curious eyes */}
      <g className="dg-pet-eyes">
        <circle cx="12.4" cy="16.2" r="2.1" fill={ink} />
        <circle cx="19.6" cy="16.2" r="2.1" fill={ink} />
        <circle cx="11.7" cy="15.3" r=".85" fill="#fff" />
        <circle cx="18.9" cy="15.3" r=".85" fill="#fff" />
        <circle cx="12.9" cy="16.9" r=".35" fill="#fff" opacity=".85" />
        <circle cx="20.1" cy="16.9" r=".35" fill="#fff" opacity=".85" />
      </g>

      {/* Chirping beak */}
      <path className="dg-pet-sig dg-pet-sig-chick" d="M16 17.8l-2.4 1.8h4.8z" fill="#f0883b" stroke={ink} strokeWidth=".65" strokeLinejoin="round" />
      <path d="M16 19.6v1.2" fill="none" stroke={ink} strokeWidth=".65" strokeLinecap="round" />

      {/* Rosy blush cheeks */}
      <circle cx="9.6" cy="19.6" r="1.6" fill="#f89d6e" opacity=".65" />
      <circle cx="22.4" cy="19.6" r="1.6" fill="#f89d6e" opacity=".65" />

      {/* Cute orange feet */}
      <ellipse cx="12.4" cy="27.8" rx="2.5" ry="1.1" fill="#f0883b" stroke={ink} strokeWidth=".85" />
      <ellipse cx="19.6" cy="27.8" rx="2.5" ry="1.1" fill="#f0883b" stroke={ink} strokeWidth=".85" />

      {/* Bow tie accessory */}
      <path className="dg-pet-accessory" d="M16 23.8l-2.4-1.5-1.6 1.7 1.6 1.5 2.4-1.3 2.4 1.3 1.6-1.5-1.6-1.7z" fill="#e2564c" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
      <circle className="dg-pet-accessory" cx="16" cy="23.8" r=".9" fill="#f6ca59" stroke={ink} strokeWidth=".4" />
      <PetExpression left={12.4} right={19.6} y={16.2} mouthY={21} ink="#252333" beak />
    </svg>
  );
}

function Koala() {
  const id = "kl" + useId().replace(/\W/g, "");
  const ink = "#20232a";
  const fur = `url(#${id}-fur)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-fur`} cx="38%" cy="26%" r="80%">
          <stop offset="0" stopColor="#c8d2df" />
          <stop offset=".58" stopColor="#aab4c4" />
          <stop offset="1" stopColor="#8792a4" />
        </radialGradient>
      </defs>

      {/* Fluffy scalloped ears with tufted white fur rims */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <circle cx="7.2" cy="10" r="5.6" fill={fur} stroke={ink} strokeWidth="1.2" />
        <g className="dg-pet-sig dg-pet-sig-koala">
          <circle cx="7.2" cy="10" r="3.6" fill="#edf1f6" />
          <path d="M3.8 8.2q1.5-1.4 3.4-1.1M5.6 12q1.5.8 3.2.4" fill="none" stroke="#ffffff" strokeWidth=".85" strokeLinecap="round" />
        </g>
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <circle cx="24.8" cy="10" r="5.6" fill={fur} stroke={ink} strokeWidth="1.2" />
        <g className="dg-pet-sig dg-pet-sig-koala">
          <circle cx="24.8" cy="10" r="3.6" fill="#edf1f6" />
          <path d="M28.2 8.2q-1.5-1.4-3.4-1.1M26.4 12q-1.5.8-3.2.4" fill="none" stroke="#ffffff" strokeWidth=".85" strokeLinecap="round" />
        </g>
      </g>

      {/* Chubby round head with cheek tufts */}
      <path
        className="dg-pet-face"
        d="M16 7.6c5.8 0 9.8 3.6 10 9.2l1.6 1.4-1.8 1.1c-.5 4.4-4 7.2-9.8 7.2s-9.3-2.8-9.8-7.2L4.4 19.3l1.6-1.4C6.2 11.2 10.2 7.6 16 7.6z"
        fill={fur}
        stroke={ink}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <ellipse cx="12" cy="12" rx="3.2" ry="1.8" fill="#fff" opacity=".2" transform="rotate(-22 12 12)" />

      {/* Soft cream muzzle and blushing cheeks */}
      <ellipse cx="16" cy="20.8" rx="6.2" ry="5.2" fill="#edf1f6" />
      <ellipse cx="9.6" cy="19.8" rx="1.6" ry="1.2" fill="#d2b8c5" opacity=".45" />
      <ellipse cx="22.4" cy="19.8" rx="1.6" ry="1.2" fill="#d2b8c5" opacity=".45" />

      {/* Gentle dark eyes */}
      <g className="dg-pet-eyes">
        <circle cx="12.2" cy="16.4" r="1.95" fill={ink} />
        <circle cx="19.8" cy="16.4" r="1.95" fill={ink} />
        <circle cx="11.6" cy="15.6" r=".75" fill="#fff" />
        <circle cx="19.2" cy="15.6" r=".75" fill="#fff" />
        <circle cx="12.7" cy="17" r=".32" fill="#fff" opacity=".8" />
        <circle cx="20.3" cy="17" r=".32" fill="#fff" opacity=".8" />
      </g>

      {/* Iconic large leathery dark slate koala nose */}
      <path d="M13.8 18.5c0-1.6 1-2.4 2.2-2.4s2.2.8 2.2 2.4c0 2-1 3.4-2.2 3.4s-2.2-1.4-2.2-3.4z" fill="#3a4250" stroke={ink} strokeWidth=".6" strokeLinejoin="round" />
      <ellipse cx="15.2" cy="17.6" rx=".5" ry=".28" fill="#fff" opacity=".35" transform="rotate(-18 15.2 17.6)" />

      {/* Sweet smile */}
      <path className="dg-pet-mouth-base" d="M13.8 23q2.2 1.6 4.4 0" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />

      {/* Eucalyptus sprig accessory */}
      <g className="dg-pet-accessory">
        <path d="M21.8 25c2.6-3.4 4.6-3 5-1.8.4 1.2-1.4 2-2.2 3.2 1-.5 2.2 0 1.9 1-.5 1.6-3 1.6-4.7.2z" fill="#6ba86b" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
        <path d="M22.6 25.2q1.6-1.5 3.2-1.8M23 26.2q1.4-.5 2.5-.4" fill="none" stroke="#487848" strokeWidth=".5" strokeLinecap="round" />
      </g>
      <PetExpression left={12.2} right={19.8} y={16.4} mouthY={23} ink="#252333" />
    </svg>
  );
}

function Otter() {
  const id = "ot" + useId().replace(/\W/g, "");
  const ink = "#241812";
  const pelt = `url(#${id}-pelt)`;
  const cream = "#f4dfca";
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-pelt`} cx="38%" cy="26%" r="80%">
          <stop offset="0" stopColor="#b67e56" />
          <stop offset=".56" stopColor="#96603a" />
          <stop offset="1" stopColor="#754322" />
        </radialGradient>
      </defs>

      {/* Swimming rudder tail curving behind */}
      <g className="dg-pet-tail">
        <path d="M21.6 22.8c5.6-.8 6.8 3.2 4.4 5-2 1.6-5.4.2-4.6-1.2.6-1 2.8.4 3-1.2.2-1.2-1-1.6-2.8-1z" fill={pelt} stroke={ink} strokeWidth="1.15" strokeLinejoin="round" />
      </g>

      {/* Small rounded ears with dark rims */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <circle cx="8.8" cy="10.6" r="3.4" fill={pelt} stroke={ink} strokeWidth="1.15" />
        <circle cx="8.8" cy="10.6" r="1.8" fill={cream} />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <circle cx="23.2" cy="10.6" r="3.4" fill={pelt} stroke={ink} strokeWidth="1.15" />
        <circle cx="23.2" cy="10.6" r="1.8" fill={cream} />
      </g>

      {/* Flattened wedge head */}
      <ellipse className="dg-pet-face" cx="16" cy="18.2" rx="10.4" ry="9.6" fill={pelt} stroke={ink} strokeWidth="1.25" strokeLinejoin="round" />
      <ellipse cx="12" cy="13.2" rx="3.4" ry="1.8" fill="#fff" opacity=".2" transform="rotate(-20 12 13.2)" />

      {/* Wide cream muzzle with whiskered grin */}
      <ellipse className="dg-pet-sig dg-pet-sig-otter" cx="16" cy="21.4" rx="7.2" ry="5.2" fill={cream} stroke={ink} strokeWidth=".85" />
      <ellipse cx="12.6" cy="21.8" rx="3" ry="3" fill="#fff4e8" opacity=".75" />
      <ellipse cx="19.4" cy="21.8" rx="3" ry="3" fill="#fff4e8" opacity=".75" />

      {/* Expressive eyes */}
      <g className="dg-pet-eyes">
        <circle cx="12.2" cy="16.4" r="1.9" fill={ink} />
        <circle cx="19.8" cy="16.4" r="1.9" fill={ink} />
        <circle cx="11.6" cy="15.6" r=".75" fill="#fff" />
        <circle cx="19.2" cy="15.6" r=".75" fill="#fff" />
        <circle cx="12.7" cy="17" r=".32" fill="#fff" opacity=".85" />
        <circle cx="20.3" cy="17" r=".32" fill="#fff" opacity=".85" />
      </g>

      {/* Dark button nose and mouth */}
      <path d="M14.2 19.4c0-1 .8-1.6 1.8-1.6s1.8.6 1.8 1.6c0 1.1-.8 1.8-1.8 1.8s-1.8-.7-1.8-1.8z" fill={ink} />
      <circle cx="15.5" cy="19.1" r=".3" fill="#fff" opacity=".5" />
      <path className="dg-pet-mouth-base" d="M16 21.3v1.2M16 22.5q-1.6 1-2.2-.2M16 22.5q1.6 1 2.2-.2" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />

      {/* Whiskers */}
      <path d="M6.6 19.6h4.4M6.6 21.6l4.4-.7M21 19.6h4.4M21 20.9l4.4.7" stroke={ink} strokeWidth=".7" strokeLinecap="round" opacity=".75" />

      {/* Coral collar with bell */}
      <path className="dg-pet-accessory" d="M10.2 25c3.6 1.4 8 1.4 11.6 0l.35 1.5c-3.9 1.6-8.3 1.6-12.3 0z" fill="#e26c54" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
      <circle className="dg-pet-accessory" cx="16" cy="26.8" r="1.1" fill="#f6ca59" stroke={ink} strokeWidth=".4" />
      <PetExpression left={12.2} right={19.8} y={16.4} mouthY={22.5} ink="#252333" />
      <PetGesture fur="#b17a50" />
    </svg>
  );
}

function Rover() {
  const id = "rv" + useId().replace(/\W/g, "");
  const ink = "#1a212b";
  const metal = `url(#${id}-metal)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d5e0ee" />
          <stop offset=".5" stopColor="#a3b8cd" />
          <stop offset="1" stopColor="#778ca1" />
        </linearGradient>
      </defs>

      {/* Rear tank treads */}
      <g className="dg-pet-tail">
        <rect x="5.6" y="21.6" width="4.4" height="6.4" rx="2.2" fill="#323e4d" stroke={ink} strokeWidth="1.1" />
        <rect x="22" y="21.6" width="4.4" height="6.4" rx="2.2" fill="#323e4d" stroke={ink} strokeWidth="1.1" />
      </g>

      {/* Swivel speaker/sensor ear housings */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <rect x="3.4" y="12.6" width="4.4" height="7.2" rx="2.2" fill={metal} stroke={ink} strokeWidth="1.15" />
        <path d="M4.6 14.6h2M4.6 16.2h2M4.6 17.8h2" stroke="#3a4858" strokeWidth=".75" strokeLinecap="round" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <rect x="24.2" y="12.6" width="4.4" height="7.2" rx="2.2" fill={metal} stroke={ink} strokeWidth="1.15" />
        <path d="M25.4 14.6h2M25.4 16.2h2M25.4 17.8h2" stroke="#3a4858" strokeWidth=".75" strokeLinecap="round" />
      </g>

      {/* Main chassis box with rounded corners */}
      <rect className="dg-pet-face" x="7.2" y="9.6" width="17.6" height="13.4" rx="4.8" fill={metal} stroke={ink} strokeWidth="1.25" />
      <path d="M8.6 11.4c.6-.9 1.6-1.5 2.8-1.7h9.2c1.2.2 2.2.8 2.8 1.7z" fill="#ffffff" opacity=".35" />

      {/* OLED visor screen */}
      <rect x="9.2" y="12.6" width="13.6" height="7.4" rx="2.4" fill="#1c2530" stroke={ink} strokeWidth=".85" />
      <rect x="9.4" y="12.8" width="13.2" height="2.2" rx="1.1" fill="#2d3a48" opacity=".7" />

      {/* Glowing cyan digital eyes */}
      <g className="dg-pet-eyes">
        <circle cx="12.6" cy="16.3" r="2.1" fill="#46d9ed" />
        <circle cx="19.4" cy="16.3" r="2.1" fill="#46d9ed" />
        <circle cx="12.6" cy="16.3" r="1.1" fill="#1c2530" />
        <circle cx="19.4" cy="16.3" r="1.1" fill="#1c2530" />
        <circle cx="12.9" cy="15.8" r=".4" fill="#ffffff" />
        <circle cx="19.7" cy="15.8" r=".4" fill="#ffffff" />
      </g>

      {/* Status LED */}
      <circle className="dg-pet-sig dg-pet-sig-rover" cx="9.4" cy="11.6" r=".95" fill="#46ed96" stroke={ink} strokeWidth=".4" />

      {/* Chassis smile curve */}
      <path className="dg-pet-mouth-base" d="M13.6 20.8q2.4 1.5 4.8 0" fill="none" stroke="#485c70" strokeWidth=".85" strokeLinecap="round" />

      {/* Lower base and front tracks */}
      <rect x="8.4" y="22.2" width="15.2" height="6.2" rx="2.8" fill="#323e4d" stroke={ink} strokeWidth="1.15" />
      <path d="M10.8 25.2h2.6m2 0h2.6m2 0h2.6" stroke="#8fa0b2" strokeWidth=".95" strokeLinecap="round" />

      {/* Top antenna beacon accessory */}
      <g className="dg-pet-accessory dg-pet-antenna">
        <path d="M16 9.6V5.8m0 0 1.6-1.6" stroke={ink} strokeWidth="1.1" strokeLinecap="round" fill="none" />
        <circle cx="18" cy="4.4" r="1.3" fill="#f4c45e" stroke={ink} strokeWidth=".4" />
      </g>
      <PetExpression left={12.6} right={19.4} y={16.3} mouthY={20.8} ink="#46d9ed" digital />
    </svg>
  );
}

function Raccoon() {
  const id = "rc" + useId().replace(/\W/g, "");
  const ink = "#1c2027";
  const coat = `url(#${id}-coat)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-coat`} cx="38%" cy="26%" r="80%">
          <stop offset="0" stopColor="#c5cbd6" />
          <stop offset=".56" stopColor="#9fa8b8" />
          <stop offset="1" stopColor="#757f91" />
        </radialGradient>
      </defs>

      {/* Bold ringed tail with high-contrast stripes */}
      <g className="dg-pet-tail">
        <path d="M21.8 22.8c5.4-.9 6.8 2.6 4.8 4.6-1.8 1.8-5.2.6-4.6-.8.4-1 2.6.2 3-1.2.3-1.2-1-1.6-3.2-1.1z" fill={coat} stroke={ink} strokeWidth="1.15" strokeLinejoin="round" />
        <path d="M23.8 23c1 .3 1.8.9 2.1 1.7l-1.5 3.1c-.8.1-1.6 0-2.2-.4zM26.8 24.3c.3.9.2 1.8-.4 2.7l-1.1-.4z" fill="#242832" />
      </g>

      {/* Pointed ears with white rims and pink interior */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M11.6 10.2 5.6 5.6 6.6 13.2z" fill="#586273" stroke={ink} strokeWidth="1.15" strokeLinejoin="round" />
        <path d="M10.4 10.4 7.4 7.8l.6 3.8z" fill="#f2c4d2" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M20.4 10.2 26.4 5.6 25.4 13.2z" fill="#586273" stroke={ink} strokeWidth="1.15" strokeLinejoin="round" />
        <path d="M21.6 10.4l3-2.6-.6 3.8z" fill="#f2c4d2" />
      </g>

      {/* Head with cheek flares */}
      <path
        className="dg-pet-face"
        d="M16 7.6c5.6 0 9.4 3.6 9.8 9l1.6 1.4-1.8 1.1c-.5 4.4-3.8 7-9.6 7s-9.1-2.6-9.6-7L4.6 19l1.6-1.4C6.6 11.2 10.4 7.6 16 7.6z"
        fill={coat}
        stroke={ink}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <ellipse cx="12" cy="11.4" rx="3.2" ry="1.8" fill="#fff" opacity=".22" transform="rotate(-22 12 11.4)" />

      {/* White brow band and iconic black bandit mask */}
      <path d="M8.8 13.8c2.2-1.5 4.6-.6 7.2.3 2.6-.9 4.9-1.8 7.2-.3l-.5 1.6c-2.2-1.2-4.3-.5-6.7.4-2.4-.9-4.5-1.6-6.7-.4z" fill="#ffffff" opacity=".8" />
      <path d="M8.4 15.6c2.8-2.6 5.2-.8 7.6.2 2.4-1 4.8-2.8 7.6-.2l-1.2 5.4c-2.4 1.2-4.3.2-6.4-.5-2.1.7-4 1.7-6.4.5z" fill="#262b35" stroke={ink} strokeWidth=".85" strokeLinejoin="round" />

      {/* Eyes inside mask with white eye-rings */}
      <g className="dg-pet-eyes">
        <ellipse cx="12" cy="16.8" rx="2.1" ry="2.3" fill="#ffffff" />
        <ellipse cx="20" cy="16.8" rx="2.1" ry="2.3" fill="#ffffff" />
        <circle cx="12.2" cy="16.8" r="1.3" fill={ink} />
        <circle cx="19.8" cy="16.8" r="1.3" fill={ink} />
        <circle cx="11.7" cy="16.2" r=".5" fill="#fff" />
        <circle cx="19.3" cy="16.2" r=".5" fill="#fff" />
      </g>

      {/* Pointed white muzzle and sniffing nose */}
      <ellipse cx="16" cy="22.2" rx="4.8" ry="3.6" fill="#f4f6fa" stroke={ink} strokeWidth=".7" />
      <ellipse className="dg-pet-sig dg-pet-sig-raccoon" cx="16" cy="20.4" rx="1.6" ry="1.1" fill={ink} />
      <path className="dg-pet-mouth-base" d="M16 21.6v.8M16 22.4q-1.4 1-2.2 0M16 22.4q1.4 1 2.2 0" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />

      {/* Whiskers */}
      <path d="M9.2 21h-3M9.4 22.4l-2.8.6M22.8 21h3M22.6 22.4l2.8.6" fill="none" stroke="#778091" strokeWidth=".65" strokeLinecap="round" />

      {/* Crimson collar accessory */}
      <path className="dg-pet-accessory" d="M10.2 25.2c3.6 1.4 8 1.4 11.6 0l.35 1.5c-3.9 1.6-8.3 1.6-12.3 0z" fill="#cf4e46" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
      <circle className="dg-pet-accessory" cx="16" cy="26.8" r="1.1" fill="#f6ca59" stroke={ink} strokeWidth=".4" />
      <PetExpression left={12} right={20} y={16.8} mouthY={22.4} ink="#252333" />
      <PetGesture fur="#9099ab" />
    </svg>
  );
}

function Axolotl() {
  const id = "ax" + useId().replace(/\W/g, "");
  const ink = "#321626";
  const body = `url(#${id}-body)`;
  const gill = `url(#${id}-gill)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-body`} cx="38%" cy="26%" r="80%">
          <stop offset="0" stopColor="#ffe2ee" />
          <stop offset=".56" stopColor="#faa3c7" />
          <stop offset="1" stopColor="#e274a2" />
        </radialGradient>
        <linearGradient id={`${id}-gill`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e85b98" />
          <stop offset="1" stopColor="#f7387f" />
        </linearGradient>
      </defs>

      {/* Floating magical water bubbles */}
      <g className="dg-pet-sig dg-pet-sig-axolotl-bubbles" fill="none" stroke="#fce4f0" strokeWidth=".85">
        <circle cx="26.2" cy="7.4" r="1.3" />
        <circle cx="28.4" cy="11.2" r=".75" />
        <circle cx="4.8" cy="12.6" r=".8" />
      </g>

      {/* Dorsal tail fin */}
      <path className="dg-pet-tail" d="M22.5 21.5c5.4-.9 6.8 3.8 3.9 5.4-2.4 1.3-4.8-.8-3.2-1.7 1.1-.6 2.5.8 2.9-.5.3-1-1.3-1.6-3.3-1z" fill="#d2588f" stroke={ink} strokeWidth="1.1" strokeLinejoin="round" />

      {/* Feathery external gills with coral frills */}
      <g className="dg-pet-ear dg-pet-ear-left dg-pet-sig dg-pet-sig-axolotl-gill" fill={gill} stroke={ink} strokeWidth=".85" strokeLinejoin="round">
        <path d="M8.6 12.6 3.2 9.2l2.2-1.4-3.4-2.2 2.2-1.2 5.4 4.4z" />
        <path d="m8.4 16.4-6.2 1.4 1.2 2-3.8.7 1.8 1.8 7-1.1z" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right dg-pet-sig dg-pet-sig-axolotl-gill" fill={gill} stroke={ink} strokeWidth=".85" strokeLinejoin="round">
        <path d="m23.4 12.6 5.4-3.4-2.2-1.4 3.4-2.2-2.2-1.2-5.4 4.4z" />
        <path d="m23.6 16.4 6.2 1.4-1.2 2 3.8.7-1.8 1.8-7-1.1z" />
      </g>

      {/* Broad soft round head */}
      <path
        className="dg-pet-face"
        d="M16 8.2c6.2 0 10.2 4 10.2 9.4 0 5.8-4.3 9.4-10.2 9.4s-10.2-3.6-10.2-9.4c0-5.4 4-9.4 10.2-9.4z"
        fill={body}
        stroke={ink}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <ellipse cx="12" cy="12.2" rx="3.2" ry="1.8" fill="#fff" opacity=".25" transform="rotate(-22 12 12.2)" />

      {/* Head frill highlights */}
      <path d="M10 11.2c1.2-1.4 2.4-2 3.4-2.2M22 11.2c-1.2-1.4-2.4-2-3.4-2.2" fill="none" stroke="#ffe2f0" strokeWidth="1.15" strokeLinecap="round" />

      {/* Soft lighter muzzle */}
      <ellipse cx="16" cy="20.8" rx="6.8" ry="4.6" fill="#ffd1e4" />

      {/* Glossy dark bead eyes with sparkle */}
      <g className="dg-pet-eyes">
        <circle cx="11.8" cy="16.4" r="1.6" fill={ink} />
        <circle cx="20.2" cy="16.4" r="1.6" fill={ink} />
        <circle cx="11.3" cy="15.8" r=".6" fill="#fff" />
        <circle cx="19.7" cy="15.8" r=".6" fill="#fff" />
      </g>

      {/* Blushing pink cheek spots */}
      <circle cx="9.4" cy="19.2" r="1.2" fill="#ef6699" opacity=".6" />
      <circle cx="22.6" cy="19.2" r="1.2" fill="#ef6699" opacity=".6" />

      {/* Sweet derpy wide smile */}
      <path className="dg-pet-mouth-base" d="M16 19.4v1.4m0 0q-1.8 1.4-2.8 0m2.8 0q1.8 1.4 2.8 0" fill="none" stroke={ink} strokeWidth=".85" strokeLinecap="round" />

      {/* Sea-pearl collar accessory */}
      <path className="dg-pet-accessory" d="M10 24.4c3.8 1.4 8.2 1.4 12 0l.4 1.6c-4 1.6-8.8 1.6-12.8 0z" fill="#7a58d8" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
      <PetExpression left={11.8} right={20.2} y={16.4} mouthY={20.8} ink="#252333" />
    </svg>
  );
}

// The two premium companions — the level 11 and 12 unlocks. The rest of the
// roster is flat colour on a bob; these earn gradients, a full-body pose and a
// signature motion *sequence* (see styles.css §Spark & Leafy). Originals,
// drawn in the spirit of the obvious licensed pair rather than copies of it.
//
// Gradient and clip ids come from useId so two instances on one page (the
// greeting chip and the pet-page hero, say) never reference each other's defs.

function Spark() {
  const id = "sp" + useId().replace(/\W/g, "");
  const ink = "#261a0e";
  const body = `url(#${id}-body)`;
  const bolt = `url(#${id}-bolt)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-body`} cx="40%" cy="34%" r="72%">
          <stop offset="0" stopColor="#ffe873" />
          <stop offset=".55" stopColor="#f9cd3a" />
          <stop offset="1" stopColor="#e3a41a" />
        </radialGradient>
        <radialGradient id={`${id}-cheek`} cx="38%" cy="36%" r="70%">
          <stop offset="0" stopColor="#ff8068" />
          <stop offset="1" stopColor="#d1382a" />
        </radialGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#ffd543" stopOpacity=".95" />
          <stop offset=".55" stopColor="#ffb52e" stopOpacity=".42" />
          <stop offset="1" stopColor="#ffb52e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-bolt`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7b4" />
          <stop offset="1" stopColor="#ffc41a" />
        </linearGradient>
      </defs>

      {/* Shockwave: a ring that bursts outward from the head on the beat. */}
      <circle className="dg-pet-zap" cx="16" cy="17.5" r="12.4" fill="none" stroke="#ffe066" strokeWidth=".8" opacity=".18" />

      {/* Bolt tail with crisp inky outline and 3D bevel highlight */}
      <g className="dg-pet-tail dg-pet-bolt-tail">
        <path d="M22.6 22.6 25.8 16.4 23.3 16 27.9 8.1 30.2 9.1 28.2 13.6 30.9 14.3 25.5 23.4z" fill={bolt} stroke={ink} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M22.6 22.6 24.6 18.7 26.9 19.5 25.5 23.4z" fill="#7a461e" />
        <path d="M25.8 16.4l2.1-7.3 2.3 1-2 4.5 2.7.7-5.4 9.1" fill="none" stroke="#fffbcf" strokeWidth=".65" strokeLinecap="round" opacity=".8" />
      </g>

      {/* Shoulders, feet and tucked arms with inky contours and toe details */}
      <ellipse cx="16" cy="26.4" rx="7.4" ry="4.4" fill={body} stroke={ink} strokeWidth="1.1" strokeLinejoin="round" />
      <ellipse cx="11.8" cy="29.3" rx="2.7" ry="1.35" fill="#f5b82a" stroke={ink} strokeWidth=".85" />
      <path d="M11.2 29.5v.7M12.4 29.5v.7" stroke={ink} strokeWidth=".45" strokeLinecap="round" opacity=".6" />
      <ellipse cx="20.2" cy="29.3" rx="2.7" ry="1.35" fill="#f5b82a" stroke={ink} strokeWidth=".85" />
      <path d="M19.6 29.5v.7M20.8 29.5v.7" stroke={ink} strokeWidth=".45" strokeLinecap="round" opacity=".6" />
      <ellipse cx="9.4" cy="25.6" rx="1.7" ry="2.5" fill="#f5b82a" stroke={ink} strokeWidth=".7" transform="rotate(24 9.4 25.6)" />
      <ellipse cx="22.6" cy="25.6" rx="1.7" ry="2.5" fill="#f5b82a" stroke={ink} strokeWidth=".7" transform="rotate(-24 22.6 25.6)" />

      {/* Long ears, black-tipped with crisp outlines */}
      <g className="dg-pet-ear dg-pet-ear-left dg-pet-zap-ear-l">
        <path d="M12.6 9.2 5.1 1 8.1 11.6z" fill={body} stroke={ink} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M7.9 9.8 6.6 5.6 9.9 7.9z" fill="#fff" opacity=".2" />
        <path d="M5.1 1 8.1 4.3 6.3 5.2z" fill="#241a24" stroke={ink} strokeWidth=".6" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right dg-pet-zap-ear-r">
        <path d="M19.4 9.2 26.9 1 23.9 11.6z" fill={body} stroke={ink} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M24.1 9.8 25.4 5.6 22.1 7.9z" fill="#fff" opacity=".2" />
        <path d="M26.9 1 23.9 4.3 25.7 5.2z" fill="#241a24" stroke={ink} strokeWidth=".6" />
      </g>

      <circle className="dg-pet-face dg-pet-zap-head" cx="16" cy="17.2" r="9.8" fill={body} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
      <ellipse cx="12.2" cy="11.6" rx="3.4" ry="2" fill="#fff" opacity=".22" transform="rotate(-20 12.2 11.6)" />

      {/* Cheeks: gradient disc over glow with bright electric catchlights */}
      <circle className="dg-pet-charge" cx="9.7" cy="20.2" r="4.2" fill={`url(#${id}-glow)`} />
      <circle className="dg-pet-charge dg-pet-charge-b" cx="22.3" cy="20.2" r="4.2" fill={`url(#${id}-glow)`} />
      <circle cx="9.7" cy="20.2" r="2.35" fill={`url(#${id}-cheek)`} stroke="#a82b1e" strokeWidth=".4" />
      <circle cx="22.3" cy="20.2" r="2.35" fill={`url(#${id}-cheek)`} stroke="#a82b1e" strokeWidth=".4" />
      <circle cx="9.2" cy="19.6" r=".55" fill="#ffffff" opacity=".9" />
      <circle cx="21.8" cy="19.6" r=".55" fill="#ffffff" opacity=".9" />

      {/* Electric spark bolts on the beat and static crackle */}
      <g fill={bolt} stroke="#e9a80e" strokeWidth=".4" strokeLinejoin="round">
        <path className="dg-pet-spark" d="M5.6 15.6 2.4 19.9h2.3L3.2 23.5l3.9-4.6H4.8z" />
        <path className="dg-pet-spark dg-pet-spark-b" d="M2.6 22.6.9 25.1h1.4l-1 2.2 2.4-2.9H2.4z" />
        <path className="dg-pet-spark dg-pet-spark-c" d="M26.4 15.6 29.6 19.9h-2.3l1.5 3.6-3.9-4.6h2.3z" />
        <path className="dg-pet-spark dg-pet-spark-d" d="M29.4 22.6 31.1 25.1h-1.4l1 2.2-2.4-2.9h1.3z" />
        <path className="dg-pet-static" d="M3.4 3.2 2 5.3h1.1l-.7 1.8 2-2.4H3.3z" />
        <path className="dg-pet-static dg-pet-static-b" d="M28.6 3.2 30 5.3h-1.1l.7 1.8-2-2.4h1.1z" />
      </g>

      <g className="dg-pet-eyes">
        <ellipse cx="12.5" cy="16.2" rx="1.95" ry="2.2" fill={EYE} />
        <ellipse cx="19.5" cy="16.2" rx="1.95" ry="2.2" fill={EYE} />
        <circle cx="13.2" cy="15.3" r=".7" fill="#fff" />
        <circle cx="20.2" cy="15.3" r=".7" fill="#fff" />
        <circle cx="11.9" cy="17.3" r=".32" fill="#fff" opacity=".8" />
        <circle cx="18.9" cy="17.3" r=".32" fill="#fff" opacity=".8" />
      </g>

      {/* Open, delighted mouth */}
      <path d="M16 18.3l-.7.9h1.4z" fill="#4a3a1c" />
      <path className="dg-pet-mouth-base" d="M13.3 20.3q2.7 3.4 5.4 0z" fill="#5a2a1c" />
      <path className="dg-pet-mouth-base" d="M14.5 21.3q1.5 1.9 3 0z" fill="#ef6a72" />
      <path className="dg-pet-mouth-base" d="M13.3 20.3q2.7 3.4 5.4 0" fill="none" stroke="#4a3a1c" strokeWidth=".85" strokeLinecap="round" />

      {/* Navy band with bolt charm */}
      <path className="dg-pet-accessory" d="M10.2 24.7c3.6 1.5 8 1.5 11.6 0l.35 1.55c-3.9 1.7-8.4 1.7-12.3 0z" fill="#2d3b66" stroke={ink} strokeWidth=".55" strokeLinejoin="round" />
      <path className="dg-pet-accessory" d="M16.5 25.3 15.2 27.4h1l-.6 1.7 1.8-2.3h-1z" fill="#ffd23f" stroke={ink} strokeWidth=".4" />
      <PetExpression left={12.5} right={19.5} y={16.2} mouthY={20.3} ink="#4a3a1c" />
    </svg>
  );
}

function Leafy() {
  const id = "lf" + useId().replace(/\W/g, "");
  const ink = "#142a22";
  const leaf = "M0 0c.9-1.4 2.4-1.6 3.1-.4-.8 1.1-2.3 1.3-3.1.4z";
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-skin`} cx="38%" cy="30%" r="78%">
          <stop offset="0" stopColor="#ace6dc" />
          <stop offset=".5" stopColor="#7ec8be" />
          <stop offset="1" stopColor="#529b92" />
        </radialGradient>
        <radialGradient id={`${id}-bulb`} cx="42%" cy="32%" r="75%">
          <stop offset="0" stopColor="#a8e88f" />
          <stop offset=".5" stopColor="#62bd62" />
          <stop offset="1" stopColor="#34883f" />
        </radialGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#a6f58e" stopOpacity=".9" />
          <stop offset=".6" stopColor="#7fdc73" stopOpacity=".32" />
          <stop offset="1" stopColor="#7fdc73" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-eye`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#f46c60" />
          <stop offset="1" stopColor="#a4241e" />
        </radialGradient>
        <clipPath id={`${id}-clip`}><ellipse cx="16" cy="8.8" rx="8.6" ry="7" /></clipPath>
      </defs>

      {/* Bulb glow: a slow breath of light behind the bulb. */}
      <ellipse className="dg-pet-glow" cx="16" cy="8.8" rx="11" ry="9" fill={`url(#${id}-glow)`} />

      {/* Spores lift off the bulb and fade */}
      <g fill="#b9efa8" opacity=".9">
        <g transform="translate(11.2 3.4)"><path className="dg-pet-spore" d={leaf} /></g>
        <g transform="translate(17.4 1.2)"><path className="dg-pet-spore dg-pet-spore-b" d={leaf} /></g>
        <g transform="translate(20.6 5)"><circle className="dg-pet-spore dg-pet-spore-c" r=".65" /></g>
      </g>

      {/* Vine whips with inky stems */}
      <g className="dg-pet-whip dg-pet-whip-left">
        <path className="dg-pet-vine" pathLength="1" strokeDasharray="1" d="M9.8 7c-3.2 0-6 1.4-6.9 4.2-.4 1.3.3 2.6 1.5 3" fill="none" stroke="#2c7033" strokeWidth="1.45" strokeLinecap="round" />
        <path className="dg-pet-vine-leaf" d="M4.4 14.2c-1.9-.2-3.1-1.5-2.9-3.4 1.8 0 3 1.4 2.9 3.4z" fill="#8fd58c" stroke={ink} strokeWidth=".4" />
      </g>
      <g className="dg-pet-whip dg-pet-whip-right">
        <path className="dg-pet-vine dg-pet-vine-b" pathLength="1" strokeDasharray="1" d="M22.2 7c3.2 0 6 1.4 6.9 4.2.4 1.3-.3 2.6-1.5 3" fill="none" stroke="#2c7033" strokeWidth="1.45" strokeLinecap="round" />
        <path className="dg-pet-vine-leaf dg-pet-vine-b" d="M27.6 14.2c1.9-.2 3.1-1.5 2.9-3.4-1.8 0-3 1.4-2.9 3.4z" fill="#8fd58c" stroke={ink} strokeWidth=".4" />
      </g>

      {/* Sepal leaves at the bulb's base double as the ears, with crisp outlines & dewdrop */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M9.6 11.2c-3.2-1.6-6.2-1-8.2 1.6 3 1.4 6 .9 8.2-1.6z" fill="#38883f" stroke={ink} strokeWidth="1.05" strokeLinejoin="round" />
        <path d="M9 11.5 3 12.7" fill="none" stroke="#8fd58c" strokeWidth=".6" strokeLinecap="round" opacity=".85" />
        <circle cx="4.2" cy="12.2" r=".4" fill="#ffffff" opacity=".7" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M22.4 11.2c3.2-1.6 6.2-1 8.2 1.6-3 1.4-6 .9-8.2-1.6z" fill="#38883f" stroke={ink} strokeWidth="1.05" strokeLinejoin="round" />
        <path d="M23 11.5 29 12.7" fill="none" stroke="#8fd58c" strokeWidth=".6" strokeLinecap="round" opacity=".85" />
        <circle cx="27.8" cy="12.2" r=".4" fill="#ffffff" opacity=".7" />
      </g>

      {/* Succulent bulb with organic petal veining */}
      <ellipse cx="16" cy="8.8" rx="8.6" ry="7" fill={`url(#${id}-bulb)`} stroke={ink} strokeWidth="1.15" strokeLinejoin="round" />
      <path d="M16 2.2c1.4 2.4 1.4 8.8 0 13-1.4-4.2-1.4-10.6 0-13z" fill="#246830" opacity=".45" />
      <path d="M11.6 4.2c2.4 1.8 3.8 5.6 3.4 9.4" fill="none" stroke="#8ae276" strokeWidth=".7" strokeLinecap="round" opacity=".65" />
      <path d="M20.4 4.2c-2.4 1.8-3.8 5.6-3.4 9.4" fill="none" stroke="#8ae276" strokeWidth=".7" strokeLinecap="round" opacity=".65" />
      <path d="M9.6 5.4c1.6-2.2 4.4-3 6.8-2.3-2.4.8-4.6 1.9-6.8 2.3z" fill="#c8f0b6" opacity=".55" />

      {/* Sheen: a streak of light that sweeps the bulb */}
      <g clipPath={`url(#${id}-clip)`}>
        <g transform="rotate(-28 13 6)"><ellipse className="dg-pet-sheen" cx="13" cy="6" rx="2.4" ry="5.4" fill="#fff" opacity=".2" /></g>
      </g>

      {/* Blossom on the bulb with golden center */}
      <g className="dg-pet-accessory">
        <g fill="#ff9fb6" stroke={ink} strokeWidth=".4">
          <circle cx="21.7" cy="4.2" r=".95" /><circle cx="23.2" cy="5.3" r=".95" /><circle cx="22.6" cy="7.1" r=".95" />
          <circle cx="20.8" cy="7.1" r=".95" /><circle cx="20.2" cy="5.3" r=".95" />
        </g>
        <circle cx="21.7" cy="5.8" r=".85" fill="#ffd44f" stroke={ink} strokeWidth=".35" />
      </g>

      {/* Rear haunches and chubby body with inky outlines */}
      <ellipse cx="5.4" cy="24.6" rx="2.9" ry="2.5" fill="#57a49b" stroke={ink} strokeWidth=".9" />
      <ellipse cx="26.6" cy="24.6" rx="2.9" ry="2.5" fill="#57a49b" stroke={ink} strokeWidth=".9" />

      <ellipse className="dg-pet-face" cx="16" cy="20.6" rx="10.4" ry="7.8" fill={`url(#${id}-skin)`} stroke={ink} strokeWidth="1.25" strokeLinejoin="round" />
      <ellipse cx="11.6" cy="16" rx="3.2" ry="1.8" fill="#fff" opacity=".18" transform="rotate(-16 11.6 16)" />

      {/* Front paws with inky contours and claws */}
      <ellipse cx="10.6" cy="27.6" rx="3.5" ry="2.4" fill="#6fbfb6" stroke={ink} strokeWidth=".9" />
      <ellipse cx="21.4" cy="27.6" rx="3.5" ry="2.4" fill="#6fbfb6" stroke={ink} strokeWidth=".9" />
      <path d="M8.3 28.8l.5-1 .5 1zM10 29.2l.5-1 .5 1zM21.5 29.2l.5-1 .5 1zM23.2 28.8l.5-1 .5 1z" fill="#eef7f4" />

      {/* Teal botanical markings */}
      <g fill="#4a9a90" opacity=".85">
        <path d="M7.2 17.6c1.4-1.2 3.2-.8 3.6.6-1.2 1.1-2.9 1.1-3.6-.6z" />
        <path d="M21.2 18.2c.4-1.4 2.2-1.8 3.6-.6-.7 1.7-2.4 1.7-3.6.6z" />
        <path d="M12.4 13.8c1.1-.7 2.4-.3 2.6.7-1 .6-2.2.5-2.6-.7z" />
        <path d="M17 14.5c.2-1 1.5-1.4 2.6-.7-.4 1.2-1.6 1.3-2.6.7z" />
        <path d="M9.4 26.6c1-.7 2.2-.5 2.6.4-.9.7-2 .6-2.6-.4z" />
        <path d="M20 27c.4-.9 1.6-1.1 2.6-.4-.6 1-1.7 1.1-2.6.4z" />
      </g>

      {/* Warm gem-like eyes with ruby gradient and catchlights */}
      <g className="dg-pet-eyes">
        <ellipse cx="11.6" cy="19.6" rx="2.5" ry="2.8" fill={`url(#${id}-eye)`} stroke={ink} strokeWidth=".6" />
        <ellipse cx="20.4" cy="19.6" rx="2.5" ry="2.8" fill={`url(#${id}-eye)`} stroke={ink} strokeWidth=".6" />
        <ellipse cx="11.9" cy="20" rx="1.15" ry="1.6" fill={EYE} />
        <ellipse cx="20.1" cy="20" rx="1.15" ry="1.6" fill={EYE} />
        <circle cx="12.5" cy="18.4" r=".75" fill="#fff" />
        <circle cx="21" cy="18.4" r=".75" fill="#fff" />
        <circle cx="11" cy="21" r=".35" fill="#fff" opacity=".85" />
        <circle cx="19.5" cy="21" r=".35" fill="#fff" opacity=".85" />
      </g>

      {/* Nostrils, wide grin, and cute fangs */}
      <circle cx="14.9" cy="22.4" r=".32" fill="#2f5a49" opacity=".7" />
      <circle cx="17.1" cy="22.4" r=".32" fill="#2f5a49" opacity=".7" />
      <path className="dg-pet-mouth-base" d="M11.4 23.6q4.6 3.8 9.2 0" fill="none" stroke={ink} strokeWidth="1.05" strokeLinecap="round" />
      <path className="dg-pet-mouth-base" d="M13 24.7l.55 1.5.55-1.3zM17.9 24.9l.55 1.3.55-1.5z" fill="#f4fbf8" stroke={ink} strokeWidth=".3" />
      <PetExpression left={11.6} right={20.4} y={19.6} mouthY={23.6} ink="#203a32" />
    </svg>
  );
}

// The two devotion companions — the tier 4 and tier 8 unlocks, and the only
// pets not earned by levelling. Levels 1-12 hand out the whole roster, so
// devotion, the only progression left after the cap, had nothing but hats
// behind it; these are what is actually out there at the top of the curve.
//
// Drawn to the same brief as Spark and Leafy: gradients, a full-body pose and a
// signature motion sequence rather than the roster's single quiet loop. Like
// those two they carry no `.dg-pet-sig` — their motion is staged, in named
// classes backed by keyframes in styles.css (§Nova & Cinder).

function Nova() {
  const id = "nv" + useId().replace(/\W/g, "");
  const coat = `url(#${id}-coat)`;
  const star = `url(#${id}-star)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-coat`} cx="38%" cy="30%" r="78%">
          <stop offset="0" stopColor="#5b6ad0" />
          <stop offset=".55" stopColor="#3a3f9e" />
          <stop offset="1" stopColor="#221f5c" />
        </radialGradient>
        <linearGradient id={`${id}-star`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6c9" />
          <stop offset="1" stopColor="#ffd66b" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#9fb2ff" stopOpacity=".85" />
          <stop offset=".6" stopColor="#7c6cf0" stopOpacity=".3" />
          <stop offset="1" stopColor="#7c6cf0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Three stars on a slow orbit around the head. */}
      <g className="dg-pet-orbit">
        <path d="M16 3.4 16.9 5.6 19.1 6.5 16.9 7.4 16 9.6 15.1 7.4 12.9 6.5 15.1 5.6z" fill={star} />
      </g>
      <g className="dg-pet-orbit dg-pet-orbit-b">
        <path d="M28 16 28.7 17.7 30.4 18.4 28.7 19.1 28 20.8 27.3 19.1 25.6 18.4 27.3 17.7z" fill={star} opacity=".9" />
      </g>
      <g className="dg-pet-orbit dg-pet-orbit-c">
        <path d="M4 15 4.6 16.4 6 17 4.6 17.6 4 19 3.4 17.6 2 17 3.4 16.4z" fill={star} opacity=".75" />
      </g>

      {/* Comet tail: a tapered streak with bright star tip */}
      <g className="dg-pet-tail dg-pet-comet">
        <path d="M22.4 23.2c2.6-.4 5.4-1.9 7.8-4.4-1.2 3.4-3.2 5.9-5.6 7.2-1 .6-2 .6-2.6.1z" fill="#6f79dd" opacity=".55" />
        <path d="M22.6 24.4c2-.5 4-1.7 5.8-3.5-1 2.4-2.5 4.1-4.3 5-.7.4-1.3.2-1.5-.5z" fill="#a8b4ff" opacity=".8" />
        <circle cx="22.2" cy="24.6" r="1.5" fill={star} />
      </g>

      {/* Body with celestial stardust rim outline */}
      <ellipse cx="16" cy="26.6" rx="6.8" ry="4" fill={coat} stroke="#818cf8" strokeWidth=".85" />
      <ellipse cx="12.4" cy="29.4" rx="2.4" ry="1.2" fill="#2b2a72" stroke="#818cf8" strokeWidth=".65" />
      <circle cx="11.8" cy="29.4" r=".3" fill="#c7d2fe" />
      <circle cx="13" cy="29.4" r=".3" fill="#c7d2fe" />
      <ellipse cx="19.6" cy="29.4" rx="2.4" ry="1.2" fill="#2b2a72" stroke="#818cf8" strokeWidth=".65" />
      <circle cx="19" cy="29.4" r=".3" fill="#c7d2fe" />
      <circle cx="20.2" cy="29.4" r=".3" fill="#c7d2fe" />

      {/* Ears tipped with golden crescent moons with metallic luster */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M12.4 9.4 7.2 1.8 8 11.2z" fill={coat} stroke="#818cf8" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M7.2 1.8 9.1 5.4c-1-.5-1.6-1.7-1.9-3.6z" fill="#ffe9a8" stroke="#d99a18" strokeWidth=".4" />
        <circle cx="7.7" cy="2.8" r=".3" fill="#ffffff" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M19.6 9.4 24.8 1.8 24 11.2z" fill={coat} stroke="#818cf8" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M24.8 1.8 22.9 5.4c1-.5 1.6-1.7 1.9-3.6z" fill="#ffe9a8" stroke="#d99a18" strokeWidth=".4" />
        <circle cx="24.3" cy="2.8" r=".3" fill="#ffffff" />
      </g>

      <circle className="dg-pet-glow" cx="16" cy="17.4" r="12.6" fill={`url(#${id}-halo)`} />
      {/* Head with stardust glow rim stroke for dark-mode contrast */}
      <circle className="dg-pet-face" cx="16" cy="17.4" r="9.7" fill={coat} stroke="#818cf8" strokeWidth=".95" />
      <ellipse cx="12.3" cy="11.9" rx="3.4" ry="2" fill="#fff" opacity=".16" transform="rotate(-20 12.3 11.9)" />

      {/* Forehead constellation star diamond */}
      <path d="M16 10l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z" fill={star} opacity=".95" />

      {/* Twinkling starfield speckles */}
      <g fill="#dfe6ff">
        <circle className="dg-pet-twinkle" cx="10.2" cy="14.4" r=".45" />
        <circle className="dg-pet-twinkle dg-pet-twinkle-b" cx="21.6" cy="12.6" r=".38" />
        <circle className="dg-pet-twinkle dg-pet-twinkle-c" cx="19.2" cy="22.4" r=".42" />
        <circle className="dg-pet-twinkle dg-pet-twinkle-b" cx="12.8" cy="22.8" r=".34" />
        <circle className="dg-pet-twinkle dg-pet-twinkle-c" cx="23.4" cy="18.6" r=".38" />
        <circle className="dg-pet-twinkle" cx="8.8" cy="19.8" r=".34" />
      </g>

      <g className="dg-pet-eyes">
        <ellipse cx="12.4" cy="16.6" rx="2" ry="2.3" fill="#12102e" />
        <ellipse cx="19.6" cy="16.6" rx="2" ry="2.3" fill="#12102e" />
        <circle cx="13.1" cy="15.7" r=".72" fill="#fff" />
        <circle cx="20.3" cy="15.7" r=".72" fill="#fff" />
        <circle cx="11.8" cy="17.7" r=".3" fill="#bcd0ff" />
        <circle cx="19" cy="17.7" r=".3" fill="#bcd0ff" />
      </g>

      <path d="M16 19.4l-1.1 1.2h2.2z" fill="#12102e" />
      <path className="dg-pet-mouth-base" d="M13.6 21.4q2.4 2.6 4.8 0" fill="none" stroke="#12102e" strokeWidth=".9" strokeLinecap="round" />

      {/* Celestial choker with golden compass star */}
      <path className="dg-pet-accessory" d="M10.2 24.6c3.6 1.5 8 1.5 11.6 0l.35 1.55c-3.9 1.7-8.4 1.7-12.3 0z" fill="#6d58cf" stroke="#818cf8" strokeWidth=".45" strokeLinejoin="round" />
      <path className="dg-pet-accessory" d="M16 25.4 16.7 27 18.3 27.7 16.7 28.4 16 30 15.3 28.4 13.7 27.7 15.3 27z" fill={star} stroke="#d99a18" strokeWidth=".35" />
      <PetExpression left={12.4} right={19.6} y={16.6} mouthY={21.4} ink="#12102e" />
    </svg>
  );
}

// A rounded cub silhouette: the mane, tufted tail and broad muzzle carry the
// species at small sizes. Stable key "cinder" preserves existing companions.
function Lion() {
  const id = "ln" + useId().replace(/\W/g, "");
  const ink = "#473023";
  const coat = `url(#${id}-coat)`;
  const mane = `url(#${id}-mane)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-coat`} cx="38%" cy="25%" r="85%">
          <stop offset="0" stopColor="#ffdfa0" />
          <stop offset=".65" stopColor="#edb65c" />
          <stop offset="1" stopColor="#d99742" />
        </radialGradient>
        <radialGradient id={`${id}-mane`} cx="42%" cy="35%" r="75%">
          <stop offset="0" stopColor="#c98643" />
          <stop offset=".6" stopColor="#ad6836" />
          <stop offset="1" stopColor="#85502f" />
        </radialGradient>
      </defs>

      {/* Curved tail with a soft, unmistakably lion-shaped brush. */}
      <g className="dg-pet-tail">
        <path d="M21 27c5 2 7-1.5 6.5-5.5" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M21 27c5 2 7-1.5 6.5-5.5" fill="none" stroke="#edb65c" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M27.5 23c-2.5-1-3-4-.8-5.8 2.7.4 4.4 3.2 2.3 5.3z" fill="#ad6836" stroke={ink} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M27.5 21.8q-1-1.4-.2-3" fill="none" stroke="#d89854" strokeWidth=".65" strokeLinecap="round" />
      </g>

      {/* A small seated body and cream chest bib leave room for the paws. */}
      <path d="M10 23c.5-3.8 11.5-3.8 12 0l.4 4.5c0 2.3-3 3.2-6.4 3.2s-6.4-.9-6.4-3.2z" fill={coat} stroke={ink} strokeWidth="1" />
      <path d="M12.8 24q3.2-1.1 6.4 0l-.6 4.3q-2.6 1.7-5.2 0z" fill="#f9e7c3" />

      {/* Scalloped mane: rounded lobes, a copper highlight and a little fringe. */}
      <g className="dg-pet-mane">
        <path d="M16 3c2-1.4 4.8-.2 5.8 1.8 2.6-.5 5 1.3 5 4 2.4.9 3.4 3.7 2 5.8 1.6 2 .8 4.9-1.4 6 0 2.8-2.2 4.6-4.8 4.5-1.2 2.6-4.2 3.2-6.6 1.7-2.4 1.5-5.4.9-6.6-1.7-2.6.1-4.8-1.7-4.8-4.5-2.2-1.1-3-4-1.4-6-1.4-2.1-.4-4.9 2-5.8 0-2.7 2.4-4.5 5-4C11.2 2.8 14 1.6 16 3z" fill={mane} stroke={ink} strokeWidth="1.15" strokeLinejoin="round" />
        <path d="M7.8 10q1.4-3.2 4.6-3.8M20.2 6.7q3.1 1.2 4.1 4.2M5.8 17q.2 3.3 2.7 4.5M23.5 22q2.4-1.3 2.7-3.7" fill="none" stroke="#dfaa66" strokeWidth=".95" strokeLinecap="round" opacity=".65" />
      </g>

      <g className="dg-pet-ear dg-pet-ear-left">
        <circle cx="9.4" cy="9.2" r="3" fill={coat} stroke={ink} strokeWidth=".9" />
        <circle cx="9.4" cy="9.4" r="1.7" fill="#d78977" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <circle cx="22.6" cy="9.2" r="3" fill={coat} stroke={ink} strokeWidth=".9" />
        <circle cx="22.6" cy="9.4" r="1.7" fill="#d78977" />
      </g>

      <path className="dg-pet-face" d="M16 7.8c5.5 0 9 3.2 9 8 0 5.4-3.6 9-9 9s-9-3.6-9-9c0-4.8 3.5-8 9-8z" fill={coat} stroke={ink} strokeWidth="1.1" />
      <path d="M13 8.3q1.4 1.1 1.5 2.1M16 8v2.4M19 8.3q-1.4 1.1-1.5 2.1" fill="none" stroke="#ca8b3f" strokeWidth=".7" strokeLinecap="round" />
      <ellipse cx="11.4" cy="11.3" rx="2.4" ry="1.2" fill="#ffeab5" opacity=".7" transform="rotate(-25 11.4 11.3)" />

      <g className="dg-pet-eyes">
        <ellipse cx="12" cy="15.4" rx="2.05" ry="2.35" fill={ink} />
        <ellipse cx="20" cy="15.4" rx="2.05" ry="2.35" fill={ink} />
        <g fill="#fff"><circle cx="11.4" cy="14.7" r=".7" /><circle cx="19.4" cy="14.7" r=".7" /><circle cx="12.6" cy="16.2" r=".3" /><circle cx="20.6" cy="16.2" r=".3" /></g>
      </g>
      <g fill="#df9678" opacity=".5"><ellipse cx="9.1" cy="18.2" rx="1.7" ry="1" /><ellipse cx="22.9" cy="18.2" rx="1.7" ry="1" /></g>
      <path d="M16 18.6c-3.4-2.8-6.5-.4-5.3 2.2.8 1.8 3.8 2.3 5.3.9 1.5 1.4 4.5.9 5.3-.9 1.2-2.6-1.9-5-5.3-2.2z" fill="#f9e7c3" />
      <path d="M14.5 18.2q1.5-.8 3 0l-1.5 1.5z" fill="#9b5b4c" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
      <path className="dg-pet-mouth-base" d="M16 19.7v.8m0 0q-1.4 1.5-2.6.2m2.6-.2q1.4 1.5 2.6.2" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />
      <g fill={ink} opacity=".5"><circle cx="12.4" cy="19.8" r=".23" /><circle cx="13.2" cy="20.3" r=".23" /><circle cx="19.6" cy="19.8" r=".23" /><circle cx="18.8" cy="20.3" r=".23" /></g>
      <PetExpression left={12} right={20} y={15.4} mouthY={20.8} ink={ink} />

      {/* The paws belong to the cub and move independently for its paw lift. */}
      <g className="dg-pet-paw dg-pet-paw-left" fill="#f9e7c3" stroke={ink} strokeWidth=".8">
        <ellipse cx="11.9" cy="28.9" rx="2.7" ry="1.7" />
        <path d="M11.1 29v.9M12.5 29v.9" fill="none" strokeWidth=".45" strokeLinecap="round" />
      </g>
      <g className="dg-pet-paw dg-pet-paw-right" fill="#f9e7c3" stroke={ink} strokeWidth=".8">
        <ellipse cx="20.1" cy="28.9" rx="2.7" ry="1.7" />
        <path d="M19.3 29v.9M20.7 29v.9" fill="none" strokeWidth=".45" strokeLinecap="round" />
      </g>
      <g className="dg-pet-accessory">
        <path d="M11.1 24q4.9 1.7 9.8 0l.3 1.3q-5.2 1.8-10.4 0z" fill="#598b80" stroke={ink} strokeWidth=".45" />
        <path d="m16 25.2.6 1.3 1.4.2-1 1 .2 1.4-1.2-.7-1.2.7.2-1.4-1-1 1.4-.2z" fill="#f2c668" stroke={ink} strokeWidth=".4" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// The level 14-20 companions — the four unlocks past the old cap of 12. Drawn
// to the premium brief (Spark, Leafy, Nova, Cinder): gradients, a full-body
// pose, and a staged flourish in named classes (styles.css §Frost, Tide, Sol &
// Eclipse) instead of a `.dg-pet-sig`. Each one escalates on the last, and
// Eclipse, the level 20 finale, is the loudest thing in the roster on purpose.
//
// Flourishes never sit on a part that already moves (ear, tail, wing, face,
// eyes): an element runs one animation, so they get their own element — a
// glint inside an ear group rides the ear's droop without replacing it.

// A four-point glint, drawn at the origin so a translate places it.
const GLINT = "M0-1.5.36-.36 1.5 0 .36.36 0 1.5-.36.36-1.5 0-.36-.36z";

// An ice wolf. The husky mask — slate cap, white face — is what says "wolf"
// at 40px; the crystal ear tips, ice-blue eyes and the frost on its breath
// say which one.
function Frost() {
  const id = "fr" + useId().replace(/\W/g, "");
  const ink = "#1b2f47";
  const fur = `url(#${id}-fur)`;
  const cap = `url(#${id}-cap)`;
  const ice = `url(#${id}-ice)`;
  const flake = "M0-1.35v2.7M-1.17-.68l2.34 1.36M-1.17.68l2.34-1.36";
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-fur`} cx="42%" cy="34%" r="74%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".6" stopColor="#e6f1fa" />
          <stop offset="1" stopColor="#bcd6ec" />
        </radialGradient>
        <radialGradient id={`${id}-cap`} cx="38%" cy="26%" r="82%">
          <stop offset="0" stopColor="#b9d2ea" />
          <stop offset=".55" stopColor="#86a8cc" />
          <stop offset="1" stopColor="#5d7ea8" />
        </radialGradient>
        <linearGradient id={`${id}-ice`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4fcff" />
          <stop offset=".5" stopColor="#9ddcfb" />
          <stop offset="1" stopColor="#4aa6e4" />
        </linearGradient>
      </defs>

      {/* Snow drifts down past the ears on three unrelated clocks. */}
      <g fill="none" stroke="#7fbfe8" strokeWidth=".5" strokeLinecap="round">
        <g transform="translate(3 4.4)"><path className="dg-pet-snow" d={flake} /></g>
        <g transform="translate(29.2 8.8)"><path className="dg-pet-snow dg-pet-snow-b" d={flake} /></g>
        <g transform="translate(2.4 13.6) scale(.75)"><path className="dg-pet-snow dg-pet-snow-c" d={flake} /></g>
      </g>

      {/* A full brush curling up the right side, slate with a white tip. */}
      <g className="dg-pet-tail">
        <path d="M20.8 27.9c3.6.7 6.9-.5 8.3-3.5 1.4-2.9 1-6.3-.8-8.9-.3 1.5-1.1 2.5-2.2 2.9.5 2.7-.4 5.2-2.4 6.5-.9.6-1.9 1-2.9 1.1z" fill={cap} stroke={ink} strokeWidth="1" strokeLinejoin="round" />
        <path d="M28.3 15.5c-.3 1.5-1.1 2.5-2.2 2.9.2.9.2 1.8 0 2.7 1.4-.3 2.7-1.1 3.2-2.3.3-1.1 0-2.3-1-3.3z" fill={fur} />
        <path d="M23.6 25.6q2.6-1 3.4-3.6M25 26.6q2.4-.9 3.4-3" fill="none" stroke="#4d6d96" strokeWidth=".5" strokeLinecap="round" opacity=".7" />
      </g>

      {/* Seated chest with a jagged white ruff and two white forepaws. */}
      <path d="M10.4 23c.6-3.4 10.6-3.4 11.2 0l.5 4.6c0 2.2-2.9 3.1-6.1 3.1s-6.1-.9-6.1-3.1z" fill={cap} stroke={ink} strokeWidth="1" strokeLinejoin="round" />
      <path d="M12.1 22.8l1.3 1.5 1.3-1.2 1.3 1.6 1.3-1.6 1.3 1.2 1.3-1.5.4 3.2c-.4 2.2-1.9 3.6-4.3 3.6s-3.9-1.4-4.3-3.6z" fill={fur} />
      <ellipse cx="12.6" cy="29.3" rx="2.5" ry="1.3" fill={fur} stroke={ink} strokeWidth=".85" />
      <path d="M12 29.4v.8M13.2 29.4v.8" stroke={ink} strokeWidth=".45" strokeLinecap="round" opacity=".55" />
      <ellipse cx="19.4" cy="29.3" rx="2.5" ry="1.3" fill={fur} stroke={ink} strokeWidth=".85" />
      <path d="M18.8 29.4v.8M20 29.4v.8" stroke={ink} strokeWidth=".45" strokeLinecap="round" opacity=".55" />

      {/* Tall ears, each ending in a faceted ice shard. The glint is its own
          element inside the group: it rides the ear's droop, never replaces it. */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M12.8 9.4 6.1 1.5 7.5 11.9z" fill={cap} stroke={ink} strokeWidth="1.05" strokeLinejoin="round" />
        <path d="M11.2 9.7 7.4 5.4l.8 5.3z" fill="#eef5fb" />
        <path d="M6.1 1.5 9.3 5.2 7.9 5.9 6.8 5.4z" fill={ice} stroke={ink} strokeWidth=".55" strokeLinejoin="round" />
        <path d="M6.1 1.5 7.9 5.9" stroke="#fff" strokeWidth=".35" opacity=".85" />
        <g transform="translate(6.7 2.6)"><path className="dg-pet-glint" d={GLINT} fill="#fff" /></g>
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M19.2 9.4 25.9 1.5 24.5 11.9z" fill={cap} stroke={ink} strokeWidth="1.05" strokeLinejoin="round" />
        <path d="M20.8 9.7 24.6 5.4l-.8 5.3z" fill="#eef5fb" />
        <path d="M25.9 1.5 22.7 5.2 24.1 5.9 25.2 5.4z" fill={ice} stroke={ink} strokeWidth=".55" strokeLinejoin="round" />
        <path d="M25.9 1.5 24.1 5.9" stroke="#fff" strokeWidth=".35" opacity=".85" />
        <g transform="translate(25.3 2.6)"><path className="dg-pet-glint dg-pet-glint-b" d={GLINT} fill="#fff" /></g>
      </g>

      {/* Head: a slate cap with spiky cheek ruff cut into the outline. */}
      <path
        className="dg-pet-face"
        d="M16 7c5.6 0 9.2 3.4 9.6 8.4l2.5 1.1-2 1 1.6 1.6-2.5.4c-1.2 3.6-4.6 6-9.2 6s-8-2.4-9.2-6l-2.5-.4 1.6-1.6-2-1 2.5-1.1C6.8 10.4 10.4 7 16 7z"
        fill={cap}
        stroke={ink}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* The husky mask: white face, widow's peak, and the cheek ruff. */}
      <path d="M16 11.4l1.5 2.4c1.4-1.1 3.6-1.5 5.5-.6 1.6.8 2.6 2.3 3 3.9l-1.4.6c-1.1 3.4-4.4 5.8-8.6 5.8s-7.5-2.4-8.6-5.8l-1.4-.6c.4-1.6 1.4-3.1 3-3.9 1.9-.9 4.1-.5 5.5.6z" fill={fur} />
      <ellipse cx="11.8" cy="10.4" rx="3" ry="1.6" fill="#fff" opacity=".28" transform="rotate(-22 11.8 10.4)" />
      <g fill="#5d7ea8" opacity=".8"><ellipse cx="12.4" cy="12.7" rx=".9" ry=".55" /><ellipse cx="19.6" cy="12.7" rx=".9" ry=".55" /></g>

      {/* Ice-blue husky eyes, ringed dark so they hold on the white mask. */}
      <g className="dg-pet-eyes">
        <ellipse cx="12.3" cy="16.4" rx="2.05" ry="2.25" fill={ink} />
        <ellipse cx="19.7" cy="16.4" rx="2.05" ry="2.25" fill={ink} />
        <ellipse cx="12.3" cy="16.7" rx="1.45" ry="1.6" fill="#6cc8f4" />
        <ellipse cx="19.7" cy="16.7" rx="1.45" ry="1.6" fill="#6cc8f4" />
        <ellipse cx="12.3" cy="16.8" rx=".75" ry="1" fill={ink} />
        <ellipse cx="19.7" cy="16.8" rx=".75" ry="1" fill={ink} />
        <circle cx="12.9" cy="15.6" r=".62" fill="#fff" />
        <circle cx="20.3" cy="15.6" r=".62" fill="#fff" />
        <circle cx="11.7" cy="17.6" r=".26" fill="#fff" opacity=".85" />
        <circle cx="19.1" cy="17.6" r=".26" fill="#fff" opacity=".85" />
      </g>
      <g fill="#f2a3c0" opacity=".42"><ellipse cx="8.9" cy="19.2" rx="1.6" ry=".95" /><ellipse cx="23.1" cy="19.2" rx="1.6" ry=".95" /></g>

      {/* Snout, nose and a small open smile. */}
      <ellipse cx="16" cy="20.4" rx="3.4" ry="2.4" fill="#fff" stroke="#c4d8ea" strokeWidth=".4" />
      <path d="M14.6 18.9q1.4-.7 2.8 0 0 1-1.4 1.6-1.4-.6-1.4-1.6z" fill={ink} />
      <circle cx="15.5" cy="19" r=".28" fill="#fff" opacity=".7" />
      <path className="dg-pet-mouth-base" d="M16 20.5v.6m0 0q-1.2 1.3-2.4.3m2.4-.3q1.2 1.3 2.4.3" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />

      {/* Frosted breath: a puff curls out of the mouth and dissolves. Authored
          at opacity 0 so a still pet (reduced motion) is not left with two
          clouds stuck to its cheeks; the keyframes own the opacity. */}
      <g fill="#e4f3fd" stroke="#8cc6ec" strokeWidth=".35">
        <g className="dg-pet-breath" opacity="0">
          <circle cx="10.6" cy="22.2" r="1.05" /><circle cx="9.2" cy="21.5" r="1.25" /><circle cx="7.8" cy="22.3" r=".9" />
        </g>
        <g className="dg-pet-breath dg-pet-breath-b" opacity="0">
          <circle cx="22.6" cy="22.4" r=".85" /><circle cx="23.7" cy="21.8" r=".95" />
        </g>
      </g>

      {/* Midnight collar with a hanging ice crystal. */}
      <g className="dg-pet-accessory">
        <path d="M10.4 24.3c3.6 1.5 7.6 1.5 11.2 0l.35 1.5c-3.8 1.7-8.1 1.7-11.9 0z" fill="#2b4a78" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
        <path d="M16 25.4l1.2 1.5L16 29.3l-1.2-2.4z" fill={ice} stroke={ink} strokeWidth=".45" strokeLinejoin="round" />
        <path d="M16 25.4v3.9" stroke="#fff" strokeWidth=".3" opacity=".7" />
        <g transform="translate(17.3 26)"><path className="dg-pet-glint dg-pet-glint-c" d={GLINT} fill="#fff" /></g>
      </g>
      <PetExpression left={12.3} right={19.7} y={16.4} mouthY={21} ink={ink} />
    </svg>
  );
}

// A sea dragon hatchling. Webbed fin-ears fan out like a crown, a dorsal crest
// runs over the head, and the tail curls into a spiral. Bubbles rise off it
// and a ripple spreads from where it sits, as if it just surfaced.
function Tide() {
  const id = "td" + useId().replace(/\W/g, "");
  const ink = "#0c3340";
  const scale = `url(#${id}-scale)`;
  const fin = `url(#${id}-fin)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-scale`} cx="40%" cy="30%" r="78%">
          <stop offset="0" stopColor="#a4f1e4" />
          <stop offset=".52" stopColor="#47c0c3" />
          <stop offset="1" stopColor="#1d7e97" />
        </radialGradient>
        <linearGradient id={`${id}-fin`} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#6fdcd6" />
          <stop offset="1" stopColor="#d4fff5" />
        </linearGradient>
        <linearGradient id={`${id}-belly`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4d2" />
          <stop offset="1" stopColor="#f0d595" />
        </linearGradient>
      </defs>

      {/* Two ripples, half a cycle apart, spreading from the base. */}
      <g fill="none" stroke="#3fb8c4" strokeWidth=".55">
        <ellipse className="dg-pet-ripple" cx="16" cy="29.8" rx="8.4" ry="1.5" />
        <ellipse className="dg-pet-ripple dg-pet-ripple-b" cx="16" cy="29.8" rx="8.4" ry="1.5" />
      </g>

      {/* Bubbles rise on both sides and pop out of sight. */}
      <g fill="#dffbf6" fillOpacity=".45" stroke="#2fa6b8" strokeWidth=".4">
        <g className="dg-pet-bubble"><circle cx="4.6" cy="23" r="1" /><circle cx="4.25" cy="22.65" r=".28" fill="#fff" fillOpacity="1" stroke="none" /></g>
        <g className="dg-pet-bubble dg-pet-bubble-b"><circle cx="3" cy="18" r=".7" /></g>
        <g className="dg-pet-bubble dg-pet-bubble-c"><circle cx="28" cy="12.6" r=".85" /><circle cx="27.7" cy="12.3" r=".24" fill="#fff" fillOpacity="1" stroke="none" /></g>
      </g>

      {/* Tail: a spiral curl tipped with a little fin. */}
      <g className="dg-pet-tail">
        <path d="M21.2 27.6c3.8 1.2 7.2.1 7.8-2.9.5-2.5-1.2-4.2-3.1-3.8-1.5.3-1.9 1.9-1 2.7" fill="none" stroke={ink} strokeWidth="3.3" strokeLinecap="round" />
        <path d="M21.2 27.6c3.8 1.2 7.2.1 7.8-2.9.5-2.5-1.2-4.2-3.1-3.8-1.5.3-1.9 1.9-1 2.7" fill="none" stroke="#3db6bf" strokeWidth="1.9" strokeLinecap="round" />
        <path d="M26.6 21.1l.6-2.1 1.3 1.4zM29.1 22.4l1.9-.9-.3 1.9z" fill={fin} stroke={ink} strokeWidth=".55" strokeLinejoin="round" />
      </g>

      {/* Chubby seated body with a plated cream belly. */}
      <ellipse cx="16" cy="26.5" rx="7.3" ry="4.3" fill={scale} stroke={ink} strokeWidth="1.05" />
      <path d="M12.6 24.2q3.4-1.4 6.8 0l-.4 4.4q-3 1.6-6 0z" fill={`url(#${id}-belly)`} stroke="#c9a65e" strokeWidth=".35" />
      <path d="M12.9 25.7q3.1.8 6.2 0M13.1 27.2q2.9.8 5.8 0" fill="none" stroke="#c9a65e" strokeWidth=".4" strokeLinecap="round" />
      <ellipse cx="11.7" cy="29.4" rx="2.4" ry="1.25" fill="#2b9aae" stroke={ink} strokeWidth=".8" />
      <ellipse cx="20.3" cy="29.4" rx="2.4" ry="1.25" fill="#2b9aae" stroke={ink} strokeWidth=".8" />
      <path d="M10.8 29.9l.3-.8.3.8zM12 29.9l.3-.8.3.8zM19.4 29.9l.3-.8.3.8zM20.6 29.9l.3-.8.3.8z" fill="#fff4d2" />

      {/* Fin-ears: webbed fans on three spines, rooted at the jaw hinge. */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M10.8 11.6 2 9.9Q4.5 8.3 3.7 5.1 6.6 5.6 7.7 3.2z" fill={fin} stroke={ink} strokeWidth=".95" strokeLinejoin="round" />
        <path d="M10.4 11.3 2.8 9.8M10.4 11.3 4.2 5.9M10.4 11.3 7.6 4.1" fill="none" stroke="#1f8a9f" strokeWidth=".55" strokeLinecap="round" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M21.2 11.6 30 9.9Q27.5 8.3 28.3 5.1 25.4 5.6 24.3 3.2z" fill={fin} stroke={ink} strokeWidth=".95" strokeLinejoin="round" />
        <path d="M21.6 11.3 29.2 9.8M21.6 11.3 27.8 5.9M21.6 11.3 24.4 4.1" fill="none" stroke="#1f8a9f" strokeWidth=".55" strokeLinecap="round" />
      </g>

      {/* Dorsal crest, then the head over it. */}
      <path d="M12.6 9.6l.8-2.9 1.7 1.8.9-3 .9 3 1.7-1.8.8 2.9z" fill={fin} stroke={ink} strokeWidth=".8" strokeLinejoin="round" />
      <ellipse className="dg-pet-face" cx="16" cy="17" rx="9.8" ry="9.3" fill={scale} stroke={ink} strokeWidth="1.15" />
      <ellipse cx="12" cy="11.4" rx="3.2" ry="1.8" fill="#fff" opacity=".24" transform="rotate(-20 12 11.4)" />
      <path d="M13.2 10.4q.8.8 1.6 0t1.6 0 1.6 0M7.6 15.8q.7.7 1.4 0M23 15.8q.7.7 1.4 0M8.4 13.4q.7.7 1.4 0M22.2 13.4q.7.7 1.4 0" fill="none" stroke="#1f8a9f" strokeWidth=".5" strokeLinecap="round" opacity=".7" />

      {/* Pale snout with nostrils. */}
      <ellipse cx="16" cy="21" rx="4.4" ry="2.9" fill="#c8f5ea" />
      <circle cx="15" cy="19.9" r=".34" fill={ink} opacity=".7" />
      <circle cx="17" cy="19.9" r=".34" fill={ink} opacity=".7" />

      <g className="dg-pet-eyes">
        <ellipse cx="12" cy="16.1" rx="2.1" ry="2.4" fill={ink} />
        <ellipse cx="20" cy="16.1" rx="2.1" ry="2.4" fill={ink} />
        <ellipse cx="12" cy="17.1" rx="1.4" ry="1.05" fill="#2bb0c4" />
        <ellipse cx="20" cy="17.1" rx="1.4" ry="1.05" fill="#2bb0c4" />
        <circle cx="12.7" cy="15.2" r=".75" fill="#fff" />
        <circle cx="20.7" cy="15.2" r=".75" fill="#fff" />
        <circle cx="11.4" cy="17.3" r=".3" fill="#fff" opacity=".85" />
        <circle cx="19.4" cy="17.3" r=".3" fill="#fff" opacity=".85" />
      </g>
      <g fill="#ff9886" opacity=".5"><ellipse cx="8.3" cy="19.3" rx="1.5" ry=".9" /><ellipse cx="23.7" cy="19.3" rx="1.5" ry=".9" /></g>

      {/* A wide grin with one small fang. */}
      <path className="dg-pet-mouth-base" d="M13.5 21.5q2.5 2.4 5 0" fill="none" stroke={ink} strokeWidth=".9" strokeLinecap="round" />
      <path className="dg-pet-mouth-base" d="M17.1 22.15l.35.95.55-1.2z" fill="#fff" stroke={ink} strokeWidth=".25" strokeLinejoin="round" />

      {/* A strand of pearls with a pink one at the centre. */}
      <g className="dg-pet-accessory" fill="#f4f7ff" stroke={ink} strokeWidth=".35">
        <circle cx="10.9" cy="24.4" r=".7" /><circle cx="12.5" cy="25.1" r=".7" /><circle cx="14.2" cy="25.5" r=".7" />
        <circle cx="17.8" cy="25.5" r=".7" /><circle cx="19.5" cy="25.1" r=".7" /><circle cx="21.1" cy="24.4" r=".7" />
        <circle cx="16" cy="26" r="1.05" fill="#ffd3e2" />
        <circle cx="15.65" cy="25.65" r=".3" fill="#fff" stroke="none" />
      </g>
      <PetExpression left={12} right={20} y={16.1} mouthY={21.5} ink={ink} />
    </svg>
  );
}

// A sun phoenix. Raised flame wings (the shared wing classes, so every mood
// still folds them), a three-tongue crest and a plume tail, inside a halo that
// breathes and a ring of rays that turns.
function Sol() {
  const id = "sl" + useId().replace(/\W/g, "");
  const ink = "#4a1c06";
  const plume = `url(#${id}-plume)`;
  const flame = `url(#${id}-flame)`;
  const wingL = `url(#${id}-wingl)`;
  const wingR = `url(#${id}-wingr)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-plume`} cx="40%" cy="32%" r="76%">
          <stop offset="0" stopColor="#fff3a8" />
          <stop offset=".45" stopColor="#ffcc42" />
          <stop offset=".82" stopColor="#f78c28" />
          <stop offset="1" stopColor="#dd561c" />
        </radialGradient>
        <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ef5a1e" />
          <stop offset=".5" stopColor="#ffa22e" />
          <stop offset="1" stopColor="#ffe46c" />
        </linearGradient>
        <linearGradient id={`${id}-wingl`} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffd04a" />
          <stop offset=".55" stopColor="#f88c27" />
          <stop offset="1" stopColor="#e0441a" />
        </linearGradient>
        <linearGradient id={`${id}-wingr`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd04a" />
          <stop offset=".55" stopColor="#f88c27" />
          <stop offset="1" stopColor="#e0441a" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#ffe27a" stopOpacity=".9" />
          <stop offset=".6" stopColor="#ffae3d" stopOpacity=".32" />
          <stop offset="1" stopColor="#ffae3d" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The sun behind it: a halo that swells, and a ring of rays that turns. */}
      <circle className="dg-pet-sunhalo" cx="16" cy="16.6" r="13" fill={`url(#${id}-halo)`} />
      <circle className="dg-pet-sunrays" cx="16" cy="16.6" r="13.6" fill="none" stroke="#ffbe3a" strokeWidth="1.1" strokeDasharray=".9 1.85" strokeLinecap="round" opacity=".75" />

      {/* Plume tail: two flame feathers with sun-spot eyes. */}
      <g className="dg-pet-tail">
        <path d="M20.6 27.6c2.9-.4 5.8-2.4 7.4-5.4.4-.8 1-1.3 1.9-1.5-.2 1.2-.4 2.3-.2 3.3.2 1.3-.5 2.7-1.7 3.7-2.1 1.6-4.7 1.9-7.4.9z" fill={flame} stroke={ink} strokeWidth=".85" strokeLinejoin="round" />
        <path d="M21 28.8c2.6.6 5.4.2 7.6-1.5.3 1-.1 2-.9 2.6-2 1.2-4.6 1-6.7-1.1z" fill="#f2702a" stroke={ink} strokeWidth=".75" strokeLinejoin="round" />
        <circle cx="27.6" cy="24.4" r=".75" fill="#fff3a8" />
      </g>

      {/* Raised flame wings, rooted at the shoulder. */}
      <g className="dg-pet-wing dg-pet-wing-left">
        <path d="M10.4 22.6c-3 .4-6.2-.6-8.2-3 1 .1 1.8-.2 2.3-.8-1.3-1-2-2.4-2-3.8 1 .6 2 .8 2.8.6-.7-1.3-.8-2.8-.3-4.2 1.2 1.8 3 3 4.8 3.8 1.4.6 2.2 1.8 2.4 3.4z" fill={wingL} stroke={ink} strokeWidth=".95" strokeLinejoin="round" />
        <path d="M9.8 21.2 4.6 19.5M9.6 19.2 4.4 15.8M9.6 17 6 12.8" fill="none" stroke="#ffe46c" strokeWidth=".6" strokeLinecap="round" opacity=".85" />
      </g>
      <g className="dg-pet-wing dg-pet-wing-right">
        <path d="M21.6 22.6c3 .4 6.2-.6 8.2-3-1 .1-1.8-.2-2.3-.8 1.3-1 2-2.4 2-3.8-1 .6-2 .8-2.8.6.7-1.3.8-2.8.3-4.2-1.2 1.8-3 3-4.8 3.8-1.4.6-2.2 1.8-2.4 3.4z" fill={wingR} stroke={ink} strokeWidth=".95" strokeLinejoin="round" />
        <path d="M22.2 21.2 27.4 19.5M22.4 19.2 27.6 15.8M22.4 17 26 12.8" fill="none" stroke="#ffe46c" strokeWidth=".6" strokeLinecap="round" opacity=".85" />
      </g>

      {/* Round body with a scalloped pale breast and small talons. */}
      <ellipse cx="16" cy="26.4" rx="6.9" ry="4.4" fill={plume} stroke={ink} strokeWidth="1.05" />
      <ellipse cx="16" cy="26.8" rx="3.9" ry="3.2" fill="#fff1b6" />
      <path d="M13.3 25.6q.9.9 1.8 0 .9.9 1.8 0 .9.9 1.8 0M14.2 27.4q.9.9 1.8 0 .9.9 1.8 0" fill="none" stroke="#f3a43a" strokeWidth=".45" strokeLinecap="round" />
      <path d="M11.4 30.6l1.2-1.4 1.2 1.4M12.6 29.2v1.5M18.2 30.6l1.2-1.4 1.2 1.4M19.4 29.2v1.5" fill="none" stroke="#c9461a" strokeWidth=".75" strokeLinecap="round" strokeLinejoin="round" />

      {/* Flame-feather crest: three tongues that flicker on their own clock. */}
      <g className="dg-pet-crest" fill={flame} stroke={ink} strokeWidth=".8" strokeLinejoin="round">
        <path d="M13.5 9.7c-1.6-1-2.6-2.8-2.4-4.8.7.7 1.4 1 2.1 1 0-.9.3-1.7.8-2.3.6 1.8 1 3.8.6 6z" />
        <path d="M18.5 9.7c1.6-1 2.6-2.8 2.4-4.8-.7.7-1.4 1-2.1 1 0-.9-.3-1.7-.8-2.3-.6 1.8-1 3.8-.6 6z" />
        <path d="M14.6 9.5c-.9-2.4-.4-5.2 1.6-7.6.1 1.4.6 2.4 1.4 3 .3-.7.8-1.2 1.3-1.4.2 2.2-.4 4.4-1.7 6z" />
        <path d="M15.6 8.6c-.3-1.4 0-2.8.8-4 .2 1 .6 1.6 1.1 2-.2.8-.6 1.5-1.2 2z" fill="#fff3a8" stroke="none" />
      </g>

      <circle className="dg-pet-face" cx="16" cy="16.8" r="9.4" fill={plume} stroke={ink} strokeWidth="1.15" />
      <ellipse cx="12.2" cy="11.6" rx="3.2" ry="1.8" fill="#fff" opacity=".3" transform="rotate(-20 12.2 11.6)" />

      <g className="dg-pet-eyes">
        <ellipse cx="12.4" cy="16.2" rx="1.95" ry="2.25" fill={ink} />
        <ellipse cx="19.6" cy="16.2" rx="1.95" ry="2.25" fill={ink} />
        <circle cx="13" cy="15.3" r=".72" fill="#fff" />
        <circle cx="20.2" cy="15.3" r=".72" fill="#fff" />
        <circle cx="11.8" cy="17.3" r=".3" fill="#ffe46c" />
        <circle cx="19" cy="17.3" r=".3" fill="#ffe46c" />
      </g>
      {/* Ember eyeliner flicks at the outer corners. */}
      <path d="M10.5 15.1 8.7 14.1M21.5 15.1 23.3 14.1" fill="none" stroke="#c9341a" strokeWidth=".75" strokeLinecap="round" />
      <g fill="#ff6b4a" opacity=".45"><ellipse cx="9.2" cy="19.2" rx="1.5" ry=".9" /><ellipse cx="22.8" cy="19.2" rx="1.5" ry=".9" /></g>

      {/* Small hooked beak over a smile. */}
      <path d="M14.7 18.8h2.6l-1.3 1.9z" fill="#ff9a2e" stroke={ink} strokeWidth=".6" strokeLinejoin="round" />
      <path className="dg-pet-mouth-base" d="M14.6 21.4q1.4 1.1 2.8 0" fill="none" stroke={ink} strokeWidth=".75" strokeLinecap="round" />

      {/* Embers lift off the wings and crest. */}
      <g fill="#ffcf4a" stroke="#e8661e" strokeWidth=".3">
        <path className="dg-pet-solspark" d="M5.4 10.6l.5-1.1.5 1.1-.5.9z" />
        <path className="dg-pet-solspark dg-pet-solspark-b" d="M26.2 10.2l.5-1.1.5 1.1-.5.9z" />
        <path className="dg-pet-solspark dg-pet-solspark-c" d="M22.4 7.4l.4-.9.4.9-.4.7z" />
        <path className="dg-pet-solspark dg-pet-solspark-d" d="M28.6 18.6l.4-.9.4.9-.4.7z" />
      </g>

      {/* Crimson band with a little sun disc. */}
      <g className="dg-pet-accessory">
        <path d="M10.3 24.4c3.6 1.5 7.8 1.5 11.4 0l.35 1.5c-3.9 1.7-8.2 1.7-12.1 0z" fill="#a8301a" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
        <circle cx="16" cy="26.7" r="1.15" fill="#ffd34a" stroke={ink} strokeWidth=".4" />
        <path d="M16 24.9v.5M16 28v.5M14.2 26.7h.5M17.3 26.7h.5" stroke="#ffd34a" strokeWidth=".45" strokeLinecap="round" />
      </g>
      <PetExpression left={12.4} right={19.6} y={16.2} mouthY={21.2} ink={ink} />
    </svg>
  );
}

// The dark-sun corona behind Eclipse: fourteen swept flares, built once.
const CORONA = (() => {
  const cx = 16, cy = 16.6, n = 14, step = (Math.PI * 2) / n;
  const pt = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  let d = `M${pt(10.4, 0)}`;
  for (let i = 0; i < n; i++) {
    const a = i * step;
    d += `Q${pt(12, a + step * .2)} ${pt(13.6, a + step * .62)}Q${pt(11.4, a + step * .7)} ${pt(10.4, a + step)}`;
  }
  return d + "z";
})();

// A celestial qilin, the level 20 finale. A starfield coat in front of an
// eclipsed sun: the head is the dark disc, the corona burns around it and
// turns. Crescent-moon horn, silver mane, gold hooves, two motes in orbit.
// The violet rim on every outline is what keeps a near-black pet legible on
// the dark theme; the corona does the rest.
function Eclipse() {
  const id = "ec" + useId().replace(/\W/g, "");
  const ink = "#0e0826";
  const rim = "#a898f6";
  const coat = `url(#${id}-coat)`;
  const silver = `url(#${id}-silver)`;
  const moon = `url(#${id}-moon)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-coat`} cx="44%" cy="44%" r="70%">
          <stop offset="0" stopColor="#7a5fd6" />
          <stop offset=".55" stopColor="#4a3399" />
          <stop offset="1" stopColor="#22175a" />
        </radialGradient>
        <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".6" stopColor="#dfe1f4" />
          <stop offset="1" stopColor="#a9add6" />
        </linearGradient>
        <linearGradient id={`${id}-moon`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset="1" stopColor="#f0c159" />
        </linearGradient>
        <radialGradient id={`${id}-corona`} gradientUnits="userSpaceOnUse" cx="16" cy="16.6" r="13.8">
          <stop offset=".7" stopColor="#fff2c2" />
          <stop offset=".82" stopColor="#ffbe4f" />
          <stop offset="1" stopColor="#e2702e" stopOpacity=".55" />
        </radialGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset=".6" stopColor="#b896ff" stopOpacity=".5" />
          <stop offset="1" stopColor="#8c6cf0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The eclipse: a violet glow that breathes, then the turning corona. */}
      <circle className="dg-pet-umbra" cx="16" cy="16.6" r="14.6" fill={`url(#${id}-glow)`} />
      <path className="dg-pet-corona" d={CORONA} fill={`url(#${id}-corona)`} />

      {/* Lion tail ending in a silver flame tuft. */}
      <g className="dg-pet-tail">
        <path d="M21 27.4c4.4 1.4 6.8-1.2 6.6-4.8" fill="none" stroke={rim} strokeWidth="2.7" strokeLinecap="round" />
        <path d="M21 27.4c4.4 1.4 6.8-1.2 6.6-4.8" fill="none" stroke="#3a2888" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M27.4 23.6c-2.2-.8-2.8-3.2-1.2-5.2.1 1 .6 1.6 1.3 1.8.1-1.2.7-2.1 1.7-2.6-.2 1.2.1 2.2.9 3 .6 1.6-.9 3.4-2.7 3z" fill={silver} stroke="#4b4a7e" strokeWidth=".6" strokeLinejoin="round" />
      </g>

      {/* Body, with gold scale arcs on the chest and gold-shod hooves. */}
      <ellipse cx="16" cy="26.6" rx="7" ry="4.2" fill={coat} stroke={rim} strokeWidth=".9" />
      <path d="M13.1 25.6q.95.95 1.9 0 .95.95 1.9 0 .95.95 1.9 0M14 27.2q1 .9 2 0 1 .9 2 0" fill="none" stroke="#f0c159" strokeWidth=".45" strokeLinecap="round" opacity=".85" />
      <ellipse cx="12.2" cy="29.2" rx="2.3" ry="1.35" fill="#2c1f6a" stroke={rim} strokeWidth=".7" />
      <ellipse cx="19.8" cy="29.2" rx="2.3" ry="1.35" fill="#2c1f6a" stroke={rim} strokeWidth=".7" />
      <path d="M10.3 29.7q1.9 1.3 3.8 0M17.9 29.7q1.9 1.3 3.8 0" fill="none" stroke="#f0c159" strokeWidth=".8" strokeLinecap="round" />

      {/* Silver mane: locks that sweep out below each cheek. */}
      <path d="M11 9C7.4 9.8 5 12.8 5.2 16.6c-1 .8-2 1-3 .8.8 1.6 2.2 2.4 3.8 2.4-.4 1-1.2 1.8-2.2 2.2 2 .6 4.1.1 5.6-1.3z" fill={silver} stroke="#4b4a7e" strokeWidth=".7" strokeLinejoin="round" />
      <path d="M21 9c3.6.8 6 3.8 5.8 7.6 1 .8 2 1 3 .8-.8 1.6-2.2 2.4-3.8 2.4.4 1 1.2 1.8 2.2 2.2-2 .6-4.1.1-5.6-1.3z" fill={silver} stroke="#4b4a7e" strokeWidth=".7" strokeLinejoin="round" />

      {/* Deer-leaf ears over the mane. */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M10.6 11.4C7.8 11.4 5 9.8 3.6 7.2c2.8-.6 5.6.2 7.6 2.2z" fill={coat} stroke={rim} strokeWidth=".75" strokeLinejoin="round" />
        <path d="M9.6 10.4C7.8 10.2 6.2 9.4 5.2 8.1c1.8-.1 3.4.5 4.6 1.6z" fill="#9b82ec" opacity=".75" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M21.4 11.4c2.8 0 5.6-1.6 7-4.2-2.8-.6-5.6.2-7.6 2.2z" fill={coat} stroke={rim} strokeWidth=".75" strokeLinejoin="round" />
        <path d="M22.4 10.4c1.8-.2 3.4-1 4.4-2.3-1.8-.1-3.4.5-4.6 1.6z" fill="#9b82ec" opacity=".75" />
      </g>

      {/* The head is the dark disc of the eclipse, its edge the bright ring. */}
      <circle className="dg-pet-face" cx="16" cy="16.6" r="9.3" fill={coat} stroke="#ffeab4" strokeWidth="1" />
      <ellipse cx="12.4" cy="11.6" rx="3" ry="1.6" fill="#fff" opacity=".14" transform="rotate(-20 12.4 11.6)" />

      {/* Starfield: the coat twinkles out of phase with itself. */}
      <g fill="#e9e4ff">
        <circle className="dg-pet-twinkle" cx="9.6" cy="14.2" r=".4" />
        <circle className="dg-pet-twinkle dg-pet-twinkle-b" cx="22.6" cy="13.4" r=".36" />
        <circle className="dg-pet-twinkle dg-pet-twinkle-c" cx="21.4" cy="22.2" r=".38" />
        <circle className="dg-pet-twinkle dg-pet-twinkle-b" cx="10.4" cy="21.6" r=".32" />
        <circle className="dg-pet-twinkle dg-pet-twinkle-c" cx="13.4" cy="27.6" r=".32" />
        <circle className="dg-pet-twinkle" cx="19" cy="26" r=".3" />
      </g>

      {/* Silver forelock under a crescent-moon horn. */}
      <path d="M13.4 10.2c1-.4 2 0 2.6.8.6-.8 1.6-1.2 2.6-.8-.2 1.3-1.2 2.2-2.6 2.4-1.4-.2-2.4-1.1-2.6-2.4z" fill={silver} stroke="#4b4a7e" strokeWidth=".5" strokeLinejoin="round" />
      <path d="M16.4 9.6A3.6 3.6 0 1 1 19.6 3.4 4.2 4.2 0 0 0 16.4 9.6z" fill={moon} stroke="#8a5c12" strokeWidth=".5" strokeLinejoin="round" />
      <g transform="translate(19.7 3.3)"><path className="dg-pet-glint" d={GLINT} fill="#fff" /></g>

      {/* Eyes with a gold crescent catch along the bottom. */}
      <g className="dg-pet-eyes">
        <ellipse cx="12.4" cy="16.4" rx="2.05" ry="2.35" fill={ink} stroke="#d9d0ff" strokeWidth=".35" />
        <ellipse cx="19.6" cy="16.4" rx="2.05" ry="2.35" fill={ink} stroke="#d9d0ff" strokeWidth=".35" />
        <path d="M10.9 17.3q1.5 1.5 3 0M18.1 17.3q1.5 1.5 3 0" fill="none" stroke="#ffd27a" strokeWidth=".55" strokeLinecap="round" />
        <circle cx="13.05" cy="15.5" r=".72" fill="#fff" />
        <circle cx="20.25" cy="15.5" r=".72" fill="#fff" />
        <circle cx="11.8" cy="16.6" r=".26" fill="#fff" opacity=".8" />
        <circle cx="19" cy="16.6" r=".26" fill="#fff" opacity=".8" />
      </g>

      {/* Pale silver snout. */}
      <ellipse cx="16" cy="20.8" rx="3.7" ry="2.5" fill="#d6d1f5" />
      <circle cx="15.1" cy="19.9" r=".3" fill={ink} opacity=".75" />
      <circle cx="16.9" cy="19.9" r=".3" fill={ink} opacity=".75" />
      <path className="dg-pet-mouth-base" d="M14.2 21.2q1.8 1.7 3.6 0" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />

      {/* Two motes on opposite orbits: one silver, one gold. */}
      <g className="dg-pet-mote"><circle cx="27.8" cy="9.8" r=".75" fill="#fff" /><circle cx="27.8" cy="9.8" r="1.4" fill="#fff" opacity=".22" /></g>
      <g className="dg-pet-mote dg-pet-mote-b"><circle cx="4.4" cy="24.4" r=".65" fill="#ffd27a" /><circle cx="4.4" cy="24.4" r="1.2" fill="#ffd27a" opacity=".25" /></g>

      {/* Midnight band with a tiny eclipse charm. */}
      <g className="dg-pet-accessory">
        <path d="M10.4 24.4c3.6 1.5 7.6 1.5 11.2 0l.35 1.5c-3.8 1.7-8.1 1.7-11.9 0z" fill="#2a1d6e" stroke="#f0c159" strokeWidth=".45" strokeLinejoin="round" />
        <circle cx="16" cy="26.7" r="1.15" fill={ink} stroke="#ffd27a" strokeWidth=".55" />
        <circle cx="16.45" cy="26.3" r=".45" fill="#2a1d6e" />
      </g>
      <PetExpression left={12.4} right={19.6} y={16.4} mouthY={21.2} ink={ink} />
    </svg>
  );
}

export const PETS = [
  { key: "cat", label: "Cat", Svg: Cat },
  { key: "fox", label: "Fox", Svg: Fox },
  { key: "dog", label: "Dog", Svg: Dog },
  { key: "bunny", label: "Bunny", Svg: Bunny },
  { key: "penguin", label: "Penguin", Svg: Penguin },
  { key: "panda", label: "Panda", Svg: Panda },
  { key: "chick", label: "Chick", Svg: Chick },
  { key: "koala", label: "Koala", Svg: Koala },
  { key: "otter", label: "Otter", Svg: Otter },
  { key: "rover", label: "Rover", Svg: Rover },
  { key: "raccoon", label: "Raccoon", Svg: Raccoon },
  { key: "axolotl", label: "Axolotl", Svg: Axolotl },
  { key: "spark", label: "Spark", Svg: Spark },
  { key: "leafy", label: "Leafy", Svg: Leafy },
  { key: "nova", label: "Nova", Svg: Nova },
  { key: "cinder", label: "Lion", Svg: Lion },
  { key: "hoot", label: "Hoot", Svg: Hoot },
  { key: "byte", label: "Byte", Svg: Byte },
  { key: "pebble", label: "Pebble", Svg: Pebble },
  { key: "prickle", label: "Prickle", Svg: Prickle },
  { key: "luna", label: "Luna", Svg: Luna, art: "sprite" },
  { key: "frost", label: "Frost", Svg: Frost },
  { key: "tide", label: "Tide", Svg: Tide },
  { key: "sol", label: "Sol", Svg: Sol },
  { key: "eclipse", label: "Eclipse", Svg: Eclipse },
];

// The rover shipped as a turtle originally and admin configs saved in prod may
// still carry the old key. Map it forward so a saved "featured pet" keeps
// pointing at the pet the admin actually chose instead of silently falling
// back to the first entry.
const LEGACY_KEYS = { turtle: "rover", capybara: "axolotl", lion: "cinder" };

export function getPetByKey(key) {
  const resolved = LEGACY_KEYS[key] || key;
  return PETS.find(pet => pet.key === resolved) || PETS[0];
}

/** Local calendar day as `YYYY-M-D`, used to refresh greeting copy at midnight. */
export function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
