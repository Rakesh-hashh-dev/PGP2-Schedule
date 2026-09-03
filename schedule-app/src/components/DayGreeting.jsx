import { useState, useMemo } from "react";
import { getTimeGreeting } from "../lib/datetime.js";
import { getPetByKey, getPetOfTheDay } from "./greetingPets.jsx";

export default function DayGreeting({ now, name, petSettings, userPetsEnabled = true }) {
  // Picked once name is known and cached from then on, so it doesn't re-randomize
  // on every clock tick — `now` updates every second/minute via the app's live clock.
  const [picked, setPicked] = useState(null);
  const [pet, setPet] = useState(null);
  if (name && !picked) {
    setPicked(getTimeGreeting(now, name));
    setPet(getPetOfTheDay(now));
  }
  const petsEnabled = petSettings?.enabled !== false && userPetsEnabled;
  const displayPet = petSettings?.mode === "featured"
    ? getPetByKey(petSettings.petKey)
    : pet;
  const motionEnabled = petSettings?.motion !== false;
  // Memoise the SVG element so the live clock's re-renders don't rebuild it.
  const petEl = useMemo(() => (displayPet ? <displayPet.Svg /> : null), [displayPet]);
  if (!picked) return null;
  return (
    <div className="day-greeting">
      {petsEnabled && displayPet && (
        <span
          className="dg-pet"
          data-pet={displayPet.key}
          data-motion={motionEnabled ? "on" : "off"}
          title={`${petSettings?.mode === "featured" ? "Featured" : "Today's"} companion: ${displayPet.label}`}
          aria-hidden="true"
        >
          {petEl}
        </span>
      )}
      <span>{picked}</span>
    </div>
  );
}
