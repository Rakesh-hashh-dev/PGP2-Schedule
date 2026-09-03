// Regenerates src/data/schedule.js (the bundled fallback snapshot) from the
// live Apps Script feed, and records the outcome in src/data/snapshot-meta.json
// so the admin dashboard can show whether the last run passed or failed.
//
// Runs automatically before every `npm run build` (prebuild), or manually via
// `npm run snapshot`. A feed failure never breaks the build — the existing
// snapshot is kept and the meta file records the error.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");
const SNAPSHOT_PATH = path.join(DATA_DIR, "schedule.js");
const META_PATH = path.join(DATA_DIR, "snapshot-meta.json");

const FEED_URL =
  "https://script.google.com/macros/s/AKfycbwOCmpZAbzN7hRkb-xx6-SDejt3c45E5NBZ0NHuJW8CBRYO4ROJfwE_MI_g4aODwo08Gg/exec";

// Sanity floor — refuse to overwrite the snapshot with a suspiciously small feed
const MIN_CLASSES = 100;

// The feed doesn't carry the term number; normally inherited from the previous
// snapshot, this is the fallback if that ever fails. Update once per term.
const TERM_NUMBER_FALLBACK = "V";

function writeMeta(meta) {
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + "\n");
}

async function main() {
  // Preserve TERM.number from the existing snapshot (the feed doesn't carry it)
  let termNumber = "";
  try {
    const existing = fs.readFileSync(SNAPSHOT_PATH, "utf8");
    const m = existing.match(/"number"\s*:\s*"([^"]*)"|number:\s*'([^']*)'/);
    termNumber = (m && (m[1] || m[2])) || "";
  } catch {}
  if (!termNumber) termNumber = TERM_NUMBER_FALLBACK;

  const { AREA } = await import(
    "file://" + path.join(DATA_DIR, "areas.js").replace(/\\/g, "/")
  );

  const res = await fetch(FEED_URL, { redirect: "follow" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const feed = await res.json();
  if (feed?.error) throw new Error(feed.error);
  if (!Array.isArray(feed?.CLASSES) || feed.CLASSES.length < MIN_CLASSES) {
    throw new Error(
      `feed too small (${feed?.CLASSES?.length ?? 0} classes < ${MIN_CLASSES})`
    );
  }
  if (!feed?.LEGEND || Object.keys(feed.LEGEND).length === 0) {
    throw new Error("feed has no LEGEND");
  }

  const TERM = { start: feed.TERM.start, end: feed.TERM.end, number: termNumber };
  const LEGEND = {};
  for (const code of Object.keys(feed.LEGEND)) {
    LEGEND[code] = {
      name: feed.LEGEND[code].name,
      credits: feed.LEGEND[code].credits || "",
      area: AREA[code] || "Other",
    };
  }
  // Keep only timetable fields — CHANGES/buildTs must not be bundled.
  // STUDENTS is bundled (below) as an onboarding fallback: it is the one thing
  // the app cannot degrade without, since auto-allocation has no other source.
  const CLASSES = feed.CLASSES.map(
    ({ date, day, section, slot, start, end, type, code, session, name, faculty, room }) => ({
      date, day, section, slot, start, end, type, code, session, name, faculty,
      room: room || "",
    })
  );

  // Onboarding fallback. Keys are SHA-256 hashes of lowercased emails, so this
  // exposes nothing the (public, anonymous) feed does not already serve. The
  // live feed always takes priority; this only covers a feed outage.
  const STUDENTS =
    feed.STUDENTS && typeof feed.STUDENTS === "object" ? feed.STUDENTS : {};

  const out =
    "export const TERM=" + JSON.stringify(TERM) + ";\n" +
    "export const LEGEND=" + JSON.stringify(LEGEND) + ";\n" +
    "export const CLASSES=" + JSON.stringify(CLASSES) + ";\n" +
    "export const STUDENTS=" + JSON.stringify(STUDENTS) + ";\n";
  fs.writeFileSync(SNAPSHOT_PATH, out);

  writeMeta({
    status: "success",
    ts: new Date().toISOString(),
    classes: CLASSES.length,
    courses: Object.keys(LEGEND).length,
    students: Object.keys(STUDENTS).length,
    termStart: TERM.start,
    termEnd: TERM.end,
    feedBuildTs: feed.buildTs || null,
    error: null,
  });
  console.log(
    `[snapshot] OK — ${CLASSES.length} classes, ${Object.keys(LEGEND).length} courses, ` +
      `${Object.keys(STUDENTS).length} students, term ${TERM.start} → ${TERM.end}`
  );
}

main().catch((err) => {
  console.warn("[snapshot] FAILED — keeping existing snapshot:", err.message);
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(META_PATH, "utf8")); } catch {}
  writeMeta({
    ...prev,
    status: "failed",
    ts: new Date().toISOString(),
    error: err.message,
    // lastSuccessTs survives across failures so the admin panel can show
    // how old the snapshot actually is
    lastSuccessTs: prev.status === "success" ? prev.ts : prev.lastSuccessTs || null,
  });
  // Exit 0 on purpose: a dead feed must not block deploys — the old snapshot
  // is still valid as a fallback, and the meta indicator surfaces the failure.
  process.exit(0);
});
