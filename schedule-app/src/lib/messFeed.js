// Live mess-menu feed — reads the admin's mess sheet via a private Apps
// Script deployment (google_apps_script_menu.js at the repo root), which
// reads the sheet as whoever deployed it rather than requiring public link
// access. Returns the per-day overrides object the app merges over the
// bundled BASE_MENU (data/messMenu.js). On any failure the app just keeps
// BASE_MENU. Mess-menu only — the class schedule has its own separate feed
// in lib/sheet.js.
//
// Set FEED_URL to the /exec URL from deploying google_apps_script_menu.js
// (see setup steps in that file's header comment).

export const MESS_MENU_FEED_URL = "https://script.google.com/macros/s/AKfycbylRyf5UlCtwS2dfrxIOS8S6huCmuy1QderIhWfQL5i3O_NvMfSeOEGL2zKxBFbBYCIpQ/exec";
const CACHE_KEY = "pgp2-mess-feed-cache";

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
}

function formatDish(str) {
  if (!str) return "";
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/(^|[\s+/&(-])([a-z])/g, (_, b, l) => b + l.toUpperCase())
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s*\/\s*/g, " / ");
}

function normalizeMenu(rawMenu) {
  if (!rawMenu || typeof rawMenu !== "object") return null;
  const out = {};
  for (const day in rawMenu) {
    const meals = rawMenu[day];
    if (!meals || typeof meals !== "object") continue;
    out[day] = {};
    for (const meal in meals) {
      out[day][meal] = Array.isArray(meals[meal])
        ? meals[meal].map(formatDish).filter(Boolean)
        : meals[meal];
    }
  }
  return out;
}

// Returns the live overrides object, or null if the feed is unreachable
// (caller keeps the bundled menu). Serves cached data instantly when unchanged.
export async function fetchMessMenu() {
  if (!MESS_MENU_FEED_URL || MESS_MENU_FEED_URL.startsWith("PASTE_")) return null;

  const cached = readCache();
  try {
    const res = await fetch(MESS_MENU_FEED_URL, { redirect: "follow" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data?.error) throw new Error(data.error);

    const rawMenu = data?.menu;
    if (!rawMenu || !Object.keys(rawMenu).length) throw new Error("empty menu");
    const menu = normalizeMenu(rawMenu);

    // Change-detection: skip storing/re-render when nothing actually changed.
    if (cached?.buildTs === data.buildTs && cached?.menu) return cached.menu;

    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), buildTs: data.buildTs, menu })); } catch {}
    return menu;
  } catch (err) {
    console.warn("[messFeed] live feed failed, using bundled menu:", err.message);
    return cached?.menu || null;
  }
}
