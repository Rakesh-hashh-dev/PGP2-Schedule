// XP gain toast — appears for a few seconds whenever the pet earns XP from an
// attendance mark or a completed assignment. Keeps it non-intrusive: a small
// pill that floats up from the bottom-nav area, shows the pet and the amount,
// then slides away on its own.
//
// The queue in App.jsx ensures multiple fast marks don't stack; they are shown
// sequentially with a short gap so the student feels the earn without spam.

import { useEffect, useState, useId } from "react";
import { Zap } from "lucide-react";
import PetCameo from "./PetCameo.jsx";
import "../styles/pet.css";

/**
 * @param {object}   props
 * @param {object}   props.pet          — live pet state (for PetCameo)
 * @param {object}   props.petContext   — mood context (for PetCameo)
 * @param {object}   props.petSettings  — wardrobe flags (for PetCameo)
 * @param {number}   props.xp           — XP amount earned (e.g. 32 or 60)
 * @param {string}   props.label        — short source label ("attendance" | "assignment")
 * @param {boolean}  props.firstOfDay   — true on the very first earn of the day
 * @param {function} props.onDone       — called when the toast is finished showing
 */
function PremiumSparkleSvg({ size = 14, className = "" }) {
  const id = "ps" + useId().replace(/\W/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`xp-toast-streak-svg ${className}`.trim()}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="25%" stopColor="#FDE047" />
          <stop offset="65%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FDE047" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient solar glow */}
      <circle cx="8" cy="8" r="7.5" fill={`url(#${id}-glow)`} />

      {/* Main 4-point radiant diamond burst */}
      <path
        d="M8 0.8C8.2 4.2 11.8 7.8 15.2 8C11.8 8.2 8.2 11.8 8 15.2C7.8 11.8 4.2 8.2 0.8 8C4.2 7.8 7.8 4.2 8 0.8Z"
        fill={`url(#${id}-gold)`}
      />

      {/* Secondary diagonal sparkle glints */}
      <path
        d="M8 3.5L9.1 6.9L12.5 8L9.1 9.1L8 12.5L6.9 9.1L3.5 8L6.9 6.9L8 3.5Z"
        fill="#FFFFFF"
        opacity="0.85"
      />

      {/* Cross-axial facet line */}
      <path d="M8 2V14M2 8H14" stroke="#FFF" strokeWidth="0.6" strokeLinecap="round" opacity="0.6" />

      {/* Core brilliant star center */}
      <circle cx="8" cy="8" r="1.4" fill="#FFFFFF" />
      <circle cx="8" cy="8" r="0.6" fill="#FDE047" />
    </svg>
  );
}

export default function XpToast({ pet, petContext, petSettings, xp, label, firstOfDay, onDone }) {
  const [phase, setPhase] = useState("enter"); // "enter" | "visible" | "exit"

  useEffect(() => {
    // Slide in
    const t1 = setTimeout(() => setPhase("visible"), 25);
    // Hold for 3s then slide out
    const t2 = setTimeout(() => setPhase("exit"), 3000);
    // Unmount + notify parent after exit animation
    const t3 = setTimeout(() => { onDone?.(); }, 3450);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adopted = pet?.petKey != null;
  const displayLabel = label === "attendance" ? "Attendance" : label === "assignment" ? "Assignment" : label;

  return (
    <div
      className={`xp-toast xp-toast--${phase}`}
      role="status"
      aria-live="polite"
      aria-label={`+${xp} XP earned for ${label}`}
    >
      {/* Dynamic light sheen sweep */}
      <span className="xp-toast-sheen" aria-hidden="true" />

      {/* Particle burst — decorative sparkling particles */}
      <span className="xp-toast-sparks" aria-hidden="true">
        {[...Array(8)].map((_, i) => (
          <span key={i} className={`xp-toast-spark xp-toast-spark--${i}`} />
        ))}
      </span>

      {/* Pet avatar inside elevated glass cradle */}
      {adopted && (
        <span className="xp-toast-pet-disc" aria-hidden="true">
          <PetCameo
            pet={pet}
            now={new Date()}
            petContext={petContext}
            petSettings={petSettings}
            size={34}
            motion={true}
          />
        </span>
      )}

      {/* Radiant XP Pill */}
      <span className="xp-toast-pill">
        <Zap size={11} className="xp-toast-pill-icon" strokeWidth={2.6} aria-hidden="true" />
        <span className="xp-toast-amount">+{xp}</span>
        <span className="xp-toast-unit">XP</span>
      </span>

      {/* Text Info (Action title + optional golden First Today badge) */}
      <div className="xp-toast-info">
        <span className="xp-toast-source">{displayLabel}</span>
        {firstOfDay && adopted && (
          <span className="xp-toast-streak-badge">
            <PremiumSparkleSvg size={13} />
            First today
          </span>
        )}
      </div>
    </div>
  );
}

