// The companion, anywhere that is not the greeting or the pet page.
//
// The pet was drawn once, moods and all, and then lived on exactly two screens.
// This is the piece that lets it show up wherever it has something to add — a
// free day, the term recap — without each caller re-deriving the mood, the
// wardrobe and the cohort's kill switches.
//
// It renders nothing at all unless there is a pet to show and the student and
// the cohort both still want one, so a caller can drop it in unconditionally
// and never think about the empty case.
//
// Decorative by contract: `aria-hidden`, no interaction, no layout of its own
// beyond the size it is given. Anything that needs to be READ (a name, a level)
// belongs in the caller's own markup, next to it.
import { isAdopted, moodExplainFor, visibleCoat, visibleHat, visibleNeckwear } from "../lib/pet.js";
import { getPetByKey } from "./greetingPets.jsx";
import PetHat from "./PetHat.jsx";
import PetNeckwear from "./PetNeckwear.jsx";
import PetSleepCue from "./PetSleepCue.jsx";

export default function PetCameo({
  pet,
  now = new Date(),
  petContext,
  petSettings,
  size = 44,
  motion = true,
  className = "",
}) {
  if (!isAdopted(pet) || pet?.companionEnabled === false) return null;
  if (petSettings?.enabled === false) return null;
  const art = getPetByKey(pet.petKey);
  if (!art) return null;

  const { mood } = moodExplainFor(pet, now, petContext || {});
  const wardrobe = petSettings?.wardrobe !== false;
  const hatsOff = petSettings?.hatsOff || [];

  return (
    <span
      className={`dg-pet pet-cameo ${className}`.trim()}
      // The px offsets the hat and collar are tuned against assume the 40px
      // greeting chip; scaling them here keeps a cameo at any size wearing its
      // wardrobe straight (see --pet-overlay-k in styles.css).
      style={{ width: size, height: size, "--pet-z": `${Math.round(size * 0.22)}px`, "--pet-overlay-k": size / 40 }}
      data-pet={art.key}
      data-motion={motion && petSettings?.motion !== false ? "on" : "off"}
      data-mood={mood}
      data-coat={visibleCoat(pet, { wardrobe }) || undefined}
      data-neck={visibleNeckwear(pet, { wardrobe }) || undefined}
      data-accessory={pet?.cosmetics?.accessory === false ? "off" : undefined}
      data-sig={petSettings?.signatures === false ? "off" : undefined}
      aria-hidden="true"
    >
      <art.Svg />
      <PetHat hat={visibleHat(pet, { wardrobe, hatsOff })} />
      <PetNeckwear neck={visibleNeckwear(pet, { wardrobe })} />
      <PetSleepCue />
    </span>
  );
}
