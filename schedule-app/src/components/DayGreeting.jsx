import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGreetingBucket, getTimeGreeting } from "../lib/datetime.js";
import { dayKey, getPetByKey, getPetOfTheDay } from "./greetingPets.jsx";
import {
  CARE_ACTIONS, careLeft, careUsedToday, isAdopted, levelProgress, moodFor, visibleHat, xpOf,
} from "../lib/pet.js";
import PetSleepCue from "./PetSleepCue.jsx";
import PetHat from "./PetHat.jsx";
import { usePetBeat } from "../hooks/usePetBeat.js";
import { usePetGaze } from "../hooks/usePetGaze.js";
import { recordMood } from "../lib/petStats.js";

// Flavour per action, per mood-neutral. The pet's *name* carries the warmth, so
// these stay short — the tray is a 195px popover, not a chat window.
const CARE_LINES = {
  pet: ["leans into the pats.", "melts a little."],
  play: ["is ready to play!", "does a tiny victory lap."],
  treat: ["saved that for later.", "accepts. Tail-powered gratitude engaged."],
};

const MOOD_LINE = {
  celebrating: "levelled up!",
  proud: "saw you clear that.",
  excited: "is bouncing off the walls.",
  focused: "is in class with you.",
  restless: "can tell class is close.",
  happy: "is having a good day.",
  content: "is hanging out.",
  relaxed: "has the day off too.",
  tired: "has had a long day.",
  sleepy: "is dozing off.",
  bored: "is looking for something to do.",
  missing: "missed you.",
};

export default function DayGreeting({
  now, name, petSettings, userPetsEnabled = true, pet, petActions, petContext,
  companionEnabled = true, onOpenPet,
}) {
  const [greeting, setGreeting] = useState(null);
  // Which (day, time-band) the current greeting line was picked for.
  const [greetingStamp, setGreetingStamp] = useState(null);
  const [isPetTrayOpen, setIsPetTrayOpen] = useState(false);
  const [petReaction, setPetReaction] = useState("");
  // Tagged with the pet it was written about, so a message can't outlive its pet.
  const [petMessage, setPetMessage] = useState(null);
  const reactionTimer = useRef(null);
  const shellRef = useRef(null);

  // `now` ticks every second, but the greeting only goes stale when the day or
  // the time-of-day band changes — so re-pick on that, not on every tick.
  const stamp = `${dayKey(now)}|${getGreetingBucket(now.getHours())}`;
  if (name && greetingStamp !== stamp) {
    setGreetingStamp(stamp);
    setGreeting(getTimeGreeting(now, name));
  }

  // Pure function of the date, so it needs no state — but memoise on the key so
  // the object identity (and the SVG below) survives the live clock's renders.
  const petKeyOfDay = getPetOfTheDay(now).key;
  const dailyPet = useMemo(() => getPetByKey(petKeyOfDay), [petKeyOfDay]);

  // With the companion layer off (admin kill switch), the greeting keeps its
  // decorative daily pet but offers nothing persistent — no adoption, no care.
  const adopted = companionEnabled && isAdopted(pet);
  const petsEnabled = petSettings?.enabled !== false && userPetsEnabled;
  const motionEnabled = petSettings?.motion !== false;

  // An adopted companion outranks the daily rotation and the admin's featured
  // pick — those exist to give un-adopted students something to meet.
  const displayPet = adopted
    ? getPetByKey(pet.petKey)
    : (petSettings?.mode === "featured" ? getPetByKey(petSettings.petKey) : dailyPet);

  // Memoise the SVG element so the live clock's re-renders don't rebuild it.
  const petEl = useMemo(() => (displayPet ? <displayPet.Svg /> : null), [displayPet]);
  useEffect(() => () => window.clearTimeout(reactionTimer.current), []);

  // Derived here rather than in usePet: both depend on the live clock, and the
  // hook would have to re-render once a second to keep them fresh.
  const mood = adopted ? moodFor(pet, now, petContext) : "content";
  const beat = usePetBeat(mood, adopted && motionEnabled);
  const gaze = usePetGaze(adopted && motionEnabled);
  const progress = adopted ? levelProgress(xpOf(pet)) : null;
  const left = adopted ? careLeft(pet, now) : 0;

  const petLabel = adopted && pet.name ? pet.name : displayPet?.label;

  // A message only stands while its own pet is on screen: the day rolling over,
  // an admin switching the featured pet, or adopting retires it.
  const trayLabel = petMessage?.key === displayPet?.key
    ? `${petLabel} ${petMessage.text}`
    : `${petLabel} ${MOOD_LINE[mood]}`;

  // Closing drops the last reaction line too, so reopening the tray greets you
  // afresh instead of replaying "Treat accepted" from an hour ago.
  const closeTray = useCallback(() => {
    setIsPetTrayOpen(false);
    setPetMessage(null);
  }, []);

  // Diagnostic only — see petStats.js. In an effect rather than in render so a
  // StrictMode double-render cannot double-count, and so a tally write never
  // sits between React and the paint it is measuring.
  useEffect(() => {
    if (adopted) recordMood(mood);
  }, [adopted, mood]);

  // Dismiss on Escape or an outside click, like the app's other popovers.
  useEffect(() => {
    if (!isPetTrayOpen) return undefined;
    const onKeyDown = e => { if (e.key === "Escape") closeTray(); };
    const onPointerDown = e => {
      if (!shellRef.current?.contains(e.target)) closeTray();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isPetTrayOpen, closeTray]);

  const reactWithPet = action => {
    if (!adopted || !petActions) return;
    const wasFree = careLeft(pet, now) > 0;
    // Cycle the flavour line off the care counter rather than Math.random:
    // deterministic (so it stays a pure function of state) but still different
    // on the next tap.
    const used = careUsedToday(pet, now);
    petActions.care(action, now);
    const options = CARE_LINES[action];
    setPetMessage({
      key: displayPet.key,
      // Over-cap taps still animate and still get a line — the pet should never
      // feel unresponsive — but they say so rather than implying more XP.
      text: wasFree
        ? options[used % options.length]
        : "has had plenty of attention today.",
    });
    setPetReaction(action);
    window.clearTimeout(reactionTimer.current);
    reactionTimer.current = window.setTimeout(() => setPetReaction(""), 1150);
  };

  if (!greeting) return null;

  return (
    <div className="day-greeting">
      {petsEnabled && displayPet && (
        <span className="dg-pet-shell" ref={shellRef}>
          <button
            type="button"
            className="dg-pet"
            data-pet={displayPet.key}
            data-motion={motionEnabled ? "on" : "off"}
            data-mood={adopted ? mood : undefined}
            data-accessory={adopted && pet.cosmetics?.accessory === false ? "off" : undefined}
            data-reaction={petReaction || undefined}
            data-beat={petReaction ? undefined : beat || undefined}
            data-sig={petSettings?.signatures === false ? "off" : undefined}
            {...gaze}
            onClick={() => (isPetTrayOpen ? closeTray() : setIsPetTrayOpen(true))}
            aria-expanded={isPetTrayOpen}
            aria-controls="daily-pet-actions"
            // Doubles as the hover tooltip and the accessible name — the SVG
            // itself is aria-hidden so the pet isn't announced twice.
            aria-label={adopted ? `${petLabel}, level ${progress.level}, ${MOOD_LINE[mood]}` : `Meet ${displayPet.label}`}
            title={adopted ? `${petLabel} · Lv ${progress.level}` : `Meet ${displayPet.label}`}
          >
            {petEl}
            <PetHat hat={adopted ? visibleHat(pet, { wardrobe: petSettings?.wardrobe !== false, hatsOff: petSettings?.hatsOff || [] }) : null} />
            <PetSleepCue />
          </button>

          {isPetTrayOpen && (
            <span
              className={`dg-pet-tray${!adopted && companionEnabled ? " adopting" : ""}`}
              id="daily-pet-actions"
              role="group"
              aria-label={adopted ? `${petLabel} companion actions` : "Adopt a companion"}
            >
              {adopted ? (
                <>
                  <span className="dg-pet-tray-label">{trayLabel}</span>
                  <span className="dg-pet-meta">
                    <span className="dg-pet-lvl">Lv {progress.level}</span>
                    <span className="dg-pet-bar" aria-hidden="true">
                      <span className="dg-pet-bar-fill" style={{ width: `${progress.pct}%` }} />
                    </span>
                    <span className="dg-pet-xp">
                      {progress.maxed ? "Max" : `${progress.into}/${progress.need}`}
                    </span>
                  </span>
                  <span className="dg-pet-actions">
                    {CARE_ACTIONS.map(action => (
                      <button key={action} type="button" onClick={() => reactWithPet(action)}>
                        {action[0].toUpperCase() + action.slice(1)}
                      </button>
                    ))}
                  </span>
                  <span className="dg-pet-hint">
                    {left > 0
                      ? `${left} treat${left === 1 ? "" : "s"} left today`
                      : "Mark your classes to keep earning XP"}
                  </span>
                </>
              ) : !companionEnabled ? (
                // Companion layer off: the daily pet is decoration again, so the
                // tray says hello and offers nothing that would need saving.
                <span className="dg-pet-tray-label">{displayPet.label} is hanging out.</span>
              ) : (
                <>
                  {/* Adoption used to happen here, in a 236px popover: a three-
                      thumbnail picker and a name field, for the one moment in
                      this feature anybody remembers. It has a whole page — send
                      them there and let it be an occasion. The tray keeps only
                      the invitation. */}
                  <span className="dg-pet-tray-label">Adopt a companion?</span>
                  <span className="dg-pet-hint">
                    They level up as you mark classes and clear deadlines — not by
                    being tapped.
                  </span>
                  <span className="dg-pet-actions">
                    <button type="button" onClick={() => { closeTray(); onOpenPet?.(); }}>
                      Meet them
                    </button>
                  </span>
                </>
              )}
            </span>
          )}
        </span>
      )}
      <span>{greeting}</span>
    </div>
  );
}
