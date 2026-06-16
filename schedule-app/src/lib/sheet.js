import { TERM, LEGEND, CLASSES } from "../data/schedule.js";

// Paste the Apps Script Web App URL (ends in /exec). Until then, the app uses
// the bundled snapshot below.
const FEED_URL = "https://script.google.com/macros/s/AKfycbwOCmpZAbzN7hRkb-xx6-SDejt3c45E5NBZ0NHuJW8CBRYO4ROJfwE_MI_g4aODwo08Gg/exec";

const SNAPSHOT = { TERM, LEGEND, CLASSES, CHANGES: [] };

export async function fetchSchedule() {
  if (!FEED_URL || FEED_URL.startsWith("PASTE_")) return SNAPSHOT;
  try {
    const res = await fetch(FEED_URL, { redirect: "follow" }); // plain GET → no CORS preflight
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data && data.error) throw new Error(data.error);
    if (!data || !Array.isArray(data.CLASSES) || data.CLASSES.length === 0) throw new Error("empty feed");
    // Backfill area codes from snapshot when live feed omits them
    const legend = { ...data.LEGEND };
    for (const [code, meta] of Object.entries(legend)) {
      if (!meta.area && LEGEND[code]?.area) meta.area = LEGEND[code].area;
    }
    return { CHANGES: [], ...data, LEGEND: legend };
  } catch (err) {
    console.warn("[sheet] live feed failed, using snapshot:", err.message);
    return SNAPSHOT;
  }
}

export { SNAPSHOT };
