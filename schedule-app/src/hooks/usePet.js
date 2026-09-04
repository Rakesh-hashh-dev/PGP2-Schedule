import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adopt, award, care, rename, scaleXp, setCosmetic, switchTo, XP, keyFor } from "../lib/pet.js";
import { loadPet, savePet, syncPetFromCloud } from "../lib/petStorage.js";

/**
 * The pet's state and the handful of actions that change it.
 *
 * Deliberately thin: every rule lives in `lib/pet.js` as a pure transform, and
 * this hook only owns "which transform, and when to persist". Derived values
 * (level, mood, care budget) are NOT computed here — they depend on the live
 * clock, so the component computes them from `pet` and its own `now` and this
 * hook doesn't re-render once a second to keep up.
 */
export function usePet(userId, { xpRate = 1 } = {}) {
  // Seeded from THIS user's namespaced cache, so a previous account signed in
  // on the same browser can never seed (and then donate) its ledger.
  const [pet, setPet] = useState(() => loadPet(userId));
  // Set by a mutation, cleared by the save effect below. A ref rather than
  // state so marking dirty never causes a render of its own.
  const dirty = useRef(false);

  // Reconcile with the cloud row once per user. `mergePets` unions the award
  // ledgers, so a phone that earned XP offline keeps it when the laptop syncs.
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    syncPetFromCloud(userId).then(merged => {
      if (alive) setPet(merged);
    });
    return () => { alive = false; };
  }, [userId]);

  // Persist only what a mutation actually changed. The cloud write inside
  // `savePet` is debounced and flushed on pagehide; the local write is
  // synchronous, so a crash before the flush loses nothing.
  useEffect(() => {
    if (!dirty.current) return;
    dirty.current = false;
    savePet(userId, pet);
  }, [pet, userId]);

  /** Apply a pure transform from lib/pet.js. No-ops keep object identity. */
  const apply = useCallback(fn => {
    setPet(prev => {
      const next = fn(prev);
      if (next === prev) return prev;
      dirty.current = true;
      return next;
    });
  }, []);

  // Memoised as a whole: callers put `actions` in effect dependency arrays
  // (the daily streak award is one), and a fresh object each render would make
  // those effects fire on every tick of the app's live clock.
  const actions = useMemo(() => ({
    adopt: (petKey, name, now) => apply(s => adopt(s, petKey, name, now)),
    care: (action, now) => apply(s => care(s, action, now, xpRate)),
    rename: name => apply(s => rename(s, name)),
    switchTo: petKey => apply(s => switchTo(s, petKey)),
    setCosmetic: (key, on) => apply(s => setCosmetic(s, key, on)),
    /**
     * Award against a stable event key. Safe to call unconditionally and
     * repeatedly — `award` ignores a key it has already paid out, so callers
     * never have to remember what they've already reported.
     */
    awardXp: (key, amount, now) => apply(s => award(s, key, scaleXp(amount, xpRate), now)),
  }), [apply, xpRate]);

  return { pet, actions, XP, keyFor };
}
