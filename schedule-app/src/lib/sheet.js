import { AREA } from "../data/areas.js";
// Eager import — snapshot is bundled, no network round-trip needed for fallback
import { TERM, LEGEND, CLASSES } from "../data/schedule.js";

const FEED_URL = "https://script.google.com/macros/s/AKfycbwOCmpZAbzN7hRkb-xx6-SDejt3c45E5NBZ0NHuJW8CBRYO4ROJfwE_MI_g4aODwo08Gg/exec";

// SHA-256 hash of a string, returns lowercase hex (matches Code.gs)
export async function sha256hex(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const CACHE_KEY = "pgp2-feed-cache";
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// These courses have only one combined section; rename stray "B" feed entries to "Single".
const SINGLE_SECTION_B = new Set(["AMR", "BAMD", "BBM"]);
function normalizeSingleSection(c) {
  if (c.type !== "class") return c;
  if (SINGLE_SECTION_B.has(c.code) && c.section === "B") {
    return { ...c, section: "Single" };
  }
  return c;
}

function withAreas(data) {
  const legend = {};
  for (const code in data.LEGEND) {
    legend[code] = { ...data.LEGEND[code], area: AREA[code] || "Other" };
  }
  const classes = (data.CLASSES || [])
    .map(normalizeSingleSection)
    .filter(Boolean)
    .map((c) => ({
      ...c,
      area: c.code ? (AREA[c.code] || "Other") : "",
    }));
  // Preserve static fields (like number) that the live feed may omit
  const term = data.TERM ? { number: TERM.number, ...data.TERM } : data.TERM;
  return { ...data, TERM: term, LEGEND: legend, CLASSES: classes };
}

const STATIC_SNAPSHOT = withAreas({ TERM, LEGEND, CLASSES, CHANGES: [] });

// Synchronous — returns localStorage cache if present, otherwise the static snapshot.
// Called before any async work so the UI renders immediately.
export function getSnapshot() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached?.data) return cached.data;
  } catch {}
  return STATIC_SNAPSHOT;
}

// Async — always hits the live feed and updates localStorage.
// Used for background refresh; falls back to snapshot on error.
export async function fetchSchedule(force = false) {
  if (!FEED_URL || FEED_URL.startsWith("PASTE_")) return STATIC_SNAPSHOT;

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    let url = FEED_URL;
    if (force) {
      url += "?force=admin_force_123";
    } else if (cached?.data?.buildTs) {
      url += `?since=${cached.data.buildTs}`;
    }

    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data?.error) throw new Error(data.error);
    if (data?.unchanged && cached?.data) {
      return { ...cached.data, _meta: { status: "success", message: "No changes from live sheet (using cache)", ts: new Date().toISOString() } };
    }

    if (!data?.CLASSES?.length) throw new Error("empty feed");

    // Backfill room from snapshot when the live feed omits it
    let classes = data.CLASSES;
    if (classes.some((c) => !c.room)) {
      const snapIdx = new Map();
      for (const c of STATIC_SNAPSHOT.CLASSES) {
        if (c.room) snapIdx.set(`${c.date}|${c.code}|${c.section}|${c.slot}`, c.room);
      }
      classes = data.CLASSES.map((c) => {
        if (c.room) return c;
        const room = snapIdx.get(`${c.date}|${c.code}|${c.section}|${c.slot}`);
        return room ? { ...c, room } : c;
      });
    }

    const result = withAreas({ CHANGES: [], ...data, CLASSES: classes });
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result })); } catch {}
    result._meta = { status: "success", message: `Successfully fetched ${classes.length} classes from live sheet.`, ts: new Date().toISOString() };
    return result;
  } catch (err) {
    console.warn("[sheet] live feed failed, using snapshot:", err.message);
    return { ...STATIC_SNAPSHOT, _meta: { status: "error", message: err.message, ts: new Date().toISOString() } };
  }
}
