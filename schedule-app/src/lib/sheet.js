import { AREA } from "../data/areas.js";

const FEED_URL = "https://script.google.com/macros/s/AKfycbwOCmpZAbzN7hRkb-xx6-SDejt3c45E5NBZ0NHuJW8CBRYO4ROJfwE_MI_g4aODwo08Gg/exec";

const CACHE_KEY = "pgp2-feed-cache";
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Lazy snapshot: loaded only when the live feed fails or rooms need backfill
let snapshotCache = null;
async function getSnapshot() {
  if (!snapshotCache) {
    const { TERM, LEGEND, CLASSES } = await import("../data/schedule.js");
    snapshotCache = { TERM, LEGEND, CLASSES, CHANGES: [] };
  }
  return snapshotCache;
}

function withAreas(data) {
  const legend = {};
  for (const code in data.LEGEND) {
    legend[code] = { ...data.LEGEND[code], area: AREA[code] || "Other" };
  }
  const classes = (data.CLASSES || []).map((c) => ({
    ...c,
    area: c.code ? (AREA[c.code] || "Other") : "",
  }));
  return { ...data, LEGEND: legend, CLASSES: classes };
}

export async function fetchSchedule() {
  // Serve from sessionStorage cache if fresh enough
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  } catch {}

  if (!FEED_URL || FEED_URL.startsWith("PASTE_")) {
    return withAreas(await getSnapshot());
  }

  try {
    const res = await fetch(FEED_URL, { redirect: "follow" }); // plain GET → no CORS preflight
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data && data.error) throw new Error(data.error);
    if (!data || !Array.isArray(data.CLASSES) || data.CLASSES.length === 0) throw new Error("empty feed");

    // Backfill room from snapshot only when the live feed omits it
    const needsBackfill = data.CLASSES.some((c) => !c.room);
    let classes = data.CLASSES;
    if (needsBackfill) {
      const snap = await getSnapshot();
      const snapIdx = new Map();
      for (const c of snap.CLASSES) {
        if (c.room) snapIdx.set(`${c.date}|${c.code}|${c.section}|${c.slot}`, c.room);
      }
      classes = data.CLASSES.map((c) => {
        if (c.room) return c;
        const room = snapIdx.get(`${c.date}|${c.code}|${c.section}|${c.slot}`);
        return room ? { ...c, room } : c;
      });
    }

    const result = withAreas({ CHANGES: [], ...data, CLASSES: classes });
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result })); } catch {}
    return result;
  } catch (err) {
    console.warn("[sheet] live feed failed, using snapshot:", err.message);
    return withAreas(await getSnapshot());
  }
}
