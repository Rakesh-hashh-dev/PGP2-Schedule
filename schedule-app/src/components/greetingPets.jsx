/* eslint-disable react-refresh/only-export-components */
import CompanionArtwork from "./CompanionArtwork.jsx";
import { Hoot, Byte, Pebble, Prickle } from "./petExtras.jsx";
import Luna from "./Luna.jsx";
import { Hamster, Sloth, Capy, Unicorn, Dragon } from "./petLateRoster.jsx";
import {
  Maple,
  Ember,
  Mochi,
  Nimbus,
  Sable,
  Inky,
} from "./petNewCollection.jsx";
import { RENAMED_PETS } from "../lib/pet.js";

function Cat() {
  return <CompanionArtwork pet="cat" />;
}
function Fox() {
  return <CompanionArtwork pet="fox" />;
}
function Dog() {
  return <CompanionArtwork pet="dog" />;
}
function Bunny() {
  return <CompanionArtwork pet="bunny" />;
}
function Penguin() {
  return <CompanionArtwork pet="penguin" />;
}
function Panda() {
  return <CompanionArtwork pet="panda" />;
}
function Chick() {
  return <CompanionArtwork pet="chick" />;
}
function Koala() {
  return <CompanionArtwork pet="koala" />;
}
function Otter() {
  return <CompanionArtwork pet="otter" />;
}
function Rover() {
  return <CompanionArtwork pet="rover" />;
}
function Raccoon() {
  return <CompanionArtwork pet="raccoon" />;
}
function Axolotl() {
  return <CompanionArtwork pet="axolotl" />;
}
function Spark() {
  return <CompanionArtwork pet="spark" />;
}
function Leafy() {
  return <CompanionArtwork pet="leafy" />;
}
function Lion() {
  return <CompanionArtwork pet="cinder" />;
}
function Frost() {
  return <CompanionArtwork pet="frost" />;
}

export const PETS = [
  { key: "cat", label: "Cat", Svg: Cat },
  { key: "fox", label: "Fox", Svg: Fox },
  { key: "dog", label: "Dog", Svg: Dog },
  { key: "bunny", label: "Bunny", Svg: Bunny },
  { key: "penguin", label: "Penguin", Svg: Penguin },
  { key: "panda", label: "Panda", Svg: Panda },
  { key: "chick", label: "Chick", Svg: Chick },
  { key: "koala", label: "Koala", Svg: Koala },
  { key: "otter", label: "Otter", Svg: Otter },
  { key: "rover", label: "Rover", Svg: Rover },
  { key: "raccoon", label: "Raccoon", Svg: Raccoon },
  { key: "axolotl", label: "Axolotl", Svg: Axolotl },
  { key: "spark", label: "Spark", Svg: Spark },
  { key: "leafy", label: "Leafy", Svg: Leafy },
  { key: "cinder", label: "Lion", Svg: Lion },
  { key: "hoot", label: "Hoot", Svg: Hoot },
  { key: "byte", label: "Byte", Svg: Byte },
  { key: "pebble", label: "Pebble", Svg: Pebble },
  { key: "prickle", label: "Prickle", Svg: Prickle },
  { key: "luna", label: "Luna", Svg: Luna },
  { key: "frost", label: "Frost", Svg: Frost },
  // Unicorn and Dragon took over Sol and Eclipse's places (and saved keys, via
  // RENAMED_PETS) on 2026-10-20. Tide's Lv 16 slot went to Sable; Nova and the
  // short-lived Griffin were retired the same day.
  { key: "unicorn", label: "Unicorn", Svg: Unicorn },
  { key: "dragon", label: "Dragon", Svg: Dragon },
  { key: "hamster", label: "Hamster", Svg: Hamster },
  { key: "sloth", label: "Sloth", Svg: Sloth },
  { key: "capy", label: "Capybara", Svg: Capy },
  // The devotion collection from PR #22 (tiers 1-4, see DEVOTION_COMPANIONS).
  { key: "maple", label: "Maple", Svg: Maple },
  { key: "ember", label: "Ember", Svg: Ember },
  { key: "mochi", label: "Mochi", Svg: Mochi },
  { key: "nimbus", label: "Nimbus", Svg: Nimbus },
  { key: "sable", label: "Sable", Svg: Sable },
  { key: "inky", label: "Inky", Svg: Inky },
];

// The rover shipped as a turtle originally and admin configs saved in prod may
// still carry the old key. Map it forward so a saved "featured pet" keeps
// pointing at the pet the admin actually chose instead of silently falling
// back to the first entry.
// `capybara` was an early key for what became the axolotl, which is why the
// capybara companion is keyed `capy`.
const LEGACY_KEYS = {
  turtle: "rover",
  capybara: "axolotl",
  lion: "cinder",
  ...RENAMED_PETS,
};

export function getPetByKey(key) {
  const resolved = LEGACY_KEYS[key] || key;
  return PETS.find((pet) => pet.key === resolved) || PETS[0];
}

/** Local calendar day as `YYYY-M-D`, used to refresh greeting copy at midnight. */
export function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
