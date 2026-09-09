// XP gain toast — appears for a few seconds whenever the pet earns XP from an
// attendance mark or a completed assignment. Keeps it non-intrusive: a small
// pill that floats up from the bottom-nav area, shows the pet and the amount,
// then slides away on its own.
//
// The queue in App.jsx ensures multiple fast marks don't stack; they are shown
// sequentially with a short gap so the student feels the earn without spam.

import { useEffect, useState } from "react";
import PetCameo from "./PetCameo.jsx";

/**
 * @param {object}  props
 * @param {object}  props.pet          — live pet state (for PetCameo)
 * @param {object}  props.petContext   — mood context (for PetCameo)
 * @param {object}  props.petSettings  — wardrobe flags (for PetCameo)
 * @param {number}  props.xp           — XP amount earned (e.g. 32 or 60)
 * @param {string}  props.label        — short source label ("attendance" | "assignment")
 * @param {boolean} props.firstOfDay   — true on the very first earn of the day
 * @param {function} props.onDone      — called when the toast is finished showing
 */
export default function XpToast({ pet, petContext, petSettings, xp, label, firstOfDay, onDone }) {
  const [phase, setPhase] = useState("enter"); // "enter" | "visible" | "exit"

  useEffect(() => {
    // Slide in
    const t1 = setTimeout(() => setPhase("visible"), 30);
    // Hold for 2.8 s then slide out
    const t2 = setTimeout(() => setPhase("exit"), 2800);
    // Unmount + notify parent after exit animation
    const t3 = setTimeout(() => { onDone?.(); }, 3300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adopted = pet?.petKey != null;

  return (
    <div
      className={`xp-toast xp-toast--${phase}`}
      role="status"
      aria-live="polite"
      aria-label={`+${xp} XP earned for ${label}`}
    >
      {/* Particle burst — purely decorative CSS sparkles */}
      <span className="xp-toast-sparks" aria-hidden="true">
        {[...Array(6)].map((_, i) => (
          <span key={i} className={`xp-toast-spark xp-toast-spark--${i}`} />
        ))}
      </span>

      {/* Pet avatar */}
      {adopted && (
        <span className="xp-toast-pet" aria-hidden="true">
          <PetCameo
            pet={pet}
            now={new Date()}
            petContext={petContext}
            petSettings={petSettings}
            size={32}
            motion={false}
          />
        </span>
      )}

      {/* XP pill */}
      <span className="xp-toast-pill">
        <span className="xp-toast-plus">+</span>
        <span className="xp-toast-amount">{xp}</span>
        <span className="xp-toast-unit"> XP</span>
      </span>

      {/* Label */}
      <span className="xp-toast-label">
        {firstOfDay && adopted
          ? `${label} · first today`
          : label}
      </span>
    </div>
  );
}
