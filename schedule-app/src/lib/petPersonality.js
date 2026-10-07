// Visual actions only: no XP, ledger entries or saved-state changes.
export const PET_PERSONALITIES = {
  cat: ["groom", "slowblink", "earlisten"],
  fox: ["tailcurl", "sidepeek", "nosetwitch"],
  dog: ["bow", "tailwag", "headtilt"],
  bunny: ["doublehop", "nosewiggle", "earperk"],
  penguin: ["waddle", "wave", "proudpose"],
  panda: ["pawrub", "covereyes", "stretch"],
  chick: ["peck", "flutter", "hop"],
  koala: ["slowstretch", "eartwitch", "tuck"],
  otter: ["clap", "bellypat", "wiggle"],
  rover: ["scan", "chassis", "antenna"],
  raccoon: ["pawrub", "peek", "tailflick"],
  axolotl: ["paddle", "gillripple", "float"],
  spark: ["charge", "eartwitch", "zap"],
  leafy: ["unfurl", "sway", "spore"],
  nova: ["stargaze", "orbit", "dreamyblink"],
  cinder: ["maneshake", "pawlift", "yawn"],
  hoot: ["glasses", "think", "flutter"],
  byte: ["wave", "shuffle", "antenna"],
  pebble: ["peek", "neckstretch", "hide"],
  prickle: ["sniff", "curl", "uncurl"],
  luna: ["luna-wave", "luna-run-right", "luna-run-left", "luna-think", "luna-jump", "luna-review"],
};
const MOOD_ACTIONS = {
  birthday: ["bounce", "wiggle"], festive: ["bounce", "wiggle"],
  celebrating: ["bounce", "wiggle"], proud: ["perk", "peek"],
  excited: ["bounce", "wiggle"], focused: ["perk", "peek"],
  restless: ["tilt", "sniff"], playful: ["bounce", "wiggle", "stretch"],
  happy: ["tilt", "stretch"], curious: ["peek", "sniff"],
  content: ["stretch", "tilt"], relaxed: ["stretch", "yawn"],
  cozy: ["yawn", "slowblink"], tired: ["yawn", "slowstretch"],
  sleepy: ["yawn", "dreamyblink"], bored: ["tilt", "stretch"],
  missing: ["tilt", "peek"],
};
const QUIET = new Set(["sleepy", "tired", "cozy", "focused"]);
const QUIET_ACTIONS = new Set(["slowblink", "dreamyblink", "earlisten", "headtilt", "think", "glasses", "scan", "stargaze", "neckstretch", "tuck", "slowstretch", "yawn", "sway", "float"]);
const LUNA_MOODS = {
  birthday: ["luna-jump", "luna-wave"], festive: ["luna-jump", "luna-wave"],
  celebrating: ["luna-jump", "luna-wave"], proud: ["luna-wave", "luna-review"],
  excited: ["luna-jump", "luna-run-right", "luna-run-left"],
  focused: ["luna-think", "luna-review"], restless: ["luna-run-right", "luna-run-left", "luna-wait"],
  playful: ["luna-jump", "luna-run-right", "luna-run-left"], happy: ["luna-wave", "luna-jump", "luna-wait"],
  curious: ["luna-review", "luna-think", "luna-wait"],
  relaxed: ["luna-wait", "luna-think"], cozy: ["luna-rest", "luna-wait"],
  tired: ["luna-rest", "luna-wait"], sleepy: ["luna-rest", "luna-wait"],
  bored: ["luna-think", "luna-wait"], missing: ["luna-rest", "luna-wait"],
};
export function beatPoolFor(petKey, mood) {
  if (petKey === "luna") return LUNA_MOODS[mood] || PET_PERSONALITIES.luna;
  const signature = PET_PERSONALITIES[petKey] || [];
  const suitable = QUIET.has(mood) ? signature.filter(action => QUIET_ACTIONS.has(action)) : signature;
  return [...new Set([...suitable, ...(MOOD_ACTIONS[mood] || MOOD_ACTIONS.content)])];
}
export function choosePetBeat(petKey, mood, previous = "", random = Math.random) {
  const pool = beatPoolFor(petKey, mood).filter(action => action !== previous);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] || "tilt";
}
export const PET_BEAT_MS = 1_800;
export const PET_GAP_MIN_MS = 18_000;
export const PET_GAP_MAX_MS = 46_000;
/** One cancellable clock. Hidden tabs and care reactions discard active beats. */
export function createPetBeatClock({ petKey, mood, onBeat, random = Math.random, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer;
  let running = false;
  let previous = "";
  function schedule() {
    timer = setTimer(() => {
      previous = choosePetBeat(petKey, mood, previous, random);
      onBeat(previous);
      timer = setTimer(() => { onBeat(""); schedule(); }, petKey === "luna" ? 1_920 : PET_BEAT_MS);
    }, PET_GAP_MIN_MS + random() * (PET_GAP_MAX_MS - PET_GAP_MIN_MS));
  }
  return {
    start() { if (!running) { running = true; schedule(); } },
    stop() { running = false; clearTimer(timer); onBeat(""); },
  };
}
