import { AREA } from "../data/areas.js";
import { normalizeScheduleBreak } from "./scheduleBreaks.js";
// Eager import — snapshot is bundled, no network round-trip needed for fallback
import { TERM, LEGEND, CLASSES, STUDENTS } from "../data/schedule.js";

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

// Term V courses whose source feed sometimes emits stray A/B rows. Repair
// them only while the current roster allocates every enrolled student Single.
// Recheck this term-specific list on rollover. Exact combined duplicates are
// removed after normalization; distinct sessions and A/B courses stay separate.
const SINGLE_SECTION_CODES = new Set(["CRM", "SCA", "AOA"]);
function normalizeSingleSection(c, combinedCodes) {
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
  if (combinedCodes.has(c.code) && (c.section === "A" || c.section === "B")) {
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

// The sheet's room column is sometimes used for the guest speaker or their
// company instead of a venue ("Zoho", "Mr. Procyon Mukherjee"), which then
// renders as the room. Two tells, both precise enough to leave real rooms
// alone: a personal title, or a value that already appears in the session /
// class name — a genuine room number never does.
export function cleanRoom(c) {
  const room = (c.room || "").trim();
  if (!room) return "";
  if (/^(mr|mrs|ms|dr|prof)\.?\s/i.test(room)) return "";
  const context = `${c.session || ""} ${c.name || ""}`.toLowerCase();
  if (context.includes(room.toLowerCase())) return "";
  return room;
}

// A feed "class" whose code isn't a real course (not in the legend) isn't a
// class — the sheet has full-day festival/event banners (NUAKHAI, Dussehra,
// Foundation Day, …) and the occasional stray token in a slot. Multi-letter
// cells become holidays (so they render as non-teaching blocks); 1–2 char
// stray tokens (e.g. a leftover "B") are dropped. Real courses are always in
// the legend, so this never touches a genuine class.
function reclassifyUnknown(c, legend) {
  if (c.type !== "class" || !c.code || legend[c.code]) return c;
  const label = String(c.name || c.code).replace(/\s+/g, " ").trim();
  if (label.replace(/[^A-Za-z]/g, "").length >= 3) {
    return { ...c, type: "holiday", code: "", session: "", name: label };
  }
  return null; // stray noise → drop
}

function withAreas(data) {
  const legend = {};
  for (const code in data.LEGEND) {
    legend[code] = { ...data.LEGEND[code], area: AREA[code] || "Other" };
  }
  const rawClasses = data.CLASSES || [];
  const legendMap = data.LEGEND || {};
  // Normalize only courses whose current roster confirms one combined section.
  const allocations = Object.values(data.STUDENTS || STUDENTS);
  const combinedCodes = new Set([...SINGLE_SECTION_CODES].filter(code => {
    const sections = allocations.map(student => student[code]).filter(Boolean);
    return sections.length > 0 && sections.every(section => section === "Single");
  }));
  const seenCombined = new Set();
  const classes = [];
  for (let i = 0; i < rawClasses.length; i++) {
    let c = rawClasses[i];
    if (!c) continue;
    c = normalizeSingleSection(normalizeScheduleBreak(c), combinedCodes);
    if (!c) continue;
    c = reclassifyUnknown(c, legendMap);
    if (!c) continue;
    // The feed can repeat a combined event once as A/B and once as Single.
    // Compare every field after normalization so distinct sessions stay intact.
    if (c.type === "class" && combinedCodes.has(c.code)) {
      const key = JSON.stringify(Object.keys(c).sort().map(field => [field, c[field]]));
      if (seenCombined.has(key)) continue;
      seenCombined.add(key);
    }
    classes.push({
      ...c,
      area: c.code ? (AREA[c.code] || "Other") : "",
      faculty: cleanFaculty(c.faculty),
      room: cleanRoom(c),
    });
  }
  // Preserve static fields (like number) that the live feed may omit
  const term = data.TERM ? { number: TERM.number, ...data.TERM } : data.TERM;
  return { ...data, TERM: term, LEGEND: legend, CLASSES: classes };
}

// `_source` marks how fresh a payload is. Onboarding's auto-allocation needs it:
// a student missing from a stale bundled STUDENTS map must not be written off as
// "no allocation" — it has to wait for the live feed before giving up. Anything
// restored from the cache came from a live fetch, so it keeps its own marker.
const STATIC_SNAPSHOT = withAreas({ TERM, LEGEND, CLASSES, STUDENTS, CHANGES: [], _source: "snapshot" });

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

  let step = "Read browser cache";
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    let url = FEED_URL;
    if (force) {
      url += "?force=admin_force_123";
    } else if (cached?.data?.buildTs) {
      url += `?since=${cached.data.buildTs}`;
    }

    let data;
    step = "Request schedule feed";
    // Consume the eager fetch promise from index.html if it exists and matches this request
    if (!force && window.__schedulePromise) {
      data = await window.__schedulePromise;
      window.__schedulePromise = null; // Clear it so subsequent fetches hit the network
      if (data == null) throw new Error("Preloaded feed request failed");
    } else {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      step = "Read feed JSON";
      data = await res.json();
    }
    
    step = "Check feed response";
    if (data?.error) throw new Error(data.error);
    if (data?.unchanged && cached?.data) {
      // The server just confirmed the cache is current, so this counts as live
      // even if the cached payload predates _source being written.
      step = "Process cached schedule";
      return { ...withAreas(cached.data), _source: "live", _meta: { status: "success", source: "Google Apps Script schedule feed", step: "Feed unchanged", message: "No changes from live sheet (using cache)", ts: new Date().toISOString() } };
    }

    if (!data?.CLASSES?.length) throw new Error("empty feed");

    step = "Process schedule in app";
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

    // STUDENTS ahead of the spread so the live map wins when present and the
    // bundled one only fills a gap; _source after it so the feed can't spoof it.
    const result = withAreas({ CHANGES: [], STUDENTS, ...data, CLASSES: classes, _source: "live" });
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result })); } catch {}
    result._meta = { status: "success", source: "Google Apps Script schedule feed", step: "Feed updated", message: `Successfully fetched ${classes.length} classes from live sheet.`, ts: new Date().toISOString() };
    return result;
  } catch (err) {
    console.warn("[sheet] live feed failed, using snapshot:", err.message);
    const source = step === "Read browser cache" ? "Browser cache" : step === "Process schedule in app" || step === "Process cached schedule" ? "App schedule processing" : "Google Apps Script schedule feed";
    return { ...STATIC_SNAPSHOT, _meta: { status: "error", source, step, message: err.message, ts: new Date().toISOString() } };
  }
}
