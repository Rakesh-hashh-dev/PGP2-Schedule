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
      <path d="M16 21.7v.7M16 22.4q-1.25 1.25-2.2 0M16 22.4q1.25 1.25 2.2 0" fill="none" stroke={ink} strokeWidth=".9" strokeLinecap="round" />

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
        className="dg-pet-sig dg-pet-sig-fox"
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
      <path d="M16 20.4v.9" stroke={ink} strokeWidth=".8" strokeLinecap="round" />
      <path d="M13.8 21.2q2.2 2 4.4 0c.1 2.8-.9 3.9-2.2 3.9s-2.3-1.1-2.2-3.9z" fill={ink} />
      <path className="dg-pet-sig dg-pet-sig-dog" d="M14.7 22.1q1.3 1.1 2.6 0c.05 2.1-.4 2.9-1.3 2.9s-1.35-.8-1.3-2.9z" fill="#f4788f" />
      <path d="M16 22.8v1.7" stroke="#d8586f" strokeWidth=".35" strokeLinecap="round" opacity=".7" />

      {/* Collar with gold bone tag */}
      <path className="dg-pet-accessory" d="M11.6 24.2c2.8 1.1 6 1.1 8.8 0l.3 1.4c-3.1 1.2-6.3 1.2-9.4 0z" fill="#4d82b2" stroke={ink} strokeWidth=".55" strokeLinejoin="round" />
      <g className="dg-pet-accessory">
        <path d="M14.7 26.2c-.3-.3-.7-.3-.9 0-.3.3-.2.8.1 1-.3.2-.4.6-.1.9.3.3.7.3.9 0h2.6c.3.3.7.3.9 0 .3-.3.2-.8-.1-1 .3-.2.4-.6.1-.9-.3-.3-.7-.3-.9 0z" fill="#f6ca59" stroke={ink} strokeWidth=".35" />
        <circle cx="15.2" cy="26.8" r=".25" fill="#ffffff" />
      </g>
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
      <path d="M16 20.8v.65M16 21.45q-1.1 1-2 0M16 21.45q1.1 1 2 0" fill="none" stroke={ink} strokeWidth=".75" strokeLinecap="round" />
      {/* Whisker ticks */}
      <path d="M6.6 20h3.6M6.4 21.6l3.4-.5M25.4 20h-3.6M25.6 21.6l-3.4-.5" fill="none" stroke="#8a92a8" strokeWidth=".65" strokeLinecap="round" opacity=".85" />

      {/* Bow tie accessory with dimensional knot */}
      <path className="dg-pet-accessory" d="M16 25.2l-2.8-1.7-1.7 1.9 1.9 1.7 2.6-1.4 2.6 1.4 1.9-1.7-1.7-1.9z" fill="#9f6abf" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
      <path d="M16 25.2l-2.8-1.7" stroke="#b988d4" strokeWidth=".6" strokeLinecap="round" opacity=".6" />
      <path d="M16 25.2l2.6 1.4" stroke="#b988d4" strokeWidth=".6" strokeLinecap="round" opacity=".6" />
      <circle className="dg-pet-accessory" cx="16" cy="25.2" r="1.1" fill="#f8ce5e" stroke={ink} strokeWidth=".4" />
      <circle cx="15.7" cy="24.9" r=".3" fill="#fff" opacity=".9" />
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
      <path className="dg-pet-sig dg-pet-sig-panda" d="M16 20.7v.8M16 21.5q-1.4.9-2.1 0M16 21.5q1.4.9 2.1 0" fill="none" stroke={ink} strokeWidth=".85" strokeLinecap="round" />

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
      <path d="M13.8 23q2.2 1.6 4.4 0" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />

      {/* Eucalyptus sprig accessory */}
      <g className="dg-pet-accessory">
        <path d="M21.8 25c2.6-3.4 4.6-3 5-1.8.4 1.2-1.4 2-2.2 3.2 1-.5 2.2 0 1.9 1-.5 1.6-3 1.6-4.7.2z" fill="#6ba86b" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
        <path d="M22.6 25.2q1.6-1.5 3.2-1.8M23 26.2q1.4-.5 2.5-.4" fill="none" stroke="#487848" strokeWidth=".5" strokeLinecap="round" />
      </g>
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
      <path d="M16 21.3v1.2M16 22.5q-1.6 1-2.2-.2M16 22.5q1.6 1 2.2-.2" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />

      {/* Whiskers */}
      <path d="M6.6 19.6h4.4M6.6 21.6l4.4-.7M21 19.6h4.4M21 20.9l4.4.7" stroke={ink} strokeWidth=".7" strokeLinecap="round" opacity=".75" />

      {/* Coral collar with bell */}
      <path className="dg-pet-accessory" d="M10.2 25c3.6 1.4 8 1.4 11.6 0l.35 1.5c-3.9 1.6-8.3 1.6-12.3 0z" fill="#e26c54" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
      <circle className="dg-pet-accessory" cx="16" cy="26.8" r="1.1" fill="#f6ca59" stroke={ink} strokeWidth=".4" />
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
      <path d="M13.6 20.8q2.4 1.5 4.8 0" fill="none" stroke="#485c70" strokeWidth=".85" strokeLinecap="round" />

      {/* Lower base and front tracks */}
      <rect x="8.4" y="22.2" width="15.2" height="6.2" rx="2.8" fill="#323e4d" stroke={ink} strokeWidth="1.15" />
      <path d="M10.8 25.2h2.6m2 0h2.6m2 0h2.6" stroke="#8fa0b2" strokeWidth=".95" strokeLinecap="round" />

      {/* Top antenna beacon accessory */}
      <g className="dg-pet-accessory">
        <path d="M16 9.6V5.8m0 0 1.6-1.6" stroke={ink} strokeWidth="1.1" strokeLinecap="round" fill="none" />
        <circle cx="18" cy="4.4" r="1.3" fill="#f4c45e" stroke={ink} strokeWidth=".4" />
      </g>
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
      <path d="M16 21.6v.8M16 22.4q-1.4 1-2.2 0M16 22.4q1.4 1 2.2 0" fill="none" stroke={ink} strokeWidth=".8" strokeLinecap="round" />

      {/* Whiskers */}
      <path d="M9.2 21h-3M9.4 22.4l-2.8.6M22.8 21h3M22.6 22.4l2.8.6" fill="none" stroke="#778091" strokeWidth=".65" strokeLinecap="round" />

      {/* Crimson collar accessory */}
      <path className="dg-pet-accessory" d="M10.2 25.2c3.6 1.4 8 1.4 11.6 0l.35 1.5c-3.9 1.6-8.3 1.6-12.3 0z" fill="#cf4e46" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
      <circle className="dg-pet-accessory" cx="16" cy="26.8" r="1.1" fill="#f6ca59" stroke={ink} strokeWidth=".4" />
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
      <path d="M16 19.4v1.4m0 0q-1.8 1.4-2.8 0m2.8 0q1.8 1.4 2.8 0" fill="none" stroke={ink} strokeWidth=".85" strokeLinecap="round" />

      {/* Sea-pearl collar accessory */}
      <path className="dg-pet-accessory" d="M10 24.4c3.8 1.4 8.2 1.4 12 0l.4 1.6c-4 1.6-8.8 1.6-12.8 0z" fill="#7a58d8" stroke={ink} strokeWidth=".5" strokeLinejoin="round" />
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
      <path d="M13.3 20.3q2.7 3.4 5.4 0z" fill="#5a2a1c" />
      <path d="M14.5 21.3q1.5 1.9 3 0z" fill="#ef6a72" />
      <path d="M13.3 20.3q2.7 3.4 5.4 0" fill="none" stroke="#4a3a1c" strokeWidth=".85" strokeLinecap="round" />

      {/* Navy band with bolt charm */}
      <path className="dg-pet-accessory" d="M10.2 24.7c3.6 1.5 8 1.5 11.6 0l.35 1.55c-3.9 1.7-8.4 1.7-12.3 0z" fill="#2d3b66" stroke={ink} strokeWidth=".55" strokeLinejoin="round" />
      <path className="dg-pet-accessory" d="M16.5 25.3 15.2 27.4h1l-.6 1.7 1.8-2.3h-1z" fill="#ffd23f" stroke={ink} strokeWidth=".4" />
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
      <path d="M11.4 23.6q4.6 3.8 9.2 0" fill="none" stroke={ink} strokeWidth="1.05" strokeLinecap="round" />
      <path d="M13 24.7l.55 1.5.55-1.3zM17.9 24.9l.55 1.3.55-1.5z" fill="#f4fbf8" stroke={ink} strokeWidth=".3" />
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
      <path d="M13.6 21.4q2.4 2.6 4.8 0" fill="none" stroke="#12102e" strokeWidth=".9" strokeLinecap="round" />

      {/* Celestial choker with golden compass star */}
      <path className="dg-pet-accessory" d="M10.2 24.6c3.6 1.5 8 1.5 11.6 0l.35 1.55c-3.9 1.7-8.4 1.7-12.3 0z" fill="#6d58cf" stroke="#818cf8" strokeWidth=".45" strokeLinejoin="round" />
      <path className="dg-pet-accessory" d="M16 25.4 16.7 27 18.3 27.7 16.7 28.4 16 30 15.3 28.4 13.7 27.7 15.3 27z" fill={star} stroke="#d99a18" strokeWidth=".35" />
    </svg>
  );
}

function Cinder() {
  const id = "cd" + useId().replace(/\W/g, "");
  const ink = "#140c14";
  const coat = `url(#${id}-coat)`;
  const flame = `url(#${id}-flame)`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-coat`} cx="40%" cy="28%" r="80%">
          <stop offset="0" stopColor="#5d4a52" />
          <stop offset=".5" stopColor="#40323c" />
          <stop offset="1" stopColor="#241c25" />
        </radialGradient>
        <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f04d2a" />
          <stop offset=".5" stopColor="#ff8a2b" />
          <stop offset="1" stopColor="#ffd166" />
        </linearGradient>
        <radialGradient id={`${id}-heat`}>
          <stop offset="0" stopColor="#ff9b3d" stopOpacity=".8" />
          <stop offset=".6" stopColor="#f0592a" stopOpacity=".28" />
          <stop offset="1" stopColor="#f0592a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Embers drifting up off the coat */}
      <g fill="#ffb257">
        <circle className="dg-pet-ember" cx="7.4" cy="12" r=".5" />
        <circle className="dg-pet-ember dg-pet-ember-b" cx="25.2" cy="10.4" r=".42" />
        <circle className="dg-pet-ember dg-pet-ember-c" cx="27" cy="16.6" r=".38" />
      </g>

      {/* Flame tail — three tongues that flicker independently */}
      <g className="dg-pet-tail dg-pet-flame">
        <path d="M22.6 24.4c3.4-.6 5.2-3 5.4-6.4 1.9 2.4 2.4 5.4 1 7.6-1.4 2.2-4.2 2.8-6.4 1.4z" fill={flame} stroke="#241c25" strokeWidth=".6" />
        <path className="dg-pet-flicker" d="M24.4 23.8c1.8-.8 2.6-2.4 2.5-4.6 1.1 1.6 1.3 3.5.5 4.9-.8 1.4-2.2 1.7-3 .8z" fill="#ffd166" opacity=".9" />
        <path className="dg-pet-flicker dg-pet-flicker-b" d="M22.9 25.6c1.2-.2 2-.9 2.4-2 .3 1.3 0 2.4-.8 3-.9.6-1.8.3-1.6-1z" fill="#fff0c2" opacity=".75" />
      </g>

      {/* Body with glowing molten magma crack veins */}
      <ellipse cx="16" cy="26.4" rx="6.9" ry="4.1" fill={coat} stroke="#ea580c" strokeWidth=".85" />
      <path d="M14.2 24.6l.8 1.2-.6 1.4M17.8 24.8l-.6 1.3.8 1.2" fill="none" stroke="#f97316" strokeWidth=".6" strokeLinecap="round" />
      <ellipse cx="12.3" cy="29.3" rx="2.4" ry="1.2" fill="#191319" stroke="#ea580c" strokeWidth=".6" />
      <path d="M11.6 29.3l.6.4M12.8 29.3l.5.4" stroke="#fbbf24" strokeWidth=".45" strokeLinecap="round" />
      <ellipse cx="19.7" cy="29.3" rx="2.4" ry="1.2" fill="#191319" stroke="#ea580c" strokeWidth=".6" />
      <path d="M19.1 29.3l.6.4M20.3 29.3l.5.4" stroke="#fbbf24" strokeWidth=".45" strokeLinecap="round" />

      {/* Pointed obsidian ears with crystal facet highlights and burning inner fire */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M12.2 9.6 6.4 2.2 6.9 11.6z" fill={coat} stroke="#ea580c" strokeWidth=".85" strokeLinejoin="round" />
        <path d="M10.9 9.4 8 5.6 8.3 10.6z" fill={flame} opacity=".9" />
        <path d="M6.4 2.2l1.6 4.8-1.1 4.6" fill="none" stroke="#a78bfa" strokeWidth=".4" opacity=".5" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M19.8 9.6 25.6 2.2 25.1 11.6z" fill={coat} stroke="#ea580c" strokeWidth=".85" strokeLinejoin="round" />
        <path d="M21.1 9.4 24 5.6 23.7 10.6z" fill={flame} opacity=".9" />
        <path d="M25.6 2.2l-1.6 4.8 1.1 4.6" fill="none" stroke="#a78bfa" strokeWidth=".4" opacity=".5" />
      </g>

      <circle className="dg-pet-heat" cx="16" cy="18.6" r="11.8" fill={`url(#${id}-heat)`} />
      {/* Head with amber heat-rim outline */}
      <circle className="dg-pet-face" cx="16" cy="17.4" r="9.7" fill={coat} stroke="#ea580c" strokeWidth=".95" />
      <ellipse cx="12.2" cy="11.9" rx="3.3" ry="1.9" fill="#fff" opacity=".12" transform="rotate(-20 12.2 11.9)" />

      {/* Brow flame and throat glow */}
      <path className="dg-pet-glow" d="M16 9.6c1.4 1.6 2 3.2 1.8 4.8-.2 1.5-1 2.6-2.4 3.2.6-1.4.7-2.6.3-3.6-.4-1-1-2.4.3-4.4z" fill={flame} opacity=".9" />
      <ellipse className="dg-pet-glow dg-pet-glow-b" cx="16" cy="25.6" rx="3.4" ry="1.4" fill="#ff9b3d" opacity=".38" />

      <g className="dg-pet-eyes">
        <ellipse cx="12.4" cy="17.4" rx="2" ry="2.2" fill="#1a1218" />
        <ellipse cx="19.6" cy="17.4" rx="2" ry="2.2" fill="#1a1218" />
        <circle cx="12.4" cy="17.4" r=".95" fill="#ffb257" />
        <circle cx="19.6" cy="17.4" r=".95" fill="#ffb257" />
        <circle cx="13" cy="16.7" r=".38" fill="#fff5e0" />
        <circle cx="20.2" cy="16.7" r=".38" fill="#fff5e0" />
      </g>

      <path d="M16 20.1l-1 1.1h2z" fill="#1a1218" />
      <path d="M13.8 22q2.2 2.2 4.4 0" fill="none" stroke="#1a1218" strokeWidth=".9" strokeLinecap="round" />

      {/* Volcanic choker collar with glowing fire-drop jewel */}
      <path className="dg-pet-accessory" d="M10.3 25c3.6 1.5 8 1.5 11.6 0l.35 1.55c-3.9 1.7-8.4 1.7-12.3 0z" fill="#24151a" stroke="#ea580c" strokeWidth=".5" strokeLinejoin="round" />
      <g className="dg-pet-accessory">
        <path d="M16 26.2c.8 0 1.4.6 1.4 1.4 0 1.2-1.4 2.4-1.4 2.4s-1.4-1.2-1.4-2.4c0-.8.6-1.4 1.4-1.4z" fill={flame} stroke="#24151a" strokeWidth=".4" />
        <circle cx="15.7" cy="27.2" r=".3" fill="#ffffff" />
      </g>
    </svg>
  );
}

// Order is stable — the day's index maps into this list, so reordering or
// removing an entry changes which pet every past/future date resolves to.
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
  { key: "cinder", label: "Cinder", Svg: Cinder },
];

// The rover shipped as a turtle originally and admin configs saved in prod may
// still carry the old key. Map it forward so a saved "featured pet" keeps
// pointing at the pet the admin actually chose instead of silently falling
// back to the first entry.
const LEGACY_KEYS = { turtle: "rover", capybara: "axolotl" };

export function getPetByKey(key) {
  const resolved = LEGACY_KEYS[key] || key;
  return PETS.find(pet => pet.key === resolved) || PETS[0];
}

/** Local calendar day as `YYYY-M-D`, used to refresh greeting copy at midnight. */
export function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
