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
    </svg>
  );
}

function Koala() { return <svg viewBox="0 0 32 32" aria-hidden="true"><circle className="dg-pet-ear dg-pet-ear-left" cx="8" cy="10" r="5.2" fill="#aeb7c4" /><circle className="dg-pet-ear dg-pet-ear-right" cx="24" cy="10" r="5.2" fill="#aeb7c4" /><circle cx="8" cy="10" r="3.4" fill="#dfe4eb" /><circle cx="24" cy="10" r="3.4" fill="#dfe4eb" /><circle className="dg-pet-face" cx="16" cy="18" r="10.2" fill="#b9c2cf" /><ellipse cx="16" cy="20.5" rx="5.8" ry="5" fill="#e7ebf0" /><g className="dg-pet-eyes"><circle cx="12.3" cy="16.9" r="1.8" fill="#3a404d" /><circle cx="19.7" cy="16.9" r="1.8" fill="#3a404d" /><circle cx="12.7" cy="16.4" r=".4" fill="#fff" /><circle cx="20.1" cy="16.4" r=".4" fill="#fff" /></g><ellipse cx="16" cy="19.4" rx="2.15" ry="2.6" fill="#4b5361" /><path className="dg-pet-accessory" d="M21.8 24.3c2.4-3.4 4.2-3.2 4.5-2.1.3 1-1.3 1.6-2.1 2.8 1-.4 2.1.1 1.8 1-.5 1.5-2.8 1.5-4.2.2z" fill="#79b878" /></svg>; }

function Otter() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path className="dg-pet-tail" d="M22 23c5.8-.8 6.9 3 4.6 4.8-2 1.6-5.4.2-4.6-1.1.6-1 2.8.4 3.1-1.2.2-1.2-1.1-1.6-3-1.1z" fill="#9a6847" /><circle className="dg-pet-ear dg-pet-ear-left" cx="9.2" cy="10.3" r="3.2" fill="#9a6847" /><circle className="dg-pet-ear dg-pet-ear-right" cx="22.8" cy="10.3" r="3.2" fill="#9a6847" /><circle className="dg-pet-face" cx="16" cy="18" r="10.2" fill="#aa7653" /><ellipse cx="16" cy="21" rx="6.8" ry="4.8" fill="#e4c6a5" /><g className="dg-pet-eyes"><circle cx="12.4" cy="16.5" r="1.55" fill={EYE} /><circle cx="19.6" cy="16.5" r="1.55" fill={EYE} /></g><ellipse cx="16" cy="19.2" rx="1.8" ry="1.25" fill="#4a3027" /><path d="M16 20.4v1.2M16 21.6q-1.6 1-2.2-.2M16 21.6q1.6 1 2.2-.2" fill="none" stroke="#4a3027" strokeWidth=".75" strokeLinecap="round" /><path d="M7 19h4M7 21l4-.7M21 19h4M21 20.3l4 .7" stroke="#76503b" strokeWidth=".7" strokeLinecap="round" /></svg>; }

function Rover() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path className="dg-pet-tail" d="M10 22H7.5c-2.5 0-2.5 5 0 5H10zM22 22h2.5c2.5 0 2.5 5 0 5H22z" fill="#4c586b" /><rect x="7" y="20.5" width="18" height="7" rx="3.2" fill="#64748b" /><rect x="9" y="22.2" width="14" height="3.6" rx="1.8" fill="#323d4d" /><path d="M10.2 24h2.6m2 0h2.6m2 0h2.6" stroke="#9aa9b9" strokeWidth=".9" strokeLinecap="round" /><path className="dg-pet-accessory" d="M16 10V6.5m0 0 1.5-1.5" stroke="#6d7e93" strokeWidth="1.1" strokeLinecap="round" /><circle className="dg-pet-accessory" cx="18" cy="5.2" r="1.25" fill="#f3be4d" /><rect className="dg-pet-face" x="7.3" y="10" width="17.4" height="12.8" rx="5" fill="#aebdcc" /><path d="M9.5 13.3h13v6.5h-13z" fill="#344151" /><g className="dg-pet-eyes"><circle cx="12.6" cy="16.5" r="2.05" fill="#dff6fa" /><circle cx="19.4" cy="16.5" r="2.05" fill="#dff6fa" /><circle cx="12.9" cy="16.5" r="1.05" fill="#314454" /><circle cx="19.7" cy="16.5" r="1.05" fill="#314454" /><circle cx="13.25" cy="16.05" r=".32" fill="#fff" /><circle cx="20.05" cy="16.05" r=".32" fill="#fff" /></g><path d="M13.7 20.5q2.3 1.5 4.6 0" fill="none" stroke="#596d7e" strokeWidth=".85" strokeLinecap="round" /><circle cx="9.4" cy="12.2" r=".8" fill="#78c99d" /></svg>; }

function Raccoon() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path className="dg-pet-tail" d="M22 23c5.4-.9 6.7 2.4 4.8 4.4-1.8 1.9-5.1.6-4.6-.7.4-1 2.6.1 3-1.3.3-1.1-1.1-1.5-3.2-1z" fill="#707887" /><path className="dg-pet-tail" d="M24.2 23.5l1.2 3.8M22.8 24.1l1.2 3.3" stroke="#4c5361" strokeWidth="1.1" /><circle className="dg-pet-ear dg-pet-ear-left" cx="8.5" cy="9" r="3.7" fill="#626b7a" /><circle className="dg-pet-ear dg-pet-ear-right" cx="23.5" cy="9" r="3.7" fill="#626b7a" /><circle className="dg-pet-face" cx="16" cy="18" r="10" fill="#9ba4b2" /><path d="M8.7 15.5c2.8-2.5 5-.7 7.3.2 2.3-.9 4.5-2.7 7.3-.2l-1.2 5.3c-2.3 1.2-4.1.2-6.1-.5-2 .7-3.8 1.7-6.1.5z" fill="#48515f" /><g className="dg-pet-eyes"><circle cx="12" cy="17" r="1.25" fill="#f7f8fa" /><circle cx="20" cy="17" r="1.25" fill="#f7f8fa" /></g><ellipse cx="16" cy="20.5" rx="1.6" ry="1.15" fill="#353b47" /><path d="M14.2 22.2q1.8 1.2 3.6 0" fill="none" stroke="#353b47" strokeWidth=".75" strokeLinecap="round" /></svg>; }

function Axolotl() { return <svg viewBox="0 0 32 32" aria-hidden="true"><g className="dg-pet-axolotl-bubbles" fill="none" stroke="#f9d9e8" strokeWidth=".8"><circle cx="25.5" cy="8" r="1.15" /><circle cx="27.8" cy="11.4" r=".65" /><circle cx="5.2" cy="13" r=".7" /></g><path className="dg-pet-tail" d="M22.5 21.5c5.4-.9 6.8 3.8 3.9 5.4-2.4 1.3-4.8-.8-3.2-1.7 1.1-.6 2.5.8 2.9-.5.3-1-1.3-1.6-3.3-1z" fill="#d76f9d" /><path className="dg-pet-face" d="M16 8.4c5.9 0 9.8 3.8 9.8 9.1 0 5.6-4.1 9.2-9.8 9.2s-9.8-3.6-9.8-9.2c0-5.3 3.9-9.1 9.8-9.1z" fill="#f59bc3" /><path d="M10.2 11.5c1.1-1.3 2.2-1.9 3.1-2.1M21.8 11.5c-1.1-1.3-2.2-1.9-3.1-2.1" fill="none" stroke="#ffd4e7" strokeWidth="1.1" strokeLinecap="round" /><g className="dg-pet-ear dg-pet-ear-left dg-pet-axolotl-gill" fill="#e76ea8"><path d="M8.6 12.7 3.5 9.5l2.1-1.3-3.1-2.1 2-1.1 5.1 4.2z" /><path d="m8.4 16.2-5.9 1.3 1.1 1.9-3.7.6 1.6 1.7 6.8-1.1z" /></g><g className="dg-pet-ear dg-pet-ear-right dg-pet-axolotl-gill" fill="#e76ea8"><path d="m23.4 12.7 5.1-3.2-2.1-1.3 3.1-2.1-2-1.1-5.1 4.2z" /><path d="m23.6 16.2 5.9 1.3-1.1 1.9 3.7.6-1.6 1.7-6.8-1.1z" /></g><ellipse cx="16" cy="20.7" rx="6.6" ry="4.4" fill="#ffc2da" /><g className="dg-pet-eyes"><circle cx="12" cy="16.5" r="1.35" fill={EYE} /><circle cx="20" cy="16.5" r="1.35" fill={EYE} /><circle cx="11.6" cy="16.1" r=".35" fill="#fff" /><circle cx="19.6" cy="16.1" r=".35" fill="#fff" /></g><circle cx="9.8" cy="19" r=".75" fill="#f48fb9" opacity=".65" /><circle cx="22.2" cy="19" r=".75" fill="#f48fb9" opacity=".65" /><path d="M16 19.2v1.4m0 0q-1.6 1.2-2.5 0m2.5 0q1.6 1.2 2.5 0" fill="none" stroke="#9b416d" strokeWidth=".8" strokeLinecap="round" /><path className="dg-pet-accessory" d="M10.1 24.2c3.7 1.4 8.1 1.4 11.8 0l.4 1.5c-3.9 1.6-8.7 1.6-12.6 0z" fill="#7c5ce0" /></svg>; }

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
