// Visual actions only: no XP, ledger entries or saved-state changes.
// Newer beats: downdog (front-low, back-up stretch), twirl (a quick 360 hop),
// glance (lean and look to one side, then back), shimmy (a happy wiggle).
// Luna is a sprite, so she skips them and keeps her own strip pool below.
export const PET_PERSONALITIES = {
  cat: ["groom", "slowblink", "earlisten", "downdog"],
  fox: ["tailcurl", "sidepeek", "nosetwitch", "glance"],
  dog: ["bow", "tailwag", "headtilt", "shimmy"],
  bunny: ["doublehop", "nosewiggle", "earperk", "twirl"],
  penguin: ["waddle", "wave", "proudpose", "shimmy"],
  panda: ["pawrub", "covereyes", "stretch", "downdog"],
  chick: ["peck", "flutter", "hop", "twirl"],
  koala: ["slowstretch", "eartwitch", "tuck", "downdog"],
  otter: ["clap", "bellypat", "wiggle", "twirl"],
  rover: ["scan", "chassis", "antenna", "glance"],
  raccoon: ["pawrub", "peek", "tailflick", "shimmy"],
  axolotl: ["paddle", "gillripple", "float", "shimmy"],
  spark: ["charge", "eartwitch", "zap", "twirl"],
  leafy: ["unfurl", "sway", "spore", "shimmy"],
  nova: ["stargaze", "orbit", "dreamyblink", "glance"],
  cinder: ["maneshake", "pawlift", "yawn", "downdog"],
  hoot: ["glasses", "think", "flutter", "glance"],
  byte: ["wave", "shuffle", "antenna", "twirl"],
  pebble: ["peek", "neckstretch", "hide", "glance"],
  prickle: ["sniff", "curl", "uncurl", "shimmy"],
  frost: ["tailcurl", "nosetwitch", "headtilt", "downdog"],
  tide: ["float", "paddle", "wiggle", "twirl"],
  sol: ["flutter", "stretch", "proudpose", "shimmy"],
  eclipse: ["stargaze", "dreamyblink", "slowblink", "glance"],
  luna: ["luna-wave", "luna-run-right", "luna-run-left", "luna-think", "luna-jump", "luna-review"],
};
export const MOOD_ACTIONS = {
  birthday: ["bounce", "wiggle"], festive: ["bounce", "wiggle"],
  celebrating: ["bounce", "wiggle"], proud: ["perk", "peek"],
  excited: ["bounce", "wiggle"], focused: ["perk", "peek"],
  restless: ["tilt", "sniff"], playful: ["bounce", "wiggle", "stretch"],
  happy: ["tilt", "stretch"], curious: ["peek", "sniff"],
  content: ["stretch", "tilt"], relaxed: ["stretch", "yawn"],
  cozy: ["yawn", "slowblink"], tired: ["yawn", "slowstretch"],
  sleepy: ["yawn", "dreamyblink"], bored: ["tilt", "stretch"],
  missing: ["tilt", "peek"],
  reunion: ["bounce", "twirl", "shimmy"], determined: ["perk", "glance"],
  hyped: ["bounce", "twirl", "shimmy"], weekend: ["downdog", "yawn", "slowblink"],
  rooting: ["perk", "tilt"],
};
const QUIET = new Set(["sleepy", "tired", "cozy", "focused", "weekend"]);
const QUIET_ACTIONS = new Set(["slowblink", "dreamyblink", "earlisten", "headtilt", "think", "glasses", "scan", "stargaze", "neckstretch", "tuck", "slowstretch", "yawn", "sway", "float", "downdog", "glance"]);
export const LUNA_MOODS = {
  birthday: ["luna-jump", "luna-wave"], festive: ["luna-jump", "luna-wave"],
  celebrating: ["luna-jump", "luna-wave"], proud: ["luna-wave", "luna-review"],
  excited: ["luna-jump", "luna-run-right", "luna-run-left"],
  focused: ["luna-think", "luna-review"], restless: ["luna-run-right", "luna-run-left", "luna-wait"],
  playful: ["luna-jump", "luna-run-right", "luna-run-left"], happy: ["luna-wave", "luna-jump", "luna-wait"],
  curious: ["luna-review", "luna-think", "luna-wait"],
  relaxed: ["luna-wait", "luna-think"], cozy: ["luna-rest", "luna-wait"],
  tired: ["luna-rest", "luna-wait"], sleepy: ["luna-rest", "luna-wait"],
  bored: ["luna-think", "luna-wait"], missing: ["luna-rest", "luna-wait"],
  reunion: ["luna-jump", "luna-wave", "luna-run-right"], determined: ["luna-review", "luna-think", "luna-run-right"],
  hyped: ["luna-jump", "luna-run-right", "luna-run-left"], weekend: ["luna-rest", "luna-wait"],
  rooting: ["luna-wait", "luna-think"], content: ["luna-wait", "luna-wave"],
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
