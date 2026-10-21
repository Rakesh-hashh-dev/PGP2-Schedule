import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adopt, award, care, companionsGained, hoursSince, isAdopted, levelProgress, rename, scaleXp, setCosmetic, switchTo, xpOf, MOMENT_MS, REUNION_HOURS, XP, keyFor } from "../lib/pet.js";
import { useCompanionMemory } from "./useCompanionMemory.js";
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
  const memory = useCompanionMemory(userId);
  const [pet, setPet] = useState(() => loadPet(userId));
  // Set by a mutation, cleared by the save effect below. A ref rather than
  // state so marking dirty never causes a render of its own.
  const dirty = useRef(false);
  // A short-lived "something just happened" mood — a level-up, or a deadline
  // cleared. Session-only on purpose: it is a reaction to an event you were
  // present for, so it should not be waiting for you on another device an hour
  // later. `moodFor` compares `momentUntil` against the app clock, so this
  // needs no timer of its own to expire.
  const [moment, setMoment] = useState(null);
  // Last (level, deadlines-cleared, pet) this hook observed. `null` means
  // "re-seed without reacting" — see the cloud reconcile below.
  const seen = useRef(null);
  // Companions earned while the student was watching, oldest first. Same
  // session-only rule as `moment`: a merge from another device re-seeds instead.
  const [gained, setGained] = useState([]);
  // Event keys awarded this session but possibly not rendered yet. `awardXp`
  // answers "was this new?" from here and `petRef`, so two taps inside one
  // render cannot both report a first-time award.
  const paid = useRef(new Set());
  // The latest pet, for `care` to read how long the student was away without
  // putting `pet` in the dependency array of the memoised actions below.
  const petRef = useRef(pet);
  useEffect(() => { petRef.current = pet; }, [pet]);

  // Reconcile with the cloud row once per user. `mergePets` unions the award
  // ledgers, so a phone that earned XP offline keeps it when the laptop syncs.
  useEffect(() => {
    paid.current = new Set();
    if (!userId) return undefined;
    let alive = true;
    syncPetFromCloud(userId).then(merged => {
      if (!alive) return;
      // XP arriving from another device is history, not an event: re-seed the
      // baseline so a merge that lifts the level does not fire a celebration
      // for something that happened on a phone yesterday.
      seen.current = null;
      setPet(merged);
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

  // Moments, derived by watching the state rather than by threading a callback
  // through every action: this catches a level-up however it was earned, and
  // costs nothing when nothing changed (the ledger is only re-counted when the
  // `pet` object identity actually moves).
  useEffect(() => {
    const level = levelProgress(xpOf(pet)).level;
    let deadlines = 0;
    for (const key in pet.awarded) if (key.startsWith("due:")) deadlines++;
    const prev = seen.current;
    seen.current = { level, deadlines, pet };
    if (!prev) return;                                  // first look, or a re-seed
    const fresh = companionsGained(prev.pet, pet);
    if (fresh.length) setGained(q => [...q, ...fresh.filter(k => !q.includes(k))]);
    if (level > prev.level) setMoment({ moment: "celebrating", momentUntil: Date.now() + MOMENT_MS });
    else if (deadlines > prev.deadlines) setMoment({ moment: "proud", momentUntil: Date.now() + MOMENT_MS });
  }, [pet]);

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
    care: (action, now) => {
      // Coming back after three days and saying hello is a reunion: a moment,
      // like a level-up, and session-only for the same reason.
      const before = petRef.current;
      if (isAdopted(before) && hoursSince(before, now) >= REUNION_HOURS) {
        setMoment({ moment: "reunion", momentUntil: Date.now() + MOMENT_MS });
      }
      apply(s => care(s, action, now, xpRate));
    },
    rename: name => apply(s => rename(s, name)),
    switchTo: petKey => apply(s => switchTo(s, petKey)),
    setCosmetic: (key, on) => apply(s => setCosmetic(s, key, on)),
    /**
     * Award against a stable event key. Safe to call unconditionally and
     * repeatedly — `award` ignores a key it has already paid out, so callers
     * never have to remember what they've already reported. Returns true the
     * first time a key is awarded, so callers can toast without peeking at a
     * possibly stale copy of the ledger.
     */
    awardXp: (key, amount, now) => {
      const isNew = !(key in petRef.current.awarded) && !paid.current.has(key);
      if (isNew) paid.current.add(key);
      apply(s => award(s, key, scaleXp(amount, xpRate), now));
      return isNew;
    },
    /** Drop the oldest companion from `gained` once its toast has shown. */
    dismissGained: () => setGained(q => q.slice(1)),
  }), [apply, xpRate]);

  return { pet, actions, moment, gained, memory, XP, keyFor };
}
