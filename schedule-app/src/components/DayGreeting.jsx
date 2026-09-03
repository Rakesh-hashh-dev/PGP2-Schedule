import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGreetingBucket, getTimeGreeting } from "../lib/datetime.js";
import { dayKey, getPetByKey, getPetOfTheDay } from "./greetingPets.jsx";

export default function DayGreeting({ now, name, petSettings, userPetsEnabled = true }) {
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
  // Re-picking per tick would reshuffle the random line constantly; never
  // re-picking (the original behaviour) left a tab open overnight showing
  // yesterday's pet and "Good evening" at 9am.
  const stamp = `${dayKey(now)}|${getGreetingBucket(now.getHours())}`;
  if (name && greetingStamp !== stamp) {
    setGreetingStamp(stamp);
    setGreeting(getTimeGreeting(now, name));
  }

  // Pure function of the date, so it needs no state — but memoise on the key so
  // the object identity (and the SVG below) survives the live clock's renders.
  const petKeyOfDay = getPetOfTheDay(now).key;
  const pet = useMemo(() => getPetByKey(petKeyOfDay), [petKeyOfDay]);

  const petsEnabled = petSettings?.enabled !== false && userPetsEnabled;
  const displayPet = petSettings?.mode === "featured"
    ? getPetByKey(petSettings.petKey)
    : pet;
  const motionEnabled = petSettings?.motion !== false;
  // Memoise the SVG element so the live clock's re-renders don't rebuild it.
  const petEl = useMemo(() => (displayPet ? <displayPet.Svg /> : null), [displayPet]);
  useEffect(() => () => window.clearTimeout(reactionTimer.current), []);

  // A message only stands while its own pet is on screen: the day rolling over
  // or an admin switching the featured pet retires it, since the line names the
  // pet by label.
  const trayLabel = petMessage?.key === displayPet?.key
    ? petMessage.text
    : `${displayPet?.label} is hanging out.`;

  // Closing drops the last reaction line too, so reopening the tray greets you
  // afresh instead of replaying "Treat accepted" from an hour ago.
  const closeTray = useCallback(() => {
    setIsPetTrayOpen(false);
    setPetMessage(null);
  }, []);

  // Dismiss on Escape or an outside click, like the app's other popovers.
  useEffect(() => {
    if (!isPetTrayOpen) return;
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
    const messages = {
      pet: [`${displayPet.label} leans into the pats.`, "That was a very good scratch."],
      play: [`${displayPet.label} is ready to play!`, "A tiny victory lap for you."],
      treat: [`${displayPet.label} saved that treat for later.`, "Treat accepted. Tail-powered gratitude activated."],
    };
    const options = messages[action];
    setPetMessage({ key: displayPet.key, text: options[Math.floor(Math.random() * options.length)] });
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
            data-reaction={petReaction || undefined}
            onClick={() => (isPetTrayOpen ? closeTray() : setIsPetTrayOpen(true))}
            aria-expanded={isPetTrayOpen}
            aria-controls="daily-pet-actions"
            // Doubles as the hover tooltip and the accessible name — the SVG
            // itself is aria-hidden so the pet isn't announced twice.
            aria-label={`Spend a moment with ${displayPet.label}`}
            title={`Spend a moment with ${displayPet.label}`}
          >
            {petEl}
          </button>
          {isPetTrayOpen && (
            <span className="dg-pet-tray" id="daily-pet-actions" role="group" aria-label={`${displayPet.label} companion actions`}>
              <span className="dg-pet-tray-label">{trayLabel}</span>
              <span className="dg-pet-actions">
                <button type="button" onClick={() => reactWithPet("pet")}>Pet</button>
                <button type="button" onClick={() => reactWithPet("play")}>Play</button>
                <button type="button" onClick={() => reactWithPet("treat")}>Treat</button>
              </span>
            </span>
          )}
        </span>
      )}
      <span>{greeting}</span>
    </div>
  );
}
