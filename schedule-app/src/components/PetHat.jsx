// Wearables, drawn once for all twelve companions.
//
// Same trick as `PetSleepCue`: rather than adding a hat to every pet's SVG
// (twelve edits per hat, and a thirteenth pet inherits none of them), the hat
// is one overlay sitting on top of the pet inside the `.dg-pet` box. It
// inherits the same `.dg-pet svg` rules as the artwork underneath, so it
// leans, saturates and drop-shadows with the animal rather than floating
// beside it.
//
// The heads are not all the same, though — the cat's crown sits at y≈8, the
// robot's flat top at y≈10, the leafy's low ellipse at y≈13 — so each pet
// declares a `--pet-hat-y` (and where it needs one, `--pet-hat-x` / `-scale`)
// in styles.css, and everything here is drawn against one canonical head whose
// top edge is y=8.
const HATS = {
  bow: (
    <g>
      <path d="M16 8.6 11.4 6.2c-.5-.3-1.1.1-1 .7l.7 3.6c.1.5.6.8 1.1.6z" fill="#e2679b" />
      <path d="M16 8.6l4.6-2.4c.5-.3 1.1.1 1 .7l-.7 3.6c-.1.5-.6.8-1.1.6z" fill="#e2679b" />
      <circle cx="16" cy="8.7" r="1.15" fill="#f7a8c6" />
    </g>
  ),
  bloom: (
    <g>
      <path d="M8.6 8.9c-.5-2.6 1.1-4 2.9-3.6M23.4 8.9c.5-2.6-1.1-4-2.9-3.6" fill="none" stroke="#7fae63" strokeWidth=".9" strokeLinecap="round" />
      <path d="M8.2 8.6c2.6-3.9 12.9-4 15.6 0z" fill="#7fae63" />
      <g fill="#f2a0c0"><circle cx="10.6" cy="6.5" r="1.5" /><circle cx="16" cy="5.2" r="1.75" /><circle cx="21.4" cy="6.5" r="1.5" /></g>
      <g fill="#fff2b0"><circle cx="10.6" cy="6.5" r=".55" /><circle cx="16" cy="5.2" r=".65" /><circle cx="21.4" cy="6.5" r=".55" /></g>
    </g>
  ),
  phones: (
    <g>
      <path d="M6.4 12.4v-1.6a9.6 9.6 0 0 1 19.2 0v1.6" fill="none" stroke="#3f4756" strokeWidth="1.9" strokeLinecap="round" />
      <rect x="4.3" y="11.2" width="4.4" height="6.4" rx="2.2" fill="#e05a72" />
      <rect x="23.3" y="11.2" width="4.4" height="6.4" rx="2.2" fill="#e05a72" />
      <rect x="5.5" y="12.5" width="2" height="3.8" rx="1" fill="#ffb4c0" opacity=".8" />
      <rect x="24.5" y="12.5" width="2" height="3.8" rx="1" fill="#ffb4c0" opacity=".8" />
    </g>
  ),
  /* Horns AND tail, deliberately as one wearable. Splitting them would mean a
     second cosmetic slot and a pet in horns with no tail, which is worse art
     than either piece on its own. The tail is drawn off the right-hand edge —
     the SVG is `overflow: visible`, so it can hang outside the 32-unit box the
     way the greeting pet's own tails already do. */
  devil: (
    <g>
      <path d="M9.6 8.4c-1.5-1.4-2.6-3-2.4-4.9 1.9.9 3.4 2.3 4.3 4.1z" fill="#d1483f" />
      <path d="M22.4 8.4c1.5-1.4 2.6-3 2.4-4.9-1.9.9-3.4 2.3-4.3 4.1z" fill="#d1483f" />
      <path d="M9.6 8.4c-1-1-1.7-2-1.8-3.1 1.2.7 2.1 1.6 2.7 2.7z" fill="#ec6a5e" />
      <path d="M22.4 8.4c1-1 1.7-2 1.8-3.1-1.2.7-2.1 1.6-2.7 2.7z" fill="#ec6a5e" />
      <path d="M25.6 21.4c3.9.6 5.4 3.2 4.6 5.4-.6 1.6-2.3 2.2-3.1 1.5-.7-.6-.2-1.6.6-1.6.9 0 1.2-1 .6-1.8-.6-.8-1.8-1.2-2.9-1.3z" fill="#d1483f" />
      <path d="M31.2 25.6 33.4 24l-1 3.3-2.4-.7z" fill="#d1483f" />
    </g>
  ),
  shades: (
    <g>
      <path d="M6.6 13.9h18.8l-.5 1.5h-17.8z" fill="#2b3040" />
      <path d="M7.4 15.1h7.4l-.5 3.1c-.2 1.3-1.2 2-2.6 2h-1.4c-1.4 0-2.4-.8-2.6-2z" fill="#2b3040" />
      <path d="M17.2 15.1h7.4l-.3 3.1c-.2 1.2-1.2 2-2.6 2h-1.4c-1.4 0-2.4-.7-2.6-2z" fill="#2b3040" />
      <path d="M14.8 15.6h2.4v.9h-2.4z" fill="#2b3040" />
      <path d="M8.7 16.1h3.1l-1.6 2.6z" fill="#5f6b86" opacity=".55" />
      <path d="M18.5 16.1h3.1l-1.6 2.6z" fill="#5f6b86" opacity=".55" />
    </g>
  ),
  /* The board sits high and the skullcap is deliberately shallow: at the depth
     a real mortarboard has, it reached y≈16 and covered the eyes of every pet
     that wears them high — the robot and the penguin ended up in a visor. */
  grad: (
    <g>
      <path d="M16 1.6 29 6.2 16 10.8 3 6.2z" fill="#2f3542" />
      <path d="M11 7.1v2.5c0 1.4 2.2 2.2 5 2.2s5-.8 5-2.2V7.1L16 8.9z" fill="#3d4557" />
      <path d="M27.4 6.7v4.4" fill="none" stroke="#f0c33c" strokeWidth=".85" strokeLinecap="round" />
      <path d="M27.4 10.6c-1.4.3-2 1.3-2 2.7l2 .6 2-.6c0-1.4-.6-2.4-2-2.7z" fill="#f0c33c" />
    </g>
  ),
  cap: (
    <g>
      <path d="M8.4 8.4c.6-3.6 3.7-5.6 7.6-5.6s7 2 7.6 5.6z" fill="#4f7fd6" />
      <path d="M23.6 8.4c2.9.2 4.3 1 4.6 2.1H16v-2.1z" fill="#3b66b4" />
      <circle cx="16" cy="3" r="1" fill="#dce6fa" />
    </g>
  ),
  specs: (
    <g fill="none" stroke="#3c4250" strokeWidth="1.05">
      <circle cx="11.9" cy="16.6" r="3.5" />
      <circle cx="20.1" cy="16.6" r="3.5" />
      <path d="M15.4 16.3q.6-.6 1.2 0M8.4 15.6 6.2 14.4M23.6 15.6l2.2-1.2" strokeLinecap="round" />
    </g>
  ),
  beanie: (
    <g>
      <path d="M8.6 8.6c0-4.2 3.2-6.9 7.4-6.9s7.4 2.7 7.4 6.9z" fill="#6f5bd4" />
      <rect x="7.9" y="8.1" width="16.2" height="2.5" rx="1.25" fill="#8f7ef0" />
      <circle cx="16" cy="1.4" r="1.5" fill="#d9d2ff" />
    </g>
  ),
  party: (
    <g>
      <path d="M16 .9 21.4 9H10.6z" fill="#f2a03d" />
      <path d="M13.6 4.9h4.8l1 1.7h-6.8zM11.4 8.1h9.2l.8 1.3H10.6z" fill="#e4574f" opacity=".85" />
      <circle cx="16" cy="1" r="1.35" fill="#ffd769" />
    </g>
  ),
  crown: (
    <g>
      <path d="M8.2 9.4 7 3.2l4.1 2.6L16 1.5l4.9 4.3L25 3.2l-1.2 6.2z" fill="#f0c33c" />
      <path d="M8.2 9.4h15.6l-.3 1.5H8.5z" fill="#d8a726" />
      <circle cx="16" cy="6.6" r="1" fill="#e2679b" />
      <circle cx="11.4" cy="7.6" r=".72" fill="#6fb7e8" />
      <circle cx="20.6" cy="7.6" r=".72" fill="#6fb7e8" />
    </g>
  ),
  halo: (
    <g>
      <ellipse cx="16" cy="4.4" rx="6.2" ry="2.1" fill="none" stroke="#ffe07a" strokeWidth="1.5" />
      <ellipse cx="16" cy="4.4" rx="6.2" ry="2.1" fill="none" stroke="#fff6cf" strokeWidth=".55" />
    </g>
  ),
  ember: (
    <g>
      <path d="M16 .8c2.6 2.5 3.8 4.6 3.8 6.5 0 2.3-1.7 3.9-3.8 3.9s-3.8-1.6-3.8-3.9c0-1.9 1.2-4 3.8-6.5z" fill="#f2803a" />
      <path d="M16 4.2c1.3 1.5 1.9 2.7 1.9 3.7 0 1.2-.8 2-1.9 2s-1.9-.8-1.9-2c0-1 .6-2.2 1.9-3.7z" fill="#ffd45e" />
    </g>
  ),
};

/**
 * `hat` is a key from `HATS` in lib/pet.js, or null. Unknown keys render
 * nothing rather than throwing — `normalize` should have caught them, but a
 * hat is not worth a white screen.
 */
export default function PetHat({ hat }) {
  const art = hat && HATS[hat];
  if (!art) return null;
  return (
    <svg className="dg-pet-hat" viewBox="0 0 32 32" aria-hidden="true" data-hat={hat}>
      {art}
    </svg>
  );
}
