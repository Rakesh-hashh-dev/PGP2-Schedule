/* eslint-disable react-refresh/only-export-components */
// This module deliberately exports the pet registry (PETS) and a helper
// (getPetOfTheDay) alongside the presentational SVG components, so Fast Refresh's
// "components only" rule doesn't apply — the pets are static and rarely edited.

// "Pet of the day" companions for the daily greeting.
//
// Each pet is a small inline SVG (no external assets → CSP-safe) drawn with
// flat, mid-tone illustrative colors that read on both light and dark grounds.
// White-bodied pets carry a faint outline so they don't vanish on the light
// theme. The eyes live in a `.dg-pet-eyes` group so CSS can blink them, and the
// whole figure gets a gentle idle bob — both disabled under reduced-motion
// (see styles.css). One pet is chosen per local day, derived from the date so
// it is identical on every device (see getPetOfTheDay).
//
// The SVGs are `aria-hidden` on purpose: they only ever render inside a labelled
// control (the greeting button) or a decorative preview (the admin panel), so a
// role/label here would double-announce the pet.

import { useId } from "react";

const EYE = "#22242e";

function Cat() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path className="dg-pet-tail" d="M24 22c4 0 4.8 4.8 1.3 5.7-1.6.4-2.8-.5-2.4-1.4.4-.8 2 .1 2-1.6 0-1.2-.8-1.8-2-1.7z" fill="#737c92" />
      <path className="dg-pet-ear dg-pet-ear-left" d="M8 7l3.5 7-5.5-1z" fill="#8b93a7" />
      <path className="dg-pet-ear dg-pet-ear-right" d="M24 7l-3.5 7 5.5-1z" fill="#8b93a7" />
      <path d="M9 8.5l1.6 4-3-.6z" fill="#f0a6c0" />
      <path d="M23 8.5l-1.6 4 3-.6z" fill="#f0a6c0" />
      <circle className="dg-pet-face" cx="16" cy="18" r="10" fill="#8b93a7" />
      <path d="M16 9.3l-1.4 4.6h2.8z" fill="#70798e" opacity=".8" />
      <path d="M11.2 23c1.8 2 7.8 2 9.6 0-.8 2.4-2.6 3.5-4.8 3.5s-4-1.1-4.8-3.5z" fill="#dce1eb" opacity=".9" />
      <g className="dg-pet-eyes">
        <circle cx="12.4" cy="17" r="1.7" fill={EYE} />
        <circle cx="19.6" cy="17" r="1.7" fill={EYE} />
      </g>
      <circle cx="16" cy="19.4" r="1.1" fill="#f0779a" />
      <path d="M14.4 21.2q1.6 1.5 3.2 0" fill="none" stroke={EYE} strokeWidth="1" strokeLinecap="round" />
      <path className="dg-pet-accessory" d="M10.2 24.2c3.5 1.5 8.1 1.5 11.6 0l.4 1.6c-3.8 1.7-8.4 1.7-12.2 0z" fill="#e9829e" />
      <circle className="dg-pet-accessory" cx="16" cy="25.8" r="1.05" fill="#f6ca59" />
      <path d="M6 18h4M6 20l4-.6M22 18h4M22 19.4l4 .6" stroke="#c8ccd6" strokeWidth=".8" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

function Fox() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {/* Flat, front-facing illustrated head — no backing plate, so the
          silhouette carries it. Sized to fill the canvas like the rest of
          the roster (r≈9.5, matching the other pets' ~10) rather than the
          smaller head that fitted inside the earlier badge disc.

          Ears are groups, not single paths, so the orange, the cream inner
          and the dark tip rotate together as one ear (the axolotl's gills
          already use this pattern). */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M8.25 11.55 5.5 2.3 14.25 8.3z" fill="#d9762f" />
        <path d="M8.38 10.05 6.75 5.05 12.5 8.3z" fill="#ffd9b4" opacity=".85" />
        <path d="M5.5 2.3 6.33 5.08 8.13 4.1z" fill="#3a2a22" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M23.75 11.55 26.5 2.3 17.75 8.3z" fill="#d9762f" />
        <path d="M23.62 10.05 25.25 5.05 19.5 8.3z" fill="#ffd9b4" opacity=".85" />
        <path d="M26.5 2.3 25.67 5.08 23.87 4.1z" fill="#3a2a22" />
      </g>
      <circle className="dg-pet-face" cx="16" cy="16.8" r="9.5" fill="#e07f38" />
      <ellipse cx="12.5" cy="11.55" rx="3.25" ry="2.13" fill="#fff" opacity=".14" transform="rotate(-18 12.5 11.55)" />
      {/* White cheek ruff — the fox cue in this style, and a second moving
          layer: it rides the tuft cadence (2.05s), out of phase with the
          ears (2.8s) and the head's breathe (3.3s). */}
      <path className="dg-pet-tuft" d="M10.38 14.3 2.6 17.8 9.25 19.43 3.4 22.8 10.75 22.55z" fill="#fdf7ee" />
      <path className="dg-pet-tuft" d="M21.62 14.3 29.4 17.8 22.75 19.43 28.6 22.8 21.25 22.55z" fill="#fdf7ee" />
      <path d="M16 16.05c-3.38 0-5.63 2.25-5.5 5.13.13 3 2.5 5.5 5.5 6.38 3-.88 5.38-3.38 5.5-6.38.13-2.88-2.13-5.13-5.5-5.13z" fill="#fdf7ee" />
      <g className="dg-pet-eyes">
        <circle cx="12.13" cy="14.8" r="1.88" fill={EYE} />
        <circle cx="19.88" cy="14.8" r="1.88" fill={EYE} />
        <circle cx="12.69" cy="14.18" r=".48" fill="#fff" />
        <circle cx="19.31" cy="14.18" r=".48" fill="#fff" />
      </g>
      <path d="M16 19.05l-1.69 1.56h3.38z" fill="#2b2320" />
      <path d="M16 20.61v1.38M16 21.99q-1.5 1.06-2.38-.19M16 21.99q1.5 1.06 2.38-.19" fill="none" stroke="#2b2320" strokeWidth=".81" strokeLinecap="round" />
      <path className="dg-pet-accessory" d="M10.5 26.3c3.5 1.5 7.5 1.5 11 0l.38 1.63c-3.88 1.75-7.88 1.75-11.75 0z" fill="#5f9ea0" />
      <circle className="dg-pet-accessory" cx="16" cy="28.3" r="1.06" fill="#f6ca59" />
    </svg>
  );
}

function Dog() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path className="dg-pet-tail" d="M23 22c4.5-.4 5.8 4.2 2.4 5.5-1.7.6-3-.2-2.7-1.2.3-.9 2.2.1 2.2-1.6 0-1.1-.8-1.6-2-1.4z" fill="#c58c49" />
      <path className="dg-pet-ear dg-pet-ear-left" d="M6 11c-1 4 0 7 2 8l3-6z" fill="#b07a3e" />
      <path className="dg-pet-ear dg-pet-ear-right" d="M26 11c1 4 0 7-2 8l-3-6z" fill="#b07a3e" />
      <circle className="dg-pet-face" cx="16" cy="17" r="10" fill="#d7a35e" />
      <path d="M10 10.7c2.1-1.7 4.6-2.4 6.6-1.9-1.5.8-2.7 2.1-3.1 3.7z" fill="#bd8547" opacity=".9" />
      <ellipse cx="16" cy="21" rx="6" ry="5" fill="#f0ddc2" />
      <g className="dg-pet-eyes">
        <circle cx="12.6" cy="15.5" r="1.7" fill={EYE} />
        <circle cx="19.4" cy="15.5" r="1.7" fill={EYE} />
      </g>
      <ellipse cx="16" cy="19.5" rx="1.6" ry="1.3" fill="#3a2e2a" />
      <path d="M16 20.8v2.4" stroke="#3a2e2a" strokeWidth="1" strokeLinecap="round" />
      <path d="M16 23.2q2 0 2.4-1.4" fill="#f0779a" />
      <path className="dg-pet-accessory" d="M10.1 23.2c3.3 1.4 8.5 1.4 11.8 0l.3 1.5c-3.7 1.7-8.7 1.7-12.4 0z" fill="#5d83bd" />
      <circle className="dg-pet-accessory" cx="16" cy="25" r="1" fill="#f4cf5c" />
    </svg>
  );
}

function Bunny() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path className="dg-pet-tail" d="M23.5 23c3.4.6 3.8 4.2 1.2 4.8-1.6.3-2.6-.8-2-1.6.4-.7 1.7.4 1.8-.8.1-.8-.7-1.4-1.7-1.3z" fill="#e5e7ed" />
      <rect className="dg-pet-ear dg-pet-ear-left" x="10.5" y="2" width="3.6" height="12" rx="1.8" fill="#f2f3f6" stroke="#d7dae2" strokeWidth=".7" />
      <rect className="dg-pet-ear dg-pet-ear-right" x="17.9" y="2" width="3.6" height="12" rx="1.8" fill="#f2f3f6" stroke="#d7dae2" strokeWidth=".7" />
      <rect x="11.4" y="3.4" width="1.8" height="9" rx=".9" fill="#f3b3c8" />
      <rect x="18.8" y="3.4" width="1.8" height="9" rx=".9" fill="#f3b3c8" />
      <circle className="dg-pet-face" cx="16" cy="19" r="9.5" fill="#f2f3f6" stroke="#d7dae2" strokeWidth=".7" />
      <ellipse cx="16" cy="24.6" rx="4" ry="2.7" fill="#fff" opacity=".6" />
      <g className="dg-pet-eyes">
        <circle cx="12.6" cy="18" r="1.6" fill={EYE} />
        <circle cx="19.4" cy="18" r="1.6" fill={EYE} />
      </g>
      <path d="M16 20.4l-1.3-1.2h2.6z" fill="#f0779a" />
      <circle cx="10.8" cy="21" r="1.6" fill="#f7c9d8" opacity=".8" />
      <circle cx="21.2" cy="21" r="1.6" fill="#f7c9d8" opacity=".8" />
      <path className="dg-pet-accessory" d="M16 25.6l-2.6-1.7-1.8 1.9 1.8 1.7 2.6-1.5 2.6 1.5 1.8-1.7-1.8-1.9z" fill="#af79bb" />
      <circle className="dg-pet-accessory" cx="16" cy="25.6" r="1.15" fill="#f4c45e" />
    </svg>
  );
}

function Penguin() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path className="dg-pet-wing dg-pet-wing-left" d="M8 17c-3.2 1.2-3.3 6.8-.7 7.2 1.8.2 2.5-2.4 2-5.3z" fill="#454d5d" />
      <path className="dg-pet-wing dg-pet-wing-right" d="M24 17c3.2 1.2 3.3 6.8.7 7.2-1.8.2-2.5-2.4-2-5.3z" fill="#454d5d" />
      <ellipse className="dg-pet-face" cx="16" cy="17" rx="10" ry="11" fill="#333947" />
      <ellipse cx="16" cy="19" rx="6.2" ry="8" fill="#f6f7f9" />
      <path className="dg-pet-accessory" d="M9 20.8c4.2 1.6 9.8 1.6 14 0l-.5 2.3c-3.9 1.5-9.1 1.5-13 0z" fill="#77a9c8" />
      <g className="dg-pet-eyes">
        <circle cx="12.8" cy="14.5" r="1.6" fill="#f6f7f9" />
        <circle cx="19.2" cy="14.5" r="1.6" fill="#f6f7f9" />
        <circle cx="12.8" cy="14.5" r=".8" fill={EYE} />
        <circle cx="19.2" cy="14.5" r=".8" fill={EYE} />
      </g>
      <path d="M16 16.4l-2 1.4 2 1.4 2-1.4z" fill="#f0a94e" />
      <ellipse cx="12.2" cy="27" rx="2.8" ry="1.1" fill="#f0a94e" /><ellipse cx="19.8" cy="27" rx="2.8" ry="1.1" fill="#f0a94e" />
    </svg>
  );
}

function Panda() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle className="dg-pet-ear dg-pet-ear-left" cx="8.5" cy="8.5" r="3.4" fill="#2a2d36" />
      <circle className="dg-pet-ear dg-pet-ear-right" cx="23.5" cy="8.5" r="3.4" fill="#2a2d36" />
      <circle className="dg-pet-face" cx="16" cy="17" r="10" fill="#f4f5f8" stroke="#dfe2e9" strokeWidth=".7" />
      <ellipse cx="12" cy="16.5" rx="2.6" ry="3.2" fill="#2a2d36" transform="rotate(-12 12 16.5)" />
      <ellipse cx="20" cy="16.5" rx="2.6" ry="3.2" fill="#2a2d36" transform="rotate(12 20 16.5)" />
      <g className="dg-pet-eyes">
        <circle cx="12" cy="16.5" r="1" fill="#f4f5f8" />
        <circle cx="20" cy="16.5" r="1" fill="#f4f5f8" />
      </g>
      <ellipse cx="16" cy="20" rx="1.5" ry="1.1" fill="#2a2d36" />
      <path d="M16 21v1.6M16 22.6q-1.4 0-1.8-1M16 22.6q1.4 0 1.8-1" fill="none" stroke="#2a2d36" strokeWidth=".8" strokeLinecap="round" />
      <ellipse cx="9.5" cy="21.2" rx="1.5" ry=".8" fill="#f2b7c0" opacity=".55" /><ellipse cx="22.5" cy="21.2" rx="1.5" ry=".8" fill="#f2b7c0" opacity=".55" />
      <path className="dg-pet-accessory" d="M23.3 25.2c2-3 3.2-3.1 3.7-2.4.5.8-1 1.5-1.6 2.6.9-.4 1.8-.2 1.8.6 0 1.2-2.2 1.8-4.6.7z" fill="#79b878" />
    </svg>
  );
}

function Chick() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path className="dg-pet-tuft" d="M13 5l1.5 4h-4z" fill="#f6c34a" />
      <path className="dg-pet-tuft" d="M19 5l-1.5 4h4z" fill="#f6c34a" />
      <path className="dg-pet-wing dg-pet-wing-left" d="M8.5 19c-3.4.5-3.8 4.3-1.2 5.3 1.7.6 3.1-1.8 2.7-4.4z" fill="#efbb48" />
      <path className="dg-pet-wing dg-pet-wing-right" d="M23.5 19c3.4.5 3.8 4.3 1.2 5.3-1.7.6-3.1-1.8-2.7-4.4z" fill="#efbb48" />
      <circle className="dg-pet-face" cx="16" cy="18" r="10" fill="#fbd85f" />
      <ellipse cx="16" cy="21.5" rx="5.4" ry="4.8" fill="#ffe989" opacity=".65" />
      <g className="dg-pet-eyes">
        <circle cx="12.6" cy="16.5" r="1.7" fill={EYE} />
        <circle cx="19.4" cy="16.5" r="1.7" fill={EYE} />
      </g>
      <path d="M16 18.4l-2.6 1.6h5.2z" fill="#f0894e" />
      <circle cx="10.6" cy="20" r="1.5" fill="#f7a26a" opacity=".8" />
      <circle cx="21.4" cy="20" r="1.5" fill="#f7a26a" opacity=".8" />
      <ellipse cx="12.4" cy="27" rx="2.5" ry="1" fill="#f0894e" /><ellipse cx="19.6" cy="27" rx="2.5" ry="1" fill="#f0894e" />
      {/* A bow rather than a collar band: the chick is round with no neck,
          and a band would land on the feet. Without a .dg-pet-accessory
          element at all, the pet page's accessory toggle silently did
          nothing whenever a chick was adopted. */}
      <path className="dg-pet-accessory" d="M16 23.8l-2.4-1.6-1.7 1.8 1.7 1.6 2.4-1.4 2.4 1.4 1.7-1.6-1.7-1.8z" fill="#e0574f" />
      <circle className="dg-pet-accessory" cx="16" cy="23.8" r=".9" fill="#f6ca59" />
    </svg>
  );
}

function Koala() { return <svg viewBox="0 0 32 32" aria-hidden="true"><circle className="dg-pet-ear dg-pet-ear-left" cx="8" cy="10" r="5.2" fill="#aeb7c4" /><circle className="dg-pet-ear dg-pet-ear-right" cx="24" cy="10" r="5.2" fill="#aeb7c4" /><circle cx="8" cy="10" r="3.4" fill="#dfe4eb" /><circle cx="24" cy="10" r="3.4" fill="#dfe4eb" /><circle className="dg-pet-face" cx="16" cy="18" r="10.2" fill="#b9c2cf" /><ellipse cx="16" cy="20.5" rx="5.8" ry="5" fill="#e7ebf0" /><g className="dg-pet-eyes"><circle cx="12.3" cy="16.9" r="1.8" fill="#3a404d" /><circle cx="19.7" cy="16.9" r="1.8" fill="#3a404d" /><circle cx="12.7" cy="16.4" r=".4" fill="#fff" /><circle cx="20.1" cy="16.4" r=".4" fill="#fff" /></g><ellipse cx="16" cy="19.4" rx="2.15" ry="2.6" fill="#4b5361" /><path className="dg-pet-accessory" d="M21.8 24.3c2.4-3.4 4.2-3.2 4.5-2.1.3 1-1.3 1.6-2.1 2.8 1-.4 2.1.1 1.8 1-.5 1.5-2.8 1.5-4.2.2z" fill="#79b878" /></svg>; }

function Otter() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path className="dg-pet-tail" d="M22 23c5.8-.8 6.9 3 4.6 4.8-2 1.6-5.4.2-4.6-1.1.6-1 2.8.4 3.1-1.2.2-1.2-1.1-1.6-3-1.1z" fill="#9a6847" /><circle className="dg-pet-ear dg-pet-ear-left" cx="9.2" cy="10.3" r="3.2" fill="#9a6847" /><circle className="dg-pet-ear dg-pet-ear-right" cx="22.8" cy="10.3" r="3.2" fill="#9a6847" /><circle className="dg-pet-face" cx="16" cy="18" r="10.2" fill="#aa7653" /><ellipse cx="16" cy="21" rx="6.8" ry="4.8" fill="#e4c6a5" /><g className="dg-pet-eyes"><circle cx="12.4" cy="16.5" r="1.55" fill={EYE} /><circle cx="19.6" cy="16.5" r="1.55" fill={EYE} /></g><ellipse cx="16" cy="19.2" rx="1.8" ry="1.25" fill="#4a3027" /><path d="M16 20.4v1.2M16 21.6q-1.6 1-2.2-.2M16 21.6q1.6 1 2.2-.2" fill="none" stroke="#4a3027" strokeWidth=".75" strokeLinecap="round" /><path d="M7 19h4M7 21l4-.7M21 19h4M21 20.3l4 .7" stroke="#76503b" strokeWidth=".7" strokeLinecap="round" /><path className="dg-pet-accessory" d="M10.3 24.6c3.5 1.5 8 1.5 11.5 0l.35 1.55c-3.8 1.7-8.4 1.7-12.2 0z" fill="#e2725b" /><circle className="dg-pet-accessory" cx="16" cy="26.3" r="1" fill="#f6ca59" /></svg>; }

function Rover() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path className="dg-pet-tail" d="M10 22H7.5c-2.5 0-2.5 5 0 5H10zM22 22h2.5c2.5 0 2.5 5 0 5H22z" fill="#4c586b" /><rect x="7" y="20.5" width="18" height="7" rx="3.2" fill="#64748b" /><rect x="9" y="22.2" width="14" height="3.6" rx="1.8" fill="#323d4d" /><path d="M10.2 24h2.6m2 0h2.6m2 0h2.6" stroke="#9aa9b9" strokeWidth=".9" strokeLinecap="round" /><path className="dg-pet-accessory" d="M16 10V6.5m0 0 1.5-1.5" stroke="#6d7e93" strokeWidth="1.1" strokeLinecap="round" /><circle className="dg-pet-accessory" cx="18" cy="5.2" r="1.25" fill="#f3be4d" /><rect className="dg-pet-face" x="7.3" y="10" width="17.4" height="12.8" rx="5" fill="#aebdcc" /><path d="M9.5 13.3h13v6.5h-13z" fill="#344151" /><g className="dg-pet-eyes"><circle cx="12.6" cy="16.5" r="2.05" fill="#dff6fa" /><circle cx="19.4" cy="16.5" r="2.05" fill="#dff6fa" /><circle cx="12.9" cy="16.5" r="1.05" fill="#314454" /><circle cx="19.7" cy="16.5" r="1.05" fill="#314454" /><circle cx="13.25" cy="16.05" r=".32" fill="#fff" /><circle cx="20.05" cy="16.05" r=".32" fill="#fff" /></g><path d="M13.7 20.5q2.3 1.5 4.6 0" fill="none" stroke="#596d7e" strokeWidth=".85" strokeLinecap="round" /><circle cx="9.4" cy="12.2" r=".8" fill="#78c99d" /></svg>; }

function Raccoon() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path className="dg-pet-tail" d="M22 23c5.4-.9 6.7 2.4 4.8 4.4-1.8 1.9-5.1.6-4.6-.7.4-1 2.6.1 3-1.3.3-1.1-1.1-1.5-3.2-1z" fill="#707887" /><path className="dg-pet-tail" d="M24.2 23.5l1.2 3.8M22.8 24.1l1.2 3.3" stroke="#4c5361" strokeWidth="1.1" /><circle className="dg-pet-ear dg-pet-ear-left" cx="8.5" cy="9" r="3.7" fill="#626b7a" /><circle className="dg-pet-ear dg-pet-ear-right" cx="23.5" cy="9" r="3.7" fill="#626b7a" /><circle className="dg-pet-face" cx="16" cy="18" r="10" fill="#9ba4b2" /><path d="M8.7 15.5c2.8-2.5 5-.7 7.3.2 2.3-.9 4.5-2.7 7.3-.2l-1.2 5.3c-2.3 1.2-4.1.2-6.1-.5-2 .7-3.8 1.7-6.1.5z" fill="#48515f" /><g className="dg-pet-eyes"><circle cx="12" cy="17" r="1.25" fill="#f7f8fa" /><circle cx="20" cy="17" r="1.25" fill="#f7f8fa" /></g><ellipse cx="16" cy="20.5" rx="1.6" ry="1.15" fill="#353b47" /><path d="M14.2 22.2q1.8 1.2 3.6 0" fill="none" stroke="#353b47" strokeWidth=".75" strokeLinecap="round" /><path className="dg-pet-accessory" d="M10.3 24.3c3.5 1.5 8 1.5 11.5 0l.35 1.55c-3.8 1.7-8.4 1.7-12.2 0z" fill="#d1584f" /><circle className="dg-pet-accessory" cx="16" cy="26" r="1" fill="#f6ca59" /></svg>; }

function Axolotl() { return <svg viewBox="0 0 32 32" aria-hidden="true"><g className="dg-pet-axolotl-bubbles" fill="none" stroke="#f9d9e8" strokeWidth=".8"><circle cx="25.5" cy="8" r="1.15" /><circle cx="27.8" cy="11.4" r=".65" /><circle cx="5.2" cy="13" r=".7" /></g><path className="dg-pet-tail" d="M22.5 21.5c5.4-.9 6.8 3.8 3.9 5.4-2.4 1.3-4.8-.8-3.2-1.7 1.1-.6 2.5.8 2.9-.5.3-1-1.3-1.6-3.3-1z" fill="#d76f9d" /><path className="dg-pet-face" d="M16 8.4c5.9 0 9.8 3.8 9.8 9.1 0 5.6-4.1 9.2-9.8 9.2s-9.8-3.6-9.8-9.2c0-5.3 3.9-9.1 9.8-9.1z" fill="#f59bc3" /><path d="M10.2 11.5c1.1-1.3 2.2-1.9 3.1-2.1M21.8 11.5c-1.1-1.3-2.2-1.9-3.1-2.1" fill="none" stroke="#ffd4e7" strokeWidth="1.1" strokeLinecap="round" /><g className="dg-pet-ear dg-pet-ear-left dg-pet-axolotl-gill" fill="#e76ea8"><path d="M8.6 12.7 3.5 9.5l2.1-1.3-3.1-2.1 2-1.1 5.1 4.2z" /><path d="m8.4 16.2-5.9 1.3 1.1 1.9-3.7.6 1.6 1.7 6.8-1.1z" /></g><g className="dg-pet-ear dg-pet-ear-right dg-pet-axolotl-gill" fill="#e76ea8"><path d="m23.4 12.7 5.1-3.2-2.1-1.3 3.1-2.1-2-1.1-5.1 4.2z" /><path d="m23.6 16.2 5.9 1.3-1.1 1.9 3.7.6-1.6 1.7-6.8-1.1z" /></g><ellipse cx="16" cy="20.7" rx="6.6" ry="4.4" fill="#ffc2da" /><g className="dg-pet-eyes"><circle cx="12" cy="16.5" r="1.35" fill={EYE} /><circle cx="20" cy="16.5" r="1.35" fill={EYE} /><circle cx="11.6" cy="16.1" r=".35" fill="#fff" /><circle cx="19.6" cy="16.1" r=".35" fill="#fff" /></g><circle cx="9.8" cy="19" r=".75" fill="#f48fb9" opacity=".65" /><circle cx="22.2" cy="19" r=".75" fill="#f48fb9" opacity=".65" /><path d="M16 19.2v1.4m0 0q-1.6 1.2-2.5 0m2.5 0q1.6 1.2 2.5 0" fill="none" stroke="#9b416d" strokeWidth=".8" strokeLinecap="round" /><path className="dg-pet-accessory" d="M10.1 24.2c3.7 1.4 8.1 1.4 11.8 0l.4 1.5c-3.9 1.6-8.7 1.6-12.6 0z" fill="#7c5ce0" /></svg>; }

// The two premium companions — the level 11 and 12 unlocks. The rest of the
// roster is flat colour on a bob; these earn gradients, a full-body pose and a
// signature motion *sequence* (see styles.css §Spark & Leafy). Originals,
// drawn in the spirit of the obvious licensed pair rather than copies of it.
//
// Gradient and clip ids come from useId so two instances on one page (the
// greeting chip and the pet-page hero, say) never reference each other's defs.

function Spark() {
  const id = "sp" + useId().replace(/\W/g, "");
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

      {/* Shockwave: a ring that bursts outward from the head on the beat.
          Scales about the head's centre in view-box units, not its own box. */}
      <circle className="dg-pet-zap" cx="16" cy="17.5" r="12.4" fill="none" stroke="#ffe066" strokeWidth=".8" opacity=".18" />

      {/* Bolt tail: brown at the root like the reference, then a hard zig-zag.
          Its own class carries the flick; the shared one keeps the mood and
          reaction retimes. */}
      <g className="dg-pet-tail dg-pet-bolt-tail">
        <path d="M22.6 22.6 25.8 16.4 23.3 16 27.9 8.1 30.2 9.1 28.2 13.6 30.9 14.3 25.5 23.4z" fill={bolt} stroke="#d99a12" strokeWidth=".5" strokeLinejoin="round" />
        <path d="M22.6 22.6 24.6 18.7 26.9 19.5 25.5 23.4z" fill="#8f5a2a" />
      </g>

      {/* Shoulders, feet and tucked arms — enough body to pose, not enough to
          break the head-first silhouette every other pet has at 40px. */}
      <ellipse cx="16" cy="26.4" rx="7.4" ry="4.4" fill={body} />
      <ellipse cx="11.8" cy="29.3" rx="2.7" ry="1.35" fill="#dfa01a" />
      <ellipse cx="20.2" cy="29.3" rx="2.7" ry="1.35" fill="#dfa01a" />
      <ellipse cx="9.4" cy="25.6" rx="1.7" ry="2.5" fill="#efb92a" transform="rotate(24 9.4 25.6)" />
      <ellipse cx="22.6" cy="25.6" rx="1.7" ry="2.5" fill="#efb92a" transform="rotate(-24 22.6 25.6)" />

      {/* Long ears, black-tipped. The tip is cut along the ear's own edges so
          it stays a tip when the ear rotates. */}
      <g className="dg-pet-ear dg-pet-ear-left dg-pet-zap-ear-l">
        <path d="M12.6 9.2 5.1 1 8.1 11.6z" fill={body} />
        <path d="M7.9 9.8 6.6 5.6 9.9 7.9z" fill="#fff" opacity=".16" />
        <path d="M5.1 1 8.1 4.3 6.3 5.2z" fill="#2a2b36" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right dg-pet-zap-ear-r">
        <path d="M19.4 9.2 26.9 1 23.9 11.6z" fill={body} />
        <path d="M24.1 9.8 25.4 5.6 22.1 7.9z" fill="#fff" opacity=".16" />
        <path d="M26.9 1 23.9 4.3 25.7 5.2z" fill="#2a2b36" />
      </g>

      <circle className="dg-pet-face dg-pet-zap-head" cx="16" cy="17.2" r="9.8" fill={body} />
      <ellipse cx="12.2" cy="11.6" rx="3.4" ry="2" fill="#fff" opacity=".22" transform="rotate(-20 12.2 11.6)" />

      {/* Cheeks: a gradient disc over a soft glow. The glow is what charges. */}
      <circle className="dg-pet-charge" cx="9.7" cy="20.2" r="4.2" fill={`url(#${id}-glow)`} />
      <circle className="dg-pet-charge dg-pet-charge-b" cx="22.3" cy="20.2" r="4.2" fill={`url(#${id}-glow)`} />
      <circle cx="9.7" cy="20.2" r="2.35" fill={`url(#${id}-cheek)`} />
      <circle cx="22.3" cy="20.2" r="2.35" fill={`url(#${id}-cheek)`} />

      {/* Bolts. Four fire together on the beat (dg-pet-spark); the two at
          the ear tips are static crackle that ticks on its own faster clock
          (dg-pet-static), so the pet is never fully quiet between beats.
          All authored visible so the reduced-motion guard leaves a charged
          pet rather than a bare one. */}
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

      {/* Open, delighted mouth — the reference's whole expression. */}
      <path d="M16 18.3l-.7.9h1.4z" fill="#4a3a1c" />
      <path d="M13.3 20.3q2.7 3.4 5.4 0z" fill="#5a2a1c" />
      <path d="M14.5 21.3q1.5 1.9 3 0z" fill="#ef6a72" />
      <path d="M13.3 20.3q2.7 3.4 5.4 0" fill="none" stroke="#4a3a1c" strokeWidth=".85" strokeLinecap="round" />

      {/* Navy band with a bolt charm. */}
      <path className="dg-pet-accessory" d="M10.2 24.7c3.6 1.5 8 1.5 11.6 0l.35 1.55c-3.9 1.7-8.4 1.7-12.3 0z" fill="#3b4a78" />
      <path className="dg-pet-accessory" d="M16.5 25.3 15.2 27.4h1l-.6 1.7 1.8-2.3h-1z" fill="#ffd23f" />
    </svg>
  );
}

function Leafy() {
  const id = "lf" + useId().replace(/\W/g, "");
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

      {/* Spores lift off the bulb and fade. Each sits in a positioning group
          so the CSS transform that floats it doesn't fight a transform
          attribute on the same element. */}
      <g fill="#b9efa8" opacity=".9">
        <g transform="translate(11.2 3.4)"><path className="dg-pet-spore" d={leaf} /></g>
        <g transform="translate(17.4 1.2)"><path className="dg-pet-spore dg-pet-spore-b" d={leaf} /></g>
        <g transform="translate(20.6 5)"><circle className="dg-pet-spore dg-pet-spore-c" r=".65" /></g>
      </g>

      {/* Vines. The group swings from its root (dg-pet-whip); the stroke
          inside extends and retracts along its normalised length
          (dg-pet-vine, pathLength="1"); the leaf at the tip fades with it. A
          rotation and a dash offset can't share an element, hence the pair.
          The root is the top-right (left vine) / top-left (right vine) of the
          group's box, which is what the whip's transform-origin points at. */}
      <g className="dg-pet-whip dg-pet-whip-left">
        <path className="dg-pet-vine" pathLength="1" strokeDasharray="1" d="M9.8 7c-3.2 0-6 1.4-6.9 4.2-.4 1.3.3 2.6 1.5 3" fill="none" stroke="#3f9147" strokeWidth="1.4" strokeLinecap="round" />
        <path className="dg-pet-vine-leaf" d="M4.4 14.2c-1.9-.2-3.1-1.5-2.9-3.4 1.8 0 3 1.4 2.9 3.4z" fill="#8fd58c" />
      </g>
      <g className="dg-pet-whip dg-pet-whip-right">
        <path className="dg-pet-vine dg-pet-vine-b" pathLength="1" strokeDasharray="1" d="M22.2 7c3.2 0 6 1.4 6.9 4.2.4 1.3-.3 2.6-1.5 3" fill="none" stroke="#3f9147" strokeWidth="1.4" strokeLinecap="round" />
        <path className="dg-pet-vine-leaf dg-pet-vine-b" d="M27.6 14.2c1.9-.2 3.1-1.5 2.9-3.4-1.8 0-3 1.4-2.9 3.4z" fill="#8fd58c" />
      </g>

      {/* Sepal leaves at the bulb's base double as the ears: the ear twitch
          rustles them, and the sleepy mood's droop wilts them. */}
      <g className="dg-pet-ear dg-pet-ear-left">
        <path d="M9.6 11.2c-3.2-1.6-6.2-1-8.2 1.6 3 1.4 6 .9 8.2-1.6z" fill="#3f9147" />
        <path d="M9 11.5 3 12.7" fill="none" stroke="#8fd58c" strokeWidth=".45" strokeLinecap="round" opacity=".8" />
      </g>
      <g className="dg-pet-ear dg-pet-ear-right">
        <path d="M22.4 11.2c3.2-1.6 6.2-1 8.2 1.6-3 1.4-6 .9-8.2-1.6z" fill="#3f9147" />
        <path d="M23 11.5 29 12.7" fill="none" stroke="#8fd58c" strokeWidth=".45" strokeLinecap="round" opacity=".8" />
      </g>

      <ellipse cx="16" cy="8.8" rx="8.6" ry="7" fill={`url(#${id}-bulb)`} />
      <path d="M16 2.2c1.3 2.4 1.3 9 0 13.2-1.3-4.2-1.3-10.8 0-13.2z" fill="#2f7d3b" opacity=".5" />
      <path d="M9.6 5.4c1.6-2.2 4.4-3 6.8-2.3-2.4.8-4.6 1.9-6.8 2.3z" fill="#c8f0b6" opacity=".55" />
      {/* Sheen: a streak of light that sweeps the bulb, clipped to it. */}
      <g clipPath={`url(#${id}-clip)`}>
        <g transform="rotate(-28 13 6)"><ellipse className="dg-pet-sheen" cx="13" cy="6" rx="2.4" ry="5.4" fill="#fff" opacity=".2" /></g>
      </g>

      {/* Blossom on the bulb — the accessory the toggle hides. */}
      <g className="dg-pet-accessory">
        <g fill="#ff9fb6">
          <circle cx="21.7" cy="4.2" r=".95" /><circle cx="23.2" cy="5.3" r=".95" /><circle cx="22.6" cy="7.1" r=".95" />
          <circle cx="20.8" cy="7.1" r=".95" /><circle cx="20.2" cy="5.3" r=".95" />
        </g>
        <circle cx="21.7" cy="5.8" r=".85" fill="#ffd44f" />
      </g>

      {/* Rear haunches peek out behind the head; front feet sit in front. */}
      <ellipse cx="5.4" cy="24.6" rx="2.9" ry="2.5" fill="#57a49b" />
      <ellipse cx="26.6" cy="24.6" rx="2.9" ry="2.5" fill="#57a49b" />

      <ellipse className="dg-pet-face" cx="16" cy="20.6" rx="10.4" ry="7.8" fill={`url(#${id}-skin)`} />
      <ellipse cx="11.6" cy="16" rx="3.2" ry="1.8" fill="#fff" opacity=".18" transform="rotate(-16 11.6 16)" />

      <ellipse cx="10.6" cy="27.6" rx="3.5" ry="2.4" fill="#6fbfb6" />
      <ellipse cx="21.4" cy="27.6" rx="3.5" ry="2.4" fill="#6fbfb6" />
      <path d="M8.3 28.8l.5-1 .5 1zM10 29.2l.5-1 .5 1zM21.5 29.2l.5-1 .5 1zM23.2 28.8l.5-1 .5 1z" fill="#eef7f4" />

      {/* Patches — the cue that keeps this from reading as a plain teal blob
          once the detail drops out at chip size. */}
      <g fill="#4a9a90" opacity=".85">
        <path d="M7.2 17.6c1.4-1.2 3.2-.8 3.6.6-1.2 1.1-2.9 1.1-3.6-.6z" />
        <path d="M21.2 18.2c.4-1.4 2.2-1.8 3.6-.6-.7 1.7-2.4 1.7-3.6.6z" />
        <path d="M12.4 13.8c1.1-.7 2.4-.3 2.6.7-1 .6-2.2.5-2.6-.7z" />
        <path d="M17 14.5c.2-1 1.5-1.4 2.6-.7-.4 1.2-1.6 1.3-2.6.7z" />
        <path d="M9.4 26.6c1-.7 2.2-.5 2.6.4-.9.7-2 .6-2.6-.4z" />
        <path d="M20 27c.4-.9 1.6-1.1 2.6-.4-.6 1-1.7 1.1-2.6.4z" />
      </g>

      <g className="dg-pet-eyes">
        <ellipse cx="11.6" cy="19.6" rx="2.5" ry="2.8" fill={`url(#${id}-eye)`} />
        <ellipse cx="20.4" cy="19.6" rx="2.5" ry="2.8" fill={`url(#${id}-eye)`} />
        <ellipse cx="11.9" cy="20" rx="1.15" ry="1.6" fill={EYE} />
        <ellipse cx="20.1" cy="20" rx="1.15" ry="1.6" fill={EYE} />
        <circle cx="12.5" cy="18.4" r=".65" fill="#fff" />
        <circle cx="21" cy="18.4" r=".65" fill="#fff" />
        <circle cx="11" cy="21" r=".3" fill="#fff" opacity=".8" />
        <circle cx="19.5" cy="21" r=".3" fill="#fff" opacity=".8" />
      </g>

      {/* Nostrils, a wide grin, and two little fangs hanging off it. */}
      <circle cx="14.9" cy="22.4" r=".32" fill="#2f5a49" opacity=".7" />
      <circle cx="17.1" cy="22.4" r=".32" fill="#2f5a49" opacity=".7" />
      <path d="M11.4 23.6q4.6 3.8 9.2 0" fill="none" stroke="#2f5a49" strokeWidth="1.05" strokeLinecap="round" />
      <path d="M13 24.7l.55 1.5.55-1.3zM17.9 24.9l.55 1.3.55-1.5z" fill="#f4fbf8" />
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

/** Local calendar day as `YYYY-M-D` — the unit the pet rotates on. */
export function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// FNV-1a over the day key. Any stable string hash would do; this one is short,
// dependency-free and spreads consecutive days across the list instead of
// walking it in order.
function hashDay(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The companion for `now`'s local day.
 *
 * Derived purely from the date, so it needs no storage and every device — and
 * every student — sees the same pet on the same day. (It used to be a random
 * pick cached in localStorage, which made "pet of the day" per-device and
 * re-rollable by clearing site data.)
 */
export function getPetOfTheDay(now = new Date()) {
  return PETS[hashDay(dayKey(now)) % PETS.length];
}
