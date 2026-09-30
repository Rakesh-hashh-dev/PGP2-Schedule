// Models the pet's XP economy against the term that is actually bundled.
//
//   npm run xp-model
//   npm run xp-model -- '{"att":40}'      try a change without editing pet.js
//
// Why this exists: the first set of earn rates was picked by feel, and feel was
// wrong by a factor of three. Modelled against this term's real schedule, a
// student who marked EVERY class, opened the app daily and cleared fourteen
// deadlines finished on 2607 XP — level 9 — while four companions sat behind
// levels 11-12 and devotion tiers. Nobody could have reached them. A term's
// worth of unreachable content, invisible to every test in the suite.
//
// The model is deliberately crude — it does not need to be exact, it needs to
// answer "can a real student get there before the term ends". It reads the
// bundled schedule for the term length and a median student's class count, then
// walks the term day by day paying out the same four sources the app does.
//
// Run it whenever the earn rates, the level curve, the devotion step or the
// term's shape change. `petEconomy.test.js` runs the same model and fails if the
// roster stops being reachable.

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { XP, CARE_DAILY_CAP, MAX_LEVEL, MAX_DEVOTION, DEVOTION_STEP, DEVOTION_UNLOCKS, xpToReach } from "../src/lib/pet.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseScheduleExport(source, name) {
  const match = new RegExp(
    `export\\s+const\\s+${name}\\s*=\\s*([\\s\\S]*?)\\s*;\\s*(?=export\\s+const\\s+\\w+\\s*=|$)`,
  ).exec(source);
  if (!match) throw new Error(`Could not read ${name} from src/data/schedule.js`);
  return JSON.parse(match[1]);
}

/** Term length and a median student's class dates, from the bundled schedule. */
export function termShape() {
  const src = readFileSync(resolve(root, "src/data/schedule.js"), "utf8");
  const CLASSES = parseScheduleExport(src, "CLASSES");
  const STUDENTS = parseScheduleExport(src, "STUDENTS");
  const TERM = parseScheduleExport(src, "TERM");

  const bySection = {};
  for (const c of CLASSES) {
    if (c.type !== "class") continue;
    (bySection[c.code + "|" + c.section] ||= []).push(c.date);
  }
  const loads = Object.values(STUDENTS).map(alloc => {
    const dates = [];
    for (const [code, sec] of Object.entries(alloc)) dates.push(...(bySection[code + "|" + sec] || []));
    return dates.sort();
  });
  loads.sort((a, b) => a.length - b.length);

  const start = new Date(TERM.start);
  const days = Math.round((new Date(TERM.end) - start) / 86_400_000) + 1;
  return { term: TERM, start, days, median: loads[Math.floor(loads.length / 2)] };
}

/**
 * Three students, deliberately not one. The engaged one is the target the rates
 * are tuned against; the other two are the guard rails — a perfect student must
 * not finish everything at half term, and a casual one must still get most of
 * the roster, because this feature is never allowed to feel like a punishment
 * (docs/pet-companion-plan.md §2).
 *
 * Every profile is deterministic: `opens` is a fraction of days spread evenly,
 * not a coin flip, so the same inputs always give the same answer.
 */
export const PROFILES = {
  perfect: { label: "marks every class, opens daily, 3 cares, 14 deadlines", marks: 1, opens: 1, cares: 3, deadlines: 14 },
  engaged: { label: "marks 85%, opens daily, 2.5 cares, 8 deadlines", marks: 0.85, opens: 1, cares: 2.5, deadlines: 8 },
  casual: { label: "marks 55%, opens 6 days in 10, 1.5 cares, 3 deadlines", marks: 0.55, opens: 0.6, cares: 1.5, deadlines: 3 },
};

export function model(profile, rates = {}) {
  const R = { att: XP.attendance, due: XP.deadline, stk: XP.streak, care: XP.care, dev: DEVOTION_STEP, ...rates };
  const { start, days, median } = termShape();
  const cap = xpToReach(MAX_LEVEL);
  const dueOn = new Set();
  for (let i = 1; i <= profile.deadlines; i++) dueOn.add(Math.round((days * i) / (profile.deadlines + 1)));

  let xp = 0;
  const timeline = [];
  for (let day = 0; day < days; day++) {
    const date = new Date(start.getTime() + day * 86_400_000).toISOString().slice(0, 10);
    xp += median.filter(d => d === date).length * R.att * profile.marks;
    // Evenly spread rather than random, so the model is reproducible.
    if (profile.opens === 1 || day % Math.round(1 / profile.opens) === 0) {
      xp += R.stk;
      // Past the level cap a care tap is worth more (see `devotionMultiplier`);
      // 1.25x is the middle of that range, which is what a real streak looks like.
      xp += R.care * Math.min(CARE_DAILY_CAP, profile.cares) * (xp >= cap ? 1.25 : 1);
    }
    if (dueOn.has(day + 1)) xp += R.due;
    timeline.push(Math.round(xp));
  }
  return { timeline, days, cap, rates: R };
}

/** Percentage of the term at which `need` XP is reached, or null. */
export function reachedAt(need, run) {
  const day = run.timeline.findIndex(xp => xp >= need);
  return day < 0 ? null : Math.round(((day + 1) / run.days) * 100);
}

/** Every companion behind a gate, with the XP it costs. */
export function milestones(run) {
  const rows = [
    ["Spark", "Lv 11", xpToReach(11)],
    ["Leafy", `Lv ${MAX_LEVEL}`, run.cap],
  ];
  for (const [tier, key] of Object.entries(DEVOTION_UNLOCKS)) {
    rows.push([key[0].toUpperCase() + key.slice(1), `Dv ${tier}`, run.cap + Number(tier) * run.rates.dev]);
  }
  rows.push(["wardrobe done", `Dv ${MAX_DEVOTION}`, run.cap + MAX_DEVOTION * run.rates.dev]);
  return rows.sort((a, b) => a[2] - b[2]);
}

function main() {
  const rates = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const { term, days, median } = termShape();
  console.log(`term ${term.start} → ${term.end} · ${days} days · median student ${median.length} classes`);
  console.log(`rates: ${JSON.stringify({ ...XP, devotionStep: DEVOTION_STEP, ...rates })}\n`);

  for (const [name, profile] of Object.entries(PROFILES)) {
    const run = model(profile, rates);
    console.log(`${name} — ${profile.label}`);
    console.log(`  ends the term on ${run.timeline[run.timeline.length - 1]} XP`);
    for (const [label, gate, need] of milestones(run)) {
      const pct = reachedAt(need, run);
      console.log(`  ${label.padEnd(14)} ${gate.padEnd(6)} ${String(need).padStart(5)} XP → ${pct === null ? "never" : `${pct}% of term`}`);
    }
    console.log();
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) main();
