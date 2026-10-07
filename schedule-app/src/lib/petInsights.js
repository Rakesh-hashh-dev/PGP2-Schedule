import {
  BUDDY_DEVOTION, COATS, DEVOTION_STEP, DEVOTION_COMPANIONS, HATS,
  MAX_LEVEL, NECKWEAR, STARTER_KEYS, UNLOCKS, XP_SOURCES, devotionFor, levelFor,
  normalize, unlockedFor, xpOf, xpToReach,
} from "./pet.js";

const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const sourceName = Object.fromEntries(XP_SOURCES);
const labelFor = key => key.charAt(0).toUpperCase() + key.slice(1);

/** Upcoming reward gates, grouped so three rows show three distinct steps. */
export function unlockRoadmap(state, { wardrobe = true, hatsOff = [] } = {}) {
  const xp = xpOf(state);
  const level = levelFor(xp);
  const tier = devotionFor(xp).tier;
  const unlocked = new Set(unlockedFor(state));
  const gates = new Map();
  const add = (by, at, kind, label) => {
    if (!at || (by === "level" ? at <= level : at <= tier)) return;
    const id = `${by}:${at}`;
    if (!gates.has(id)) gates.set(id, { by, at, rewards: [] });
    gates.get(id).rewards.push({ kind, label });
  };

  for (const [at, key] of Object.entries(UNLOCKS)) {
    if (!unlocked.has(key)) add("level", Number(at), "companion", labelFor(key));
  }
  for (const [at, key] of DEVOTION_COMPANIONS) {
    if (!unlocked.has(key)) add("devotion", Number(at), "companion", labelFor(key));
  }
  if (wardrobe) {
    for (const [items, kind] of [[HATS, "hat"], [COATS, "coat"], [NECKWEAR, "collar"]]) {
      for (const item of items) {
        if (kind === "hat" && hatsOff.includes(item.key)) continue;
        add(item.devotion ? "devotion" : "level", item.devotion || item.level, kind, item.label);
      }
    }
  }
  add("devotion", BUDDY_DEVOTION, "slot", "Second companion slot");

  return [...gates.values()]
    .sort((a, b) => (a.by === b.by ? a.at - b.at : a.by === "level" ? -1 : 1))
    .slice(0, 3)
    .map(gate => ({
      ...gate,
      remainingXp: Math.max(0, (gate.by === "level"
        ? xpToReach(gate.at)
        : xpToReach(MAX_LEVEL) + gate.at * DEVOTION_STEP) - xp),
    }));
}

/** Monday through today, using the same local calendar days as pet awards. */
export function petWeek(state, now = new Date()) {
  const s = normalize(state);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const from = dayKey(start);
  const through = dayKey(now);
  const result = { from, through, xp: 0, classes: 0, deadlines: 0, care: 0, streak: 0 };
  for (const [key, [day, amount]] of Object.entries(s.awarded)) {
    if (day < from || day > through) continue;
    result.xp += amount;
    if (key.startsWith("att:")) result.classes++;
    else if (key.startsWith("due:")) result.deadlines++;
    else if (key.startsWith("care:")) result.care++;
    else if (key.startsWith("stk:")) result.streak++;
  }
  return result;
}

/** A dated view of retained awards. Pruned XP has no trustworthy event date. */
export function recentPetMoments(state, limit = 5, now = new Date()) {
  const s = normalize(state);
  const cutoff = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30));
  const through = dayKey(now);
  const days = new Map();
  let olderXp = 0;
  for (const [key, [day, amount]] of Object.entries(s.awarded)) {
    if (day < cutoff) { olderXp += amount; continue; }
    if (day > through) continue;
    if (!days.has(day)) days.set(day, { awards: {}, xp: {} });
    const prefix = key.split(":")[0];
    const group = days.get(day);
    group.awards[prefix] = (group.awards[prefix] || 0) + 1;
    group.xp[prefix] = (group.xp[prefix] || 0) + amount;
  }

  const moments = [];
  let cumulativeXp = s.baseXp + s.grantedXp + olderXp;
  for (const day of [...days.keys()].sort()) {
    const group = days.get(day);
    const beforeLevel = levelFor(cumulativeXp);
    const beforeTier = devotionFor(cumulativeXp).tier;
    cumulativeXp += Object.values(group.xp).reduce((sum, amount) => sum + amount, 0);
    const afterLevel = levelFor(cumulativeXp);
    const afterTier = devotionFor(cumulativeXp).tier;

    for (const [prefix, count] of Object.entries(group.awards)) {
      const label = sourceName[prefix];
      // Daily streak awards already have their own place in the weekly recap.
      if (!label || prefix === "stk") continue;
      moments.push({ day, kind: prefix, label, count, xp: group.xp[prefix] });
    }
    for (let level = beforeLevel + 1; level <= afterLevel; level++) {
      if (UNLOCKS[level]) moments.push({ day, kind: "unlock", label: `${labelFor(UNLOCKS[level])} unlocked`, count: 1, xp: 0 });
    }
    for (let tier = beforeTier + 1; tier <= afterTier; tier++) {
      for (const [at, key] of DEVOTION_COMPANIONS) {
        if (Number(at) === tier) moments.push({ day, kind: "unlock", label: `${labelFor(key)} unlocked`, count: 1, xp: 0 });
      }
    }
  }
  if (s.adoptedAt && s.adoptedAt >= cutoff && s.adoptedAt <= through) {
    moments.push({ day: s.adoptedAt, kind: "adopt", label: "Companion adopted", count: 1, xp: 0 });
  }
  return moments.sort((a, b) => b.day.localeCompare(a.day) || (a.kind === "unlock" ? -1 : b.kind === "unlock" ? 1 : a.label.localeCompare(b.label))).slice(0, limit);
}

/** Permanent milestones derived from level and collection size. */
export function petMilestones(state) {
  const xp = xpOf(state);
  const level = levelFor(xp);
  const companions = unlockedFor(state).length;
  const totalCompanions = STARTER_KEYS.length + Object.keys(UNLOCKS).length + DEVOTION_COMPANIONS.length;
  return [
    { key: "friend", label: "First friend", detail: "Adopt a companion", value: normalize(state).adoptedAt ? 1 : 0, target: 1, ready: true },
    { key: "level4", label: "Study partner", detail: "Reach level 4", value: level, target: 4, ready: true },
    { key: "collect8", label: "Growing circle", detail: "Unlock 8 companions", value: companions, target: 8, ready: level >= 4 },
    { key: "level8", label: "Steady progress", detail: "Reach level 8", value: level, target: 8, ready: level >= 4 },
    { key: "collectAll", label: "Full house", detail: "Unlock every companion", value: companions, target: totalCompanions, ready: companions >= 8 },
    { key: "level12", label: "Fully grown", detail: "Reach level 12", value: level, target: MAX_LEVEL, ready: level >= 8 },
  ].map(item => ({
    ...item,
    status: item.value >= item.target ? "completed" : item.ready ? "in-progress" : "locked",
    progress: Math.min(100, Math.round(item.value / item.target * 100)),
  }));
}
