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
      {/* Plump satin ribbon with depth, folds, and golden brooch */}
      <path d="M16 8.8l-5.2-2.8c-.7-.4-1.5.1-1.3.9l.9 4.2c.1.6.8 1 1.4.7l4.2-2.2z" fill="#e2568f" stroke="#231722" strokeWidth=".7" strokeLinejoin="round" />
      <path d="M16 8.8l5.2-2.8c.7-.4 1.5.1 1.3.9l-.9 4.2c-.1.6-.8 1-1.4.7l-4.2-2.2z" fill="#e2568f" stroke="#231722" strokeWidth=".7" strokeLinejoin="round" />
      {/* Inner ribbon fold highlights */}
      <path d="M15.2 8.4l-4-2c-.4-.2-.8.1-.7.5l.5 2.6c.1.4.5.6.9.4l3.3-1.5z" fill="#f892be" />
      <path d="M16.8 8.4l4-2c.4-.2.8.1.7.5l-.5 2.6c-.1.4-.5.6-.9.4l-3.3-1.5z" fill="#f892be" />
      {/* Ribbon tails */}
      <path d="M14.6 9.6l-1.8 3.6-1.6-.6 1.2-3.4z" fill="#c73c73" stroke="#231722" strokeWidth=".5" />
      <path d="M17.4 9.6l1.8 3.6 1.6-.6-1.2-3.4z" fill="#c73c73" stroke="#231722" strokeWidth=".5" />
      {/* Center knot brooch */}
      <circle cx="16" cy="8.8" r="1.4" fill="#f4c45e" stroke="#231722" strokeWidth=".6" />
      <circle cx="16" cy="8.8" r=".7" fill="#e2568f" />
    </g>
  ),
  bloom: (
    <g>
      {/* Braided vine with leaves */}
      <path d="M7.8 9.2c2.8-4.4 13.6-4.4 16.4 0z" fill="#588e42" stroke="#1d2619" strokeWidth=".7" />
      <path d="M8.2 9.4q2-2.2 4.4-2.8M19.4 6.6q2.4.6 4.4 2.8" fill="none" stroke="#7ac062" strokeWidth=".75" strokeLinecap="round" />
      {/* Layered cherry blossoms */}
      <g stroke="#1d2619" strokeWidth=".5">
        <circle cx="10.6" cy="6.6" r="1.8" fill="#f79ec1" />
        <circle cx="16" cy="5" r="2.1" fill="#fca8c9" />
        <circle cx="21.4" cy="6.6" r="1.8" fill="#f79ec1" />
      </g>
      {/* Petal inner details & stamen */}
      <circle cx="10.6" cy="6.6" r="1" fill="#ffffff" opacity=".7" />
      <circle cx="16" cy="5" r="1.2" fill="#ffffff" opacity=".7" />
      <circle cx="21.4" cy="6.6" r="1" fill="#ffffff" opacity=".7" />
      <circle cx="10.6" cy="6.6" r=".5" fill="#f4c45e" />
      <circle cx="16" cy="5" r=".6" fill="#f4c45e" />
      <circle cx="21.4" cy="6.6" r=".5" fill="#f4c45e" />
    </g>
  ),
  phones: (
    <g>
      {/* Headband arch with padding */}
      <path d="M6.2 12.6v-2a9.8 9.8 0 0 1 19.6 0v2" fill="none" stroke="#262b35" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8.2 10.4a8 8 0 0 1 15.6 0" fill="none" stroke="#e04e67" strokeWidth="1.2" strokeLinecap="round" />
      {/* Left earcup */}
      <rect x="3.8" y="11" width="4.8" height="7.2" rx="2.4" fill="#d93b58" stroke="#262b35" strokeWidth=".85" />
      <rect x="4.8" y="12.2" width="2.4" height="4.8" rx="1.2" fill="#ff8da3" opacity=".9" />
      <circle cx="6.2" cy="14.6" r=".6" fill="#46d9ed" />
      {/* Right earcup */}
      <rect x="23.4" y="11" width="4.8" height="7.2" rx="2.4" fill="#d93b58" stroke="#262b35" strokeWidth=".85" />
      <rect x="24.8" y="12.2" width="2.4" height="4.8" rx="1.2" fill="#ff8da3" opacity=".9" />
      <circle cx="25.8" cy="14.6" r=".6" fill="#46d9ed" />
    </g>
  ),
  devil: (
    <g>
      {/* Horns with rim lighting */}
      <path d="M9.6 8.6c-1.6-1.6-2.8-3.4-2.6-5.4 2.1 1 3.8 2.6 4.7 4.6z" fill="#c73228" stroke="#221414" strokeWidth=".75" strokeLinejoin="round" />
      <path d="M22.4 8.6c1.6-1.6 2.8-3.4 2.6-5.4-2.1 1-3.8 2.6-4.7 4.6z" fill="#c73228" stroke="#221414" strokeWidth=".75" strokeLinejoin="round" />
      <path d="M9.6 8.6c-1-1.1-1.8-2.2-1.9-3.4 1.3.8 2.3 1.8 2.9 3z" fill="#f0584b" />
      <path d="M22.4 8.6c1-1.1 1.8-2.2 1.9-3.4-1.3.8-2.3 1.8-2.9 3z" fill="#f0584b" />
      {/* Spiked devil tail */}
      <path d="M25.6 21.4c4 .6 5.6 3.4 4.8 5.6-.6 1.6-2.4 2.2-3.2 1.5-.8-.7-.2-1.7.6-1.7 1 0 1.3-1 .7-1.9-.6-.9-1.9-1.3-3.1-1.4z" fill="#c73228" stroke="#221414" strokeWidth=".7" />
      <path d="M31.2 25.4l2.4-1.8-1.2 3.6-2.4-.8z" fill="#f0584b" stroke="#221414" strokeWidth=".6" strokeLinejoin="round" />
    </g>
  ),
  shades: (
    <g>
      {/* Frames */}
      <path d="M6.4 13.8h19.2l-.6 1.6H7z" fill="#1e222d" />
      <path d="M7.2 15h7.6l-.6 3.4c-.2 1.4-1.3 2.2-2.8 2.2H10c-1.5 0-2.6-.8-2.8-2.2z" fill="#1e222d" stroke="#11141c" strokeWidth=".6" strokeLinejoin="round" />
      <path d="M17.2 15h7.6l-.4 3.4c-.2 1.3-1.3 2.2-2.8 2.2h-1.6c-1.5 0-2.6-.8-2.8-2.2z" fill="#1e222d" stroke="#11141c" strokeWidth=".6" strokeLinejoin="round" />
      <path d="M14.6 15.4h2.8v1h-2.8z" fill="#d9a832" />
      {/* Polarized mirror glare stripes */}
      <path d="M8.6 15.8h2.6l-1.8 3.2h-1.8z" fill="#6a82a8" opacity=".7" />
      <path d="M18.6 15.8h2.6l-1.8 3.2h-1.8z" fill="#6a82a8" opacity=".7" />
      <circle cx="8" cy="15.6" r=".4" fill="#ffffff" />
      <circle cx="24" cy="15.6" r=".4" fill="#ffffff" />
    </g>
  ),
  grad: (
    <g>
      {/* Beveled mortarboard cap */}
      <path d="M16 1.2 29.4 6 16 10.8 2.6 6z" fill="#242936" stroke="#13171e" strokeWidth=".85" strokeLinejoin="round" />
      <path d="M16 1.6 28 6 16 7.4 4 6z" fill="#384052" />
      <path d="M10.8 7v2.6c0 1.6 2.3 2.5 5.2 2.5s5.2-.9 5.2-2.5V7L16 8.8z" fill="#2b3240" stroke="#13171e" strokeWidth=".7" strokeLinejoin="round" />
      {/* Gold button and tassel */}
      <circle cx="16" cy="6" r=".8" fill="#f4c45e" />
      <path d="M16 6q6 1 11.6 4.6" fill="none" stroke="#f0b632" strokeWidth=".75" strokeLinecap="round" />
      <path d="M27.6 10.4c-.8.3-1.4 1.2-1.4 2.4l1.4.6 1.4-.6c0-1.2-.6-2.1-1.4-2.4z" fill="#f4c45e" stroke="#13171e" strokeWidth=".4" />
      <path d="M26.6 13.4l.4 2.8M27.6 13.4v3M28.6 13.4l-.4 2.8" stroke="#d99818" strokeWidth=".5" strokeLinecap="round" />
    </g>
  ),
  cap: (
    <g>
      {/* 6-panel dome */}
      <path d="M8.2 8.6c.6-3.8 3.8-6 7.8-6s7.2 2.2 7.8 6z" fill="#3b6ac8" stroke="#1a2e58" strokeWidth=".8" strokeLinejoin="round" />
      {/* Panel seams */}
      <path d="M16 2.6v6M12.6 3.6c.8 1.6 1.6 3.4 1.8 5M19.4 3.6c-.8 1.6-1.6 3.4-1.8 5" fill="none" stroke="#2c53a2" strokeWidth=".65" />
      {/* Curved visor */}
      <path d="M23.6 8.6c3.2.3 4.8 1.1 5.2 2.3H16V8.6z" fill="#294e9c" stroke="#1a2e58" strokeWidth=".75" strokeLinejoin="round" />
      <path d="M23.6 9.6h4.6" stroke="#5b8ef0" strokeWidth=".5" strokeLinecap="round" />
      <circle cx="16" cy="2.6" r="1.05" fill="#f4c45e" stroke="#1a2e58" strokeWidth=".4" />
    </g>
  ),
  specs: (
    <g fill="none" stroke="#241e17" strokeWidth="1.15">
      {/* Golden wireframe glasses */}
      <circle cx="11.8" cy="16.5" r="3.6" stroke="#d89e32" />
      <circle cx="20.2" cy="16.5" r="3.6" stroke="#d89e32" />
      <circle cx="11.8" cy="16.5" r="3.6" stroke="#241e17" strokeWidth=".5" />
      <circle cx="20.2" cy="16.5" r="3.6" stroke="#241e17" strokeWidth=".5" />
      {/* Bridge and temples */}
      <path d="M15.4 16.2q.6-.6 1.2 0M8.2 15.5 6 14.4M23.8 15.5l2.2-1.1" strokeLinecap="round" stroke="#d89e32" />
      {/* Glare reflection */}
      <path d="M10 14.6a2.6 2.6 0 0 1 2.6-1.2M18.4 14.6a2.6 2.6 0 0 1 2.6-1.2" stroke="#ffffff" strokeWidth=".85" strokeLinecap="round" opacity=".8" />
    </g>
  ),
  beanie: (
    <g>
      {/* Cable knit dome */}
      <path d="M8.4 8.8c0-4.4 3.4-7.2 7.6-7.2s7.6 2.8 7.6 7.2z" fill="#5f49cf" stroke="#201750" strokeWidth=".85" strokeLinejoin="round" />
      {/* Knit vertical ribs */}
      <path d="M11.6 3.6v4.8M14 2.2v6.2M18 2.2v6.2M20.4 3.6v4.8" stroke="#7e6be6" strokeWidth=".7" strokeLinecap="round" />
      {/* Fold-over ribbed cuff */}
      <rect x="7.6" y="8.2" width="16.8" height="2.8" rx="1.4" fill="#7e6be6" stroke="#201750" strokeWidth=".85" />
      {/* Fluffy yarn pom-pom */}
      <circle cx="16" cy="1.2" r="1.9" fill="#f0ebff" stroke="#201750" strokeWidth=".7" />
      <circle cx="15.5" cy=".8" r="1.1" fill="#ffffff" />
    </g>
  ),
  party: (
    <g>
      {/* Party cone with spiral stripes */}
      <path d="M16 .6 22 9.2H10z" fill="#f49b38" stroke="#2a1608" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M13.4 4.4l3.6 1.6 2.4-1.6zM11.2 7.8l5.2 1.4 3.8-1.4z" fill="#e84c68" />
      <path d="M12.4 2.8l2.6 1.2M11.4 6.2l6.2 1.8" fill="none" stroke="#46d9ed" strokeWidth=".8" strokeLinecap="round" />
      {/* Crinkled tinsel base trim */}
      <path d="M9.6 9.2q3.2 1 6.4 0t6.4 0" fill="none" stroke="#ffd45e" strokeWidth="1.2" strokeLinecap="round" />
      {/* Pom-pom topper */}
      <circle cx="16" cy=".8" r="1.5" fill="#ffd45e" stroke="#2a1608" strokeWidth=".6" />
    </g>
  ),
  crown: (
    <g>
      {/* Royal golden crown with peaks */}
      <path d="M8 9.6 6.8 2.8l4.4 2.8L16 1.2l4.8 4.4L25.2 2.8 24 9.6z" fill="#f4be38" stroke="#362208" strokeWidth=".85" strokeLinejoin="round" />
      <path d="M8.4 9.6h15.2v1.8H8.4z" fill="#d99a18" stroke="#362208" strokeWidth=".7" />
      {/* Inlaid jewels with facets */}
      <circle cx="16" cy="6.2" r="1.2" fill="#e83864" stroke="#362208" strokeWidth=".5" />
      <circle cx="11" cy="7.2" r=".9" fill="#38a8e8" stroke="#362208" strokeWidth=".4" />
      <circle cx="21" cy="7.2" r=".9" fill="#38a8e8" stroke="#362208" strokeWidth=".4" />
      <circle cx="16" cy="6" r=".4" fill="#ffffff" />
      <circle cx="11" cy="7" r=".3" fill="#ffffff" />
      <circle cx="21" cy="7" r=".3" fill="#ffffff" />
    </g>
  ),
  wizard: (
    <g>
      {/* Wide brim and bent star-spangled cone */}
      <ellipse cx="16" cy="9.4" rx="10.4" ry="2.1" fill="#4a3a9c" stroke="#1c1648" strokeWidth=".8" />
      <path d="M9.6 9.2C11 6.6 13.4 3.2 17.6 .8c-.4 2 .2 3.4 1.6 4.4.8.6 1.8 2.2 3.2 4z" fill="#5f49cf" stroke="#1c1648" strokeWidth=".85" strokeLinejoin="round" />
      <path d="M10.2 8.4q5.8 1.4 12 0" fill="none" stroke="#f4c45e" strokeWidth=".9" strokeLinecap="round" />
      <path d="m15 6 .6 1.3 1.4.1-1.1.9.4 1.4-1.3-.8-1.3.8.4-1.4-1.1-.9 1.4-.1z" fill="#f4c45e" />
      <circle cx="19.4" cy="5" r=".5" fill="#f0ebff" />
    </g>
  ),
  sunburst: (
    <g>
      {/* Radiating rays behind a thin gold band */}
      <g stroke="#362208" strokeWidth=".5" strokeLinejoin="round" fill="#f9d45c">
        <path d="M16 .6l1.3 6h-2.6z" />
        <path d="M9.6 2.4l3.2 4.6-2.4 1.2z" />
        <path d="M22.4 2.4l-3.2 4.6 2.4 1.2z" />
        <path d="M4.8 6.4l5 2.6-1.4 1.8z" />
        <path d="M27.2 6.4l-5 2.6 1.4 1.8z" />
      </g>
      <path d="M8.6 9.8q7.4-2.6 14.8 0v1.4q-7.4-2.6-14.8 0z" fill="#f4be38" stroke="#362208" strokeWidth=".7" strokeLinejoin="round" />
      <circle cx="16" cy="9.4" r="1.1" fill="#ff8a3d" stroke="#362208" strokeWidth=".45" />
    </g>
  ),
  halo: (
    <g>
      {/* Floating celestial aura */}
      <ellipse cx="16" cy="4.2" rx="6.8" ry="2.4" fill="none" stroke="#fcd860" strokeWidth="1.8" opacity=".95" />
      <ellipse cx="16" cy="4.2" rx="6.8" ry="2.4" fill="none" stroke="#ffffff" strokeWidth=".65" />
      <circle cx="9.6" cy="4.2" r=".45" fill="#ffffff" />
      <circle cx="22.4" cy="4.2" r=".45" fill="#ffffff" />
    </g>
  ),
  ember: (
    <g>
      {/* Dynamic flame crown with glowing core */}
      <path d="M16 .4c2.8 2.6 4.2 5 4.2 7 0 2.5-1.9 4.2-4.2 4.2s-4.2-1.7-4.2-4.2c0-2 1.4-4.4 4.2-7z" fill="#e84c1f" stroke="#260e06" strokeWidth=".75" strokeLinejoin="round" />
      <path d="M16 3.6c1.6 1.8 2.4 3.2 2.4 4.4 0 1.5-1.1 2.6-2.4 2.6s-2.4-1.1-2.4-2.6c0-1.2.8-2.6 2.4-4.4z" fill="#f89e28" />
      <path d="M16 6.2c.8 1 1.2 1.8 1.2 2.4 0 .8-.5 1.3-1.2 1.3s-1.2-.5-1.2-1.3c0-.6.4-1.4 1.2-2.4z" fill="#fff5aa" />
      <circle cx="12.4" cy="2.8" r=".45" fill="#ffd45e" />
      <circle cx="19.8" cy="4.2" r=".45" fill="#ffd45e" />
    </g>
  ),
  sprig: (
    <g>
      {/* Botanical clover with berries */}
      <path d="M16 8.6c-.2-2.4.8-4.2 2.6-5.4" fill="none" stroke="#487836" strokeWidth="1" strokeLinecap="round" />
      <path d="M18.6 3.2c1.6-.6 2.8-.2 3.5 1-1.1 1-2.2 1.1-3.5.1z" fill="#68a850" stroke="#1d2e16" strokeWidth=".5" strokeLinejoin="round" />
      <path d="M17.2 5.8c-1.5-.8-2.4-1.8-2.5-3 1.4-.2 2.4.4 2.8 2z" fill="#78be5c" stroke="#1d2e16" strokeWidth=".5" strokeLinejoin="round" />
      <circle cx="16.1" cy="8.6" r=".85" fill="#c73858" stroke="#1d2e16" strokeWidth=".4" />
    </g>
  ),
  star: (
    <g>
      {/* Polaris star with beveled gold facets */}
      <path d="M21.6 2.8 23 5.8l3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4z" fill="#f4c438" stroke="#321e06" strokeWidth=".7" strokeLinejoin="round" />
      <path d="M21.6 4.8l.8 1.6 1.8.8-1.8.8-.8 1.6-.8-1.6-1.8-.8 1.8-.8z" fill="#ffffff" />
      <circle cx="21.6" cy="7.2" r=".5" fill="#ffffff" />
    </g>
  ),
  laurel: (
    <g fill="none" strokeLinecap="round">
      {/* Layered Roman laurel wreath */}
      <path d="M9.2 10.8C7.6 7.4 8.8 4.4 11.6 3" stroke="#4f8c38" strokeWidth="1.2" />
      <path d="M22.8 10.8c1.6-3.4.4-6.4-2.4-7.8" stroke="#4f8c38" strokeWidth="1.2" />
      <g stroke="#68b44c" strokeWidth="1.1">
        <path d="M9.4 9q-1.8-.6-2.2-2.2M10 6.8q-1.7-.8-1.8-2.3M11.4 4.8q-1.5-1-1.4-2.5" />
        <path d="M22.6 9q1.8-.6 2.2-2.2M22 6.8q1.7-.8 1.8-2.3M20.6 4.8q1.5-1 1.4-2.5" />
      </g>
      <circle cx="16" cy="11.2" r=".7" fill="#c73858" stroke="#241418" strokeWidth=".4" />
    </g>
  ),
  muffs: (
    <g>
      {/* Padded headband */}
      <path d="M6.6 12.2v-1.6a9.4 9.4 0 0 1 18.8 0v1.6" fill="none" stroke="#363f52" strokeWidth="1.8" strokeLinecap="round" />
      {/* Fluffy winter muffs */}
      <ellipse cx="6.4" cy="13.6" rx="2.8" ry="3.4" fill="#d2b8e8" stroke="#201b2a" strokeWidth=".85" />
      <ellipse cx="25.6" cy="13.6" rx="2.8" ry="3.4" fill="#d2b8e8" stroke="#201b2a" strokeWidth=".85" />
      <ellipse cx="6.4" cy="13.6" rx="1.6" ry="2" fill="#ffffff" opacity=".85" />
      <ellipse cx="25.6" cy="13.6" rx="1.6" ry="2" fill="#ffffff" opacity=".85" />
    </g>
  ),
  comet: (
    <g>
      {/* Stardust tail and sparkling nucleus */}
      <path d="M9.4 2.2c4.6-.6 7.8.6 9.4 3.8-3.4-1.5-6.6-1.5-9.4 0z" fill="#7aaef8" opacity=".75" />
      <path d="M11.2 4.4c3.2-.3 5.4.4 6.6 2.4-2.4-.9-4.6-.9-6.6 0z" fill="#badaff" opacity=".85" />
      <circle cx="19.6" cy="6.4" r="2.2" fill="#f6ca46" stroke="#2e1a06" strokeWidth=".6" />
      <circle cx="19" cy="5.8" r=".8" fill="#ffffff" />
    </g>
  ),
  moon: (
    <g>
      {/* Pearlescent crescent moon */}
      <path d="M19.6 1.8c-3.6.5-6 3.2-6 6.4 0 .7.1 1.3.4 1.9-2.4-1.1-4-3.4-4-6.1 0-2.6 1.5-4.8 3.8-6z" fill="#e2e6f8" stroke="#262a40" strokeWidth=".7" strokeLinejoin="round" transform="translate(2.6 2.4)" />
      <circle cx="15" cy="6.6" r=".6" fill="#f8e482" />
      <circle cx="13.6" cy="9.4" r=".4" fill="#f8e482" />
    </g>
  ),
  aurora: (
    <g fill="none" strokeLinecap="round">
      {/* Shimmering northern lights ribbons */}
      <path d="M7.4 9.4c1.5-4.4 4.4-6.8 8.8-6.8s7.3 2.4 8.8 6.8" stroke="#5eead4" strokeWidth="1.8" opacity=".85" />
      <path d="M9 10.2c1.4-3.4 3.7-5.2 7.2-5.2s5.8 1.8 7.2 5.2" stroke="#818cf8" strokeWidth="1.4" opacity=".8" />
      <path d="M10.8 10.8c1.1-2.2 2.9-3.4 5.4-3.4s4.3 1.2 5.4 3.4" stroke="#f472b6" strokeWidth="1" opacity=".75" />
    </g>
  ),
  stars: (
    <g>
      {/* Starlight constellation tiara */}
      <path d="M8.2 9.6c1.3-4 4-6.2 8-6.2s6.7 2.2 8 6.2" fill="none" stroke="#6366f1" strokeWidth=".85" opacity=".8" />
      <g fill="#fcd34d" stroke="#2a1e08" strokeWidth=".5">
        <path d="M16 1.4 16.9 3.8 19.4 4.6l-2.5.8L16 7.8l-.9-2.4-2.5-.8 2.5-.8z" />
        <path d="M9.4 5.2l.6 1.4 1.5.5-1.5.5-.6 1.4-.6-1.4-1.5-.5 1.5-.5z" />
        <path d="M22.6 5.2l.6 1.4 1.5.5-1.5.5-.6 1.4-.6-1.4-1.5-.5 1.5-.5z" />
      </g>
      <circle cx="16" cy="4.6" r=".6" fill="#ffffff" />
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
      <g className="dg-pet-wearable-canvas"><g className="dg-pet-wearable-body pet-rig-frame"><g className="dg-pet-wearable-head pet-rig-head">{art}</g></g></g>
    </svg>
  );
}
