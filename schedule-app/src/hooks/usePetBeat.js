import { useEffect, useState } from "react";

// One-off idle "beats" — a stretch, yawn, sniff, wiggle, or curious peek.
//
// Every other pet animation is an infinite loop, which is what makes a pet on
// screen for ten minutes start to read as a GIF. A beat is the opposite: rare,
// short, and it lands on a schedule you can't predict, so the animal looks like
// it decided to do something. The mood picks the vocabulary — a tired pet
// yawns, an excited one bounces — and "content" gets the widest range because
// it is the mood you spend the most time looking at.
const BEATS = {
  celebrating: ["bounce", "shake", "wiggle"],
  proud: ["perk", "bounce", "peek"],
  excited: ["bounce", "shake", "perk", "wiggle"],
  focused: ["perk", "peek"],
  restless: ["shake", "perk", "tilt", "sniff"],
  playful: ["bounce", "shake", "stretch", "wiggle"],
  happy: ["bounce", "tilt", "stretch", "sniff"],
  curious: ["perk", "tilt", "peek", "sniff"],
  content: ["stretch", "tilt", "shake", "perk", "sniff"],
  relaxed: ["stretch", "tilt", "yawn", "peek"],
  cozy: ["stretch", "yawn", "peek"],
  tired: ["yawn", "stretch"],
  sleepy: ["yawn"],
  bored: ["tilt", "stretch", "yawn", "sniff"],
  missing: ["tilt", "perk", "peek"],
};

/** Bounds on the gap between beats. Long enough that two never feel paired. */
const GAP_MIN_MS = 24_000;
const GAP_MAX_MS = 62_000;
/** Must outlast the longest beat keyframe in styles.css. */
const BEAT_MS = 1_600;

/**
 * The beat the pet should be playing right now, or `""`.
 *
 * Returns `""` forever when motion is off or the reader has asked for reduced
 * motion — the CSS guards would swallow the animation anyway, but gating here
 * means we also stop running a timer for an effect nobody will see.
 */
export function usePetBeat(mood, enabled = true) {
  const [beat, setBeat] = useState("");

  useEffect(() => {
    // Both bail-outs simply run no timer. The cleanup from the previous run has
    // already cleared any beat that was on screen, so there is nothing to reset.
    if (!enabled) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        const pool = BEATS[mood] || BEATS.content;
        setBeat(pool[Math.floor(Math.random() * pool.length)]);
        timer = setTimeout(() => { setBeat(""); schedule(); }, BEAT_MS);
      }, GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS));
    };
    schedule();
    // Changing mood restarts the clock, so a mood flip never lands mid-beat
    // with the wrong vocabulary still on the element.
    return () => { clearTimeout(timer); setBeat(""); };
  }, [mood, enabled]);

  return beat;
}
