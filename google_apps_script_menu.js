/**
 * Live mess-menu feed for the schedule website.
 * Reads the admin's mess menu Google Sheet PRIVATELY (as you) and serves
 * only the parsed per-day menu as JSON. Use this instead of the public
 * gviz-CSV route (src/lib/messFeed.js) when the sheet is NOT shared as
 * "Anyone with the link" — you just need your own Google account to have
 * at least Viewer access to it.
 *
 * SETUP (once):
 *   1. Ask the admin to share the sheet with YOUR Google account (Viewer
 *      is enough) if it isn't already — "shared by admin" alone isn't
 *      enough unless it was shared with the account you'll deploy as.
 *   2. Open script.google.com -> New project. Paste this file in.
 *   3. Set SHEET_ID below (the id from the sheet URL).
 *   4. Deploy -> New deployment -> type "Web app"
 *        Execute as: Me       Who has access: Anyone
 *      Authorize when prompted (this grants the script your sheet access,
 *      not the public). Copy the /exec URL.
 *   5. Paste that URL into FEED_URL in schedule-app/src/lib/messFeed.js.
 *   6. (Optional) Run installTrigger() once so the cache stays warm.
 */

const SHEET_ID = '1ymPxm136OrP1B-OAgVKghXawblk19FxQR_37_5Fu2ms';
const GID = 0; // tab to read (gid=0 in the sheet URL)
const CACHE_MINUTES = 10;

// ITEMS-column (col B, 0-based index 1) label -> JS Date#getDay().
// Columns C..I (0-based 2..8) = Mon..Sun.
const COL_TO_DAY = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 0 };

function doGet(e) {
  let json = getCache();
  if (!json) {
    try { json = refresh(); }
    catch (err) { json = JSON.stringify({ error: String(err) }); }
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/** Trigger entry point for installTrigger(). */
function buildAndCache() { refresh(); }

function refresh() {
  const menu = buildMenu();
  const payload = { menu: menu, buildTs: Date.now() };
  const json = JSON.stringify(payload);
  putCache(json);
  return json;
}

function buildMenu() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheets().filter(function (sh) { return sh.getSheetId() === GID; })[0] || ss.getSheets()[0];
  const rows = sheet.getDataRange().getDisplayValues();
  return parseMenu(rows);
}

/**
 * Mirrors the client-side parser previously in src/lib/messFeed.js:
 * sections are inferred from the ITEMS-column labels (col B) since the
 * sheet's merged section-header rows don't survive a flat row read either:
 *   MAIN/EXTRA = breakfast - first RICE after them = lunch
 *   - WEEK or TEA = snacks - first RICE after snacks = dinner
 */
function parseMenu(rows) {
  const days = {};
  Object.keys(COL_TO_DAY).forEach(function (c) {
    days[COL_TO_DAY[c]] = { breakfast: [], lunch: [], snacksW13: [], snacksW24: [], dinner: [] };
  });

  let section = 'breakfast';
  rows.forEach(function (row) {
    const label = clean(row[1]).toUpperCase();
    if (!label || label === 'ITEMS') return; // header / spacer rows

    if (label.indexOf('WEEK 1') > -1 || label.indexOf('WEEK 2') > -1 ||
        label.indexOf('TEA') > -1 || label.indexOf('COFFEE') > -1) {
      section = 'snacks';
    } else if (label === 'RICE') {
      section = section === 'snacks' ? 'dinner' : 'lunch';
    }

    for (let col = 2; col <= 8; col++) {
      const day = COL_TO_DAY[col];
      if (day === undefined) continue;
      const cell = clean(row[col]);
      if (!cell) continue;
      const b = days[day];

      if (section === 'breakfast') {
        if (label.indexOf('EXTRA') > -1) {
          cell.split('+').forEach(function (p) { p = p.trim(); if (p) b.breakfast.push(p); });
        } else {
          b.breakfast.push(cell);
        }
      } else if (section === 'lunch') {
        b.lunch.push(cell);
      } else if (section === 'snacks') {
        if (label.indexOf('WEEK 1') > -1 || label.indexOf('1&3') > -1) b.snacksW13.push(cell);
        else if (label.indexOf('WEEK 2') > -1 || label.indexOf('2&4') > -1) b.snacksW24.push(cell);
        else if (label.indexOf('TEA') > -1 || label.indexOf('COFFEE') > -1) {
          if (b.snacksW13.length) b.snacksW13.push(cell);
          if (b.snacksW24.length) b.snacksW24.push(cell);
        }
      } else if (section === 'dinner') {
        b.dinner.push(cell);
      }
    }
  });

  const out = {};
  Object.keys(days).forEach(function (d) {
    const m = days[d];
    if (m.breakfast.length || m.lunch.length || m.dinner.length || m.snacksW13.length) out[d] = m;
  });
  return out;
}

function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

/* ---------- cache ---------- */

function putCache(json) {
  try { CacheService.getScriptCache().put('mess_menu', json, CACHE_MINUTES * 60); } catch (e) {}
}
function getCache() {
  return CacheService.getScriptCache().get('mess_menu');
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('buildAndCache').timeBased().everyMinutes(Math.max(5, CACHE_MINUTES)).create();
}
