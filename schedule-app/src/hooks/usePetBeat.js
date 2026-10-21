import { useEffect, useState } from "react";
import { createPetBeatClock } from "../lib/petPersonality.js";

export function usePetBeat(mood, enabled = true, petKey = "cat", reaction = null) {
  const [beat, setBeat] = useState("");
  useEffect(() => {
    if (!enabled || reaction) return undefined;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const clock = createPetBeatClock({ petKey, mood, onBeat: setBeat });
    const sync = () => {
      if (document.hidden || media?.matches) clock.stop();
      else clock.start();
    };
    document.addEventListener("visibilitychange", sync);
    media?.addEventListener?.("change", sync);
    sync();
    return () => {
      clock.stop();
      document.removeEventListener("visibilitychange", sync);
      media?.removeEventListener?.("change", sync);
    };
  }, [mood, enabled, petKey, reaction]);
  return enabled && !reaction ? beat : "";
}
