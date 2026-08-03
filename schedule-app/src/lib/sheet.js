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

// These courses have only one combined section; rename stray "B" feed entries to "Single".
const SINGLE_SECTION_B = new Set(["AMR", "BAMD", "BBM"]);
function normalizeSingleSection(c) {
  if (c.type !== "class") return c;
  // Repair guest cells the feed regex failed on: a line break in the sheet cell
  // ("DVB-9\n(Guest Session)") makes the whole cell land in `code` with an
  // empty session, so the enrollment filter (keyed by code) drops them.
  // The section is kept as-is: section-wise guests belong to their section;
  // combined guests already arrive from the feed as "Single" (merged cell).
  if (!c.session && /guest/i.test(c.code || "")) {
    const m = c.code.replace(/\s+/g, " ").match(/^([A-Za-z]+)[\s-]*(.*)$/);
    if (m) c = { ...c, code: m[1], session: m[2].trim(), name: m[0] };
  }
  if (SINGLE_SECTION_B.has(c.code) && c.section === "B") {
    return { ...c, section: "Single" };
  }
  return c;
}

// The source sheet pads faculty cells with runs of whitespace (spreadsheet
// column alignment) — collapse to single spaces so it renders cleanly.
function cleanFaculty(f) {
  if (!f) return f;
  return f.replace(/\s+/g, " ").replace(/\s*&\s*/g, " & ").trim();
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
      faculty: cleanFaculty(c.faculty),
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
    // Re-normalize: cached payloads were processed by an older withAreas and
    // may predate fixes (e.g. the guest-session code repair).
    if (cached?.data) return withAreas(cached.data);
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

    let data;
    // Consume the eager fetch promise from index.html if it exists and matches this request
    if (!force && window.__schedulePromise) {
      data = await window.__schedulePromise;
      window.__schedulePromise = null; // Clear it so subsequent fetches hit the network
    } else {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      data = await res.json();
    }
    
    if (data?.error) throw new Error(data.error);
    if (data?.unchanged && cached?.data) {
      return { ...withAreas(cached.data), _meta: { status: "success", message: "No changes from live sheet (using cache)", ts: new Date().toISOString() } };
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
