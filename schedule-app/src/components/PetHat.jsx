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
