// Duotone event icons for schedule types (placement, exam, celebration,
// cancellation). Drawn on one 24px grid with a shared stroke weight: a
// translucent body fill, a crisp outline and one solid accent detail. Every
// layer uses currentColor, so an icon takes its button/badge colour and
// follows dark mode without per-theme variants. Replaces the 💼/🎉 emoji,
// which render differently per OS and look cheap at badge size.

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
const TINT = { fill: "currentColor", opacity: 0.18 };

function Svg({ size = 16, className, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`tf-icon${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Placement: briefcase with a lit clasp. */
export function PlacementIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="7" width="18" height="13" rx="3.2" {...TINT} />
      <path d="M9 7V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6V7" {...STROKE} />
      <rect x="3" y="7" width="18" height="13" rx="3.2" {...STROKE} />
      <path d="M3.4 12.3c5.6 2 11.6 2 17.2 0" {...STROKE} />
      <rect x="10.3" y="11.6" width="3.4" height="3.2" rx="1" fill="currentColor" />
    </Svg>
  );
}

/** Exam: mortarboard with a hanging tassel. */
export function ExamIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 4.2 21.5 9 12 13.8 2.5 9Z" {...TINT} />
      <path d="M6.2 11v4.2c0 1.6 2.6 3.1 5.8 3.1s5.8-1.5 5.8-3.1V11" {...STROKE} />
      <path d="M12 4.2 21.5 9 12 13.8 2.5 9Z" {...STROKE} />
      <path d="M21.5 9v5.3" {...STROKE} />
      <circle cx="21.5" cy="16" r="1.5" fill="currentColor" />
    </Svg>
  );
}

/** Celebration: party cone with confetti and a sparkle. */
export function CelebrationIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 20.5 8.4 8.6l7 7Z" {...TINT} />
      <path d="M3.5 20.5 8.4 8.6l7 7Z" {...STROKE} />
      <path d="M6 14.7c1.4.4 2.9 1.9 3.3 3.3" {...STROKE} />
      <path d="M13.2 4.4c.9 1.4.6 2.6-.6 3.6" {...STROKE} />
      <path d="M19.6 10.8c-1.4-.9-2.6-.6-3.6.6" {...STROKE} />
      <path d="M17.5 2.8 18.2 4.8 20.2 5.5 18.2 6.2 17.5 8.2 16.8 6.2 14.8 5.5 16.8 4.8Z" fill="currentColor" />
      <circle cx="11" cy="3.6" r="1" fill="currentColor" />
      <circle cx="20.4" cy="13.4" r="1" fill="currentColor" />
    </Svg>
  );
}

/** Cancel class: calendar sheet struck through with an ✕. */
export function CancelClassIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3.2" {...TINT} />
      <path d="M3 9.6h18" {...STROKE} />
      <rect x="3" y="5" width="18" height="16" rx="3.2" {...STROKE} />
      <path d="M8 3v3.6M16 3v3.6" {...STROKE} />
      <path d="m9.6 12.8 4.8 4.8m0-4.8-4.8 4.8" {...STROKE} strokeWidth={2.1} />
    </Svg>
  );
}
