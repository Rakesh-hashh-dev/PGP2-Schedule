// Neckwear — the second wearable slot, drawn once for the whole roster.
//
// Same overlay trick as `PetHat`: one SVG on top of the pet rather than a
// collar added to sixteen drawings, so a seventeenth companion inherits the
// whole wardrobe for free. Two independent slots multiply — eleven level hats
// against five collars is fifty-five looks out of sixteen pieces of art.
//
// Everything here is drawn against one canonical neck line at y=24.5, and each
// pet declares how far its own neck sits from that in styles.css
// (`--pet-neck-y`). Those numbers are not guesses: they are measured from each
// pet's own collar with `npm run pet-sheet`'s bounding-box pass.
//
// A worn collar REPLACES the one the pet is drawn with — styles.css hides
// `.dg-pet-accessory` whenever `data-neck` is set — so nobody ends up wearing a
// bow tie over a ribbon.
const NECKWEAR = {
  scarf: (
    <g>
      {/* Knit wrap contour */}
      <path d="M10.2 23.4c3.6 1.8 8 1.8 11.6 0l.6 2.8c-4 2-8.8 2-12.8 0z" fill="#dc4a54" stroke="#2a1218" strokeWidth=".75" strokeLinejoin="round" />
      <path d="M10.8 24.8c3.4 1.6 7 1.6 10.4 0l.4 1c-3.6 1.6-7.2 1.6-11 0z" fill="#b5323c" />
      {/* Knit ribs */}
      <path d="M12.6 24.2v1.8M15 24.8v1.8M17.4 24.8v1.8M19.4 24.2v1.8" stroke="#f68a92" strokeWidth=".55" strokeLinecap="round" />
      <path d="M11 23.8q5 1.8 10 0" fill="none" stroke="#fca5a5" strokeWidth=".4" strokeLinecap="round" opacity=".8" />
      {/* Cozy wrap knot */}
      <path d="M18.2 24.6c1.2-.4 2.6.2 3.1 1.4l.6 2c-.3 1.2-1.4 1.8-2.6 1.4l-1.5-.8z" fill="#dc4a54" stroke="#2a1218" strokeWidth=".7" strokeLinejoin="round" />
      {/* Draped tail with ribs & fringe */}
      <path d="M18.8 25.8l2.8 1.2c.6.3.8 1 .5 1.6l-.8 2.2c-.3.7-1.1.9-1.8.6l-2.2-1.1z" fill="#b5323c" stroke="#2a1218" strokeWidth=".65" strokeLinejoin="round" />
      <path d="M18.8 27.2l1.6.7M18 28.5l1.8.8" stroke="#f68a92" strokeWidth=".45" strokeLinecap="round" />
      <path d="M17.4 30.3l-.3 1.5M18.1 30.6l-.1 1.5M18.8 30.9l.2 1.4M19.5 31.2l.5 1.3" stroke="#fca5a5" strokeWidth=".5" strokeLinecap="round" />
    </g>
  ),
  bandana: (
    <g>
      {/* Rolled top collar */}
      <path d="M9.8 23c3.8 1.8 8.6 1.8 12.4 0l.6 2c-4.2 2-9.4 2-13.6 0z" fill="#3b6ea8" stroke="#142138" strokeWidth=".75" strokeLinejoin="round" />
      <path d="M10.8 23.6q5.2 1.6 10.4 0" fill="none" stroke="#7eb2eb" strokeWidth=".5" strokeLinecap="round" />
      {/* Tied knot at neck */}
      <path d="M9.8 23.2l-1.4-1.2c-.4-.3-1 .1-.9.6l.4 1.8c.1.4.5.6.9.5l1.2-.5z" fill="#2d5280" stroke="#142138" strokeWidth=".55" strokeLinejoin="round" />
      {/* Triangular folded drape */}
      <path d="M12 24.6 16 30.6l4-6c-2.4 1.1-5.6 1.1-8 0z" fill="#4b7fc2" stroke="#142138" strokeWidth=".75" strokeLinejoin="round" />
      <path d="M16 25.2v5.4l3.6-5.8c-1.2.5-2.4.7-3.6.4z" fill="#356199" />
      <path d="M16 25.4v4.4" stroke="#1e3a63" strokeWidth=".5" strokeLinecap="round" />
      {/* Bandana print motif & dots */}
      <polygon points="16,26.8 17.1,27.9 16,29 14.9,27.9" fill="#ffffff" opacity=".95" />
      <circle cx="16" cy="27.9" r=".3" fill="#3b6ea8" />
      <circle cx="13.9" cy="26" r=".35" fill="#e0f0fe" />
      <circle cx="18.1" cy="26" r=".35" fill="#e0f0fe" />
      <circle cx="14.5" cy="27.2" r=".3" fill="#e0f0fe" />
      <circle cx="17.5" cy="27.2" r=".3" fill="#e0f0fe" />
    </g>
  ),
  bowtie: (
    <g>
      {/* Ribbon neck loop */}
      <path d="M10.8 23.6c3.4 1.4 7 1.4 10.4 0" fill="none" stroke="#3b1f72" strokeWidth=".9" strokeLinecap="round" />
      {/* Left wing with folds & highlights */}
      <path d="M16 25.2 10.4 22.4c-.8-.4-1.6.2-1.5 1.1l.6 4c.1.7.9 1.1 1.6.7L16 25.8z" fill="#6f42c1" stroke="#1f143a" strokeWidth=".75" strokeLinejoin="round" />
      <path d="M11 23.4 15.6 25.2 11.4 26.8l-.5-2.8z" fill="#5832a4" />
      <path d="M10.8 24.2q2.2.8 4.4 1" fill="none" stroke="#b28df8" strokeWidth=".5" strokeLinecap="round" />
      {/* Right wing with folds & highlights */}
      <path d="M16 25.2 21.6 22.4c.8-.4 1.6.2 1.5 1.1l-.6 4c-.1.7-.9 1.1-1.6.7L16 25.8z" fill="#6f42c1" stroke="#1f143a" strokeWidth=".75" strokeLinejoin="round" />
      <path d="M21 23.4 16.4 25.2 20.6 26.8l.5-2.8z" fill="#5832a4" />
      <path d="M21.2 24.2q-2.2.8-4.4 1" fill="none" stroke="#b28df8" strokeWidth=".5" strokeLinecap="round" />
      {/* Center knot */}
      <rect x="14.5" y="23.6" width="3" height="3.2" rx="1.2" fill="#522a9e" stroke="#1f143a" strokeWidth=".7" />
      <path d="M15.2 24.4v1.6" stroke="#b28df8" strokeWidth=".5" strokeLinecap="round" />
      {/* Golden brooch accent */}
      <circle cx="16" cy="25.2" r=".75" fill="#fcd34d" stroke="#1f143a" strokeWidth=".4" />
      <circle cx="15.8" cy="25" r=".25" fill="#ffffff" />
    </g>
  ),
  bell: (
    <g>
      {/* Stitched leather collar */}
      <path d="M10 23.2c3.8 1.8 8.2 1.8 12 0l.6 2c-4.2 2-9 2-13.2 0z" fill="#c5303c" stroke="#260d13" strokeWidth=".75" strokeLinejoin="round" />
      <path d="M10.6 24.2c3.4 1.4 7.4 1.4 10.8 0" fill="none" stroke="#e66e77" strokeWidth=".4" strokeDasharray=".8 .8" strokeLinecap="round" />
      {/* Golden buckle */}
      <rect x="18.8" y="23.5" width="2" height="2" rx=".5" fill="#fcd34d" stroke="#260d13" strokeWidth=".5" />
      <rect x="19.3" y="24" width="1" height="1" rx=".2" fill="#c5303c" />
      {/* Golden bell hanger loop */}
      <circle cx="16" cy="25.6" r="1.1" fill="none" stroke="#d99818" strokeWidth=".6" />
      {/* Spherical brass bell */}
      <circle cx="16" cy="28" r="2.5" fill="#f59e0b" stroke="#382104" strokeWidth=".75" />
      <ellipse cx="16" cy="27.4" rx="2.2" ry="1.7" fill="#fbbf24" />
      <path d="M13.8 28h4.4" stroke="#92400e" strokeWidth=".55" strokeLinecap="round" />
      {/* Keyhole slot */}
      <circle cx="16" cy="29" r=".6" fill="#451a03" stroke="#260d13" strokeWidth=".3" />
      <path d="M16 28.2v.8" stroke="#451a03" strokeWidth=".5" strokeLinecap="round" />
      {/* High-shine gleam */}
      <circle cx="15" cy="26.9" r=".6" fill="#ffffff" />
      <circle cx="14.5" cy="27.6" r=".25" fill="#ffffff" opacity=".7" />
    </g>
  ),
  medal: (
    <g>
      {/* Ribbon V and a gold medallion */}
      <path d="M11 23.4 15 28.2l1.6-1.2-3.2-4.6z" fill="#3b6ea8" stroke="#142138" strokeWidth=".6" strokeLinejoin="round" />
      <path d="M21 23.4 17 28.2l-1.6-1.2 3.2-4.6z" fill="#e2568f" stroke="#2a1218" strokeWidth=".6" strokeLinejoin="round" />
      <circle cx="16" cy="29.2" r="2.4" fill="#f4be38" stroke="#362208" strokeWidth=".75" />
      <path d="m16 27.6.5 1.1 1.2.1-.9.8.3 1.2-1.1-.6-1.1.6.3-1.2-.9-.8 1.2-.1z" fill="#d99a18" />
    </g>
  ),
  chain: (
    <g>
      {/* Heavy gold Cuban curb chain */}
      <path d="M10.4 23.5c3.6 2.2 7.6 2.2 11.2 0" fill="none" stroke="#291802" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M10.4 23.5c3.6 2.2 7.6 2.2 11.2 0" fill="none" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" />
      {/* Link facets / luster */}
      <path d="M11.2 24.1l.9.4M13.2 24.9l.9.2M15.2 25.2l.9.1M17.2 25.1l.9-.1M19.2 24.7l.9-.3M20.8 23.9l.8-.4" stroke="#fef08a" strokeWidth=".9" strokeLinecap="round" />
      {/* Pendant bail */}
      <circle cx="16" cy="25.8" r="1.1" fill="none" stroke="#fcd34d" strokeWidth=".7" />
      <circle cx="16" cy="25.8" r="1.1" fill="none" stroke="#291802" strokeWidth=".35" />
      {/* 8-point compass star medallion */}
      <path d="M16 25.2 17.2 27.6 19.8 28.6 17.2 29.6 16 32 14.8 29.6 12.2 28.6 14.8 27.6z" fill="#f59e0b" stroke="#291802" strokeWidth=".75" strokeLinejoin="round" />
      {/* Medallion bevel facets */}
      <polygon points="16,25.4 16,28.6 17.1,27.7" fill="#fde047" />
      <polygon points="19.6,28.6 16,28.6 17.1,29.5" fill="#fde047" />
      <polygon points="16,31.8 16,28.6 14.9,29.5" fill="#fde047" />
      <polygon points="12.4,28.6 16,28.6 14.9,27.7" fill="#fde047" />
      <polygon points="16,25.4 16,28.6 14.9,27.7" fill="#d97706" />
      <polygon points="19.6,28.6 16,28.6 17.1,27.7" fill="#d97706" />
      <polygon points="16,31.8 16,28.6 17.1,29.5" fill="#d97706" />
      <polygon points="12.4,28.6 16,28.6 14.9,29.5" fill="#d97706" />
      {/* Diamond solitaire center stone */}
      <circle cx="16" cy="28.6" r="1" fill="#ffffff" stroke="#291802" strokeWidth=".4" />
      <circle cx="16" cy="28.6" r=".5" fill="#bae6fd" />
      <path d="M15.4 28.6h1.2M16 28v1.2" stroke="#ffffff" strokeWidth=".5" strokeLinecap="round" />
    </g>
  ),
};

/**
 * `neck` is a key from `NECKWEAR` in lib/pet.js, or null. An unknown key
 * renders nothing rather than throwing, for the same reason `PetHat` does:
 * `normalize` should have caught it, and a collar is not worth a white screen.
 */
export default function PetNeckwear({ neck }) {
  const art = neck && NECKWEAR[neck];
  if (!art) return null;
  return (
    <svg className="dg-pet-neck" viewBox="0 0 32 32" aria-hidden="true" data-neck={neck}>
      <g className="dg-pet-wearable-canvas"><g className="dg-pet-wearable-body">{art}</g></g>
    </svg>
  );
}
