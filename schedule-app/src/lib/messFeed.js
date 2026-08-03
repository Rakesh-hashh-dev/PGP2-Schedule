// Live mess-menu feed — reads the admin's mess sheet directly via Google's
// built-in CSV endpoint (no Apps Script, no deploy). Returns the per-day
// overrides object the app merges over the bundled BASE_MENU (data/messMenu.js).
// On any failure the app just keeps BASE_MENU. Mess-menu only — the class
// schedule has its own separate feed in lib/sheet.js.
//
// Requires the sheet to stay "Anyone with the link → Viewer".

const SHEET_ID = "1org54D-zyRu-fNE5RpTFVVReeRHQi_wr3Hx0uFTkrXk";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
const CACHE_KEY = "pgp2-mess-feed-cache";

// ITEMS-column (col B) label -> JS Date#getDay(). Columns C..I = Mon..Sun.
const COL_TO_DAY = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 0 };

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
}

// Minimal RFC-4180 CSV parser: handles quoted fields, "" escapes, and newlines
// inside quotes. Returns an array of string rows (arrays of cells).
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();

// FNV-1a hash of the raw CSV — detects any content change in the live sheet
// (a length check would miss same-length edits).
function hashText(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

// Turns the CSV grid into { [weekday]: { breakfast, lunch, snacksW13,
// snacksW24, dinner } }. Google's CSV export strips the merged section-header
// rows, so sections are inferred from the ITEMS-column labels (col B):
//   MAIN/EXTRA = breakfast · first RICE after them = lunch · WEEK*/TEA = snacks
//   · first RICE after snacks = dinner. This mirrors the sheet's fixed layout.
function parseMenu(rows) {
  const days = {};
  for (const c in COL_TO_DAY) {
    days[COL_TO_DAY[c]] = { breakfast: [], lunch: [], snacksW13: [], snacksW24: [], dinner: [] };
  }

  let section = "breakfast";
  for (const row of rows) {
    const label = clean(row[1]).toUpperCase();
    if (!label || label === "ITEMS") continue; // header / spacer rows

    if (label.includes("WEEK 1") || label.includes("WEEK 2") ||
        label.includes("TEA") || label.includes("COFFEE")) {
      section = "snacks";
    } else if (label === "RICE") {
      section = section === "snacks" ? "dinner" : "lunch";
    }

    for (let col = 2; col <= 8; col++) {
      const day = COL_TO_DAY[col];
      if (day === undefined) continue;
      const cell = clean(row[col]);
      if (!cell) continue;
      const b = days[day];

      if (section === "breakfast") {
        if (label.includes("EXTRA")) cell.split("+").forEach(p => { p = p.trim(); if (p) b.breakfast.push(p); });
        else b.breakfast.push(cell);
      } else if (section === "lunch") {
        b.lunch.push(cell);
      } else if (section === "snacks") {
        if (label.includes("WEEK 1") || label.includes("1&3")) b.snacksW13.push(cell);
        else if (label.includes("WEEK 2") || label.includes("2&4")) b.snacksW24.push(cell);
        else if (label.includes("TEA") || label.includes("COFFEE")) {
          if (b.snacksW13.length) b.snacksW13.push(cell);
          if (b.snacksW24.length) b.snacksW24.push(cell);
        }
      } else if (section === "dinner") {
        b.dinner.push(cell);
      }
    }
  }

  const out = {};
  for (const d of Object.keys(days)) {
    const m = days[d];
    if (m.breakfast.length || m.lunch.length || m.dinner.length || m.snacksW13.length) out[d] = m;
  }
  return out;
}

// Returns the live overrides object, or null if the sheet is unreachable
// (caller keeps the bundled menu). Serves cached data instantly when unchanged.
export async function fetchMessMenu() {
  const cached = readCache();
  try {
    const res = await fetch(CSV_URL, { redirect: "follow" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const csv = await res.text();

    // Change-detection: skip re-parse when the live sheet is byte-identical.
    const rev = hashText(csv);
    if (cached?.rev === rev && cached?.menu) return cached.menu;

    const menu = parseMenu(parseCsv(csv));
    if (!Object.keys(menu).length) throw new Error("empty menu");

    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rev, menu })); } catch {}
    return menu;
  } catch (err) {
    console.warn("[messFeed] live sheet fetch failed, using bundled menu:", err.message);
    return cached?.menu || null;
  }
}
