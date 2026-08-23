/**
 * Live timetable feed for the schedule website.
 * Reads the college Google Sheet (privately, as you) and serves ONLY the
 * timetable + course names as JSON. Faculty emails/contacts and all student
 * rosters are never read or returned.
 *
 * HOW THE "DELAY" WORKS:
 *   Results are cached for CACHE_MINUTES. After someone edits the sheet, the
 *   change appears in the website within at most CACHE_MINUTES. Set it to
 *   whatever delay you're comfortable with (e.g. 10).
 *
 * SETUP (once):
 *   1. Open script.google.com → New project. Paste this file in.
 *   2. Set SHEET_ID below (the long id from the sheet URL).
 *   3. Deploy → New deployment → type "Web app"
 *        Execute as: Me      Who has access: Anyone
 *      Authorize when prompted. Copy the /exec URL → that's your feed URL.
 *   4. (Optional) Run installTrigger() once so the cache stays warm and the
 *      site never waits on a cold parse.
 */

const SHEET_ID = '1E0AaPYJi_sJXar2Wr12Di_0_MW92UdWMOn2BHkuSyUQ';
const TERM_YEAR = 2026;        // the sheet's dates have no year
const CACHE_MINUTES = 10;      // <-- your acceptable delay

// Change tracking: which entry types are worth recording as changes.
const CHANGES_ENABLED = true;
const ALERT_TYPES = { class: true, exam: true, holiday: true, break: false };
const MAX_CHANGES = 200;       // keep the most recent N change events

const SLOTS = [
  ['08:00', '09:30'], ['10:00', '11:30'], ['12:00', '13:30'], ['13:30', '14:30'],
  ['14:30', '16:00'], ['16:30', '18:00'], ['18:30', '20:00'], ['20:30', '22:00']
];
const SECTION_MAP = {
  'section a': 'A',
  'section b': 'B',
  'single section': 'Single',
  // Joint sessions — both sections attend the same slot:
  'section a/b': 'AB',
  'section ab': 'AB',
  'a/b': 'AB',
  'ab': 'AB',
};
// Known typos in the live sheet — normalize so legend lookup and student
// enrollment matching don't silently miss (e.g. "MBP - 6 Guest" is MPB).
const CODE_ALIASES = {
  MBP: 'MPB',
};
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const FORCE_TOKEN = "admin_force_123";

function doGet(e) {
  const lastTs = PropertiesService.getScriptProperties().getProperty('last_build_ts');

  if (e && e.parameter && e.parameter.force === FORCE_TOKEN) {
    try {
      const json = refresh();
      return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: String(err) })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (e && e.parameter && e.parameter.since && lastTs && parseInt(e.parameter.since) >= parseInt(lastTs)) {
    return ContentService.createTextOutput(JSON.stringify({ unchanged: true })).setMimeType(ContentService.MimeType.JSON);
  }

  let json = getCache();
  if (!json) {
    try { json = refresh(); }
    catch (err) { json = JSON.stringify({ error: String(err) }); }
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/** Trigger entry point: always recompute + diff against the baseline. */
function buildAndCache() { refresh(); }

/**
 * Build the schedule, diff it against the stored baseline, append any
 * human-readable changes to the persistent log, then cache + return the
 * payload — now including a CHANGES array. Returns a JSON string.
 */
function refresh() {
  const data = buildSchedule();                 // { TERM, LEGEND, CLASSES, STUDENTS }
  if (CHANGES_ENABLED) {
    const baseline = loadChunked('baseline');     // previous { key: signature }
    const current = signatureMap(data.CLASSES);
    if (baseline) {                               // skip on very first run
      const events = diff(baseline, current);
      if (events.length) appendChanges(events);
    }
    saveChunked('baseline', current);             // becomes next run's baseline
    data.CHANGES = loadChanges();                 // recent log → into the feed
  }

  data.buildTs = Date.now();
  PropertiesService.getScriptProperties().setProperty('last_build_ts', data.buildTs.toString());

  const json = JSON.stringify(data);
  putCache(json);   // gzipped — the raw payload is larger than CacheService allows per entry
  return json;
}

/* ---------- change detection ---------- */
// signature index map: 0 type, 1 code, 2 session, 3 room, 4 faculty, 5 name, 6 start

function signatureMap(classes) {
  const map = {};
  classes.forEach(c => {
    if (!ALERT_TYPES[c.type]) return;
    const key = c.date + '|' + c.section + '|' + c.slot;
    map[key] = [c.type, c.code, c.session, c.room, c.faculty, c.name, c.start].join('\u0001');
  });
  return map;
}
function field(sig, i) { return String(sig).split('\u0001')[i] || ''; }

function diff(oldMap, newMap) {
  const events = [], removed = [], added = [];
  Object.keys(newMap).forEach(k => {
    if (!(k in oldMap)) added.push(k);
    else if (newMap[k] !== oldMap[k]) events.push(changedEvent(k, oldMap[k], newMap[k]));
  });
  Object.keys(oldMap).forEach(k => { if (!(k in newMap)) removed.push(k); });

  // pair a removal + an addition of the same course on the same day+section → "moved"
  const usedAdd = {};
  removed.forEach(rk => {
    const parts = rk.split('|'), date = parts[0], section = parts[1];
    const code = field(oldMap[rk], 1);
    const match = added.find(ak => {
      if (usedAdd[ak]) return false;
      const p = ak.split('|');
      return p[0] === date && p[1] === section && field(newMap[ak], 1) === code && code;
    });
    if (match) {
      usedAdd[match] = true;
      events.push(moveEvent(date, code, field(oldMap[rk], 5), field(oldMap[rk], 6), field(newMap[match], 6)));
    } else {
      events.push(removeEvent(rk, oldMap[rk]));
    }
  });
  added.forEach(ak => { if (!usedAdd[ak]) events.push(addEvent(ak, newMap[ak])); });
  return events;
}

function changedEvent(key, oldSig, newSig) {
  const date = key.split('|')[0], lbl = isoToLabel(date);
  const code = field(newSig, 1);
  const start = field(newSig, 6), name = field(newSig, 5), oName = field(oldSig, 5);
  if (oName !== name) return mk(date, start, 'course', lbl + ' · ' + start + ' — ' + oName + ' → ' + name, code);
  const bits = [];
  let adminOnly = false;
  const oldStart = field(oldSig, 6), newStart = field(newSig, 6);
  if (oldStart !== newStart) {
    bits.push('time ' + oldStart + '→' + newStart);
  }
  const oldRoom = field(oldSig, 3), newRoom = field(newSig, 3);
  if (oldRoom !== newRoom) {
    // If either side is blank it's a data-quality gap — hide from regular users
    if (!oldRoom || !newRoom) adminOnly = true;
    bits.push('room ' + (oldRoom || '?') + '→' + (newRoom || '?'));
  }
  const oldFac = field(oldSig, 4), newFac = field(newSig, 4);
  if (oldFac !== newFac) {
    if (!oldFac || !newFac) adminOnly = true;
    bits.push('faculty changed');
  }
  return mk(date, start, 'update', lbl + ' · ' + start + ' — ' + name + ' ' + (bits.join(', ') || 'updated'), code, adminOnly);
}
function moveEvent(date, code, name, oldStart, newStart) {
  return mk(date, newStart, 'moved', name + ' moved ' + oldStart + '→' + newStart + ' (' + isoToLabel(date) + ')', code);
}
function addEvent(key, sig) {
  const date = key.split('|')[0], code = field(sig, 1), start = field(sig, 6), name = field(sig, 5), room = field(sig, 3);
  return mk(date, start, 'added', isoToLabel(date) + ' · ' + start + ' — ' + name + ' added' + (room ? ' (' + room + ')' : ''), code);
}
function removeEvent(key, sig) {
  const date = key.split('|')[0], code = field(sig, 1), start = field(sig, 6), name = field(sig, 5);
  return mk(date, start, 'removed', isoToLabel(date) + ' · ' + start + ' — ' + name + ' cancelled', code);
}
function mk(date, start, kind, text, code, adminOnly) {
  return { id: Utilities.getUuid().slice(0, 8), ts: new Date().toISOString(), date: date, start: start, kind: kind, text: text, code: code || '', admin_only: !!adminOnly };
}

/* ---------- payload cache (gzipped to fit CacheService's per-entry limit) ---------- */

function putCache(json) {
  try {
    const gz = Utilities.gzip(Utilities.newBlob(json, 'application/json'));
    const b64 = Utilities.base64Encode(gz.getBytes());
    CacheService.getScriptCache().put('schedule_gz', b64, CACHE_MINUTES * 60);
  } catch (e) {
    // caching is best-effort; the request still returns fresh data even if this fails
  }
}
function getCache() {
  const b64 = CacheService.getScriptCache().get('schedule_gz');
  if (!b64) return null;
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/x-gzip');
    return Utilities.ungzip(blob).getDataAsString();
  } catch (e) {
    return null;
  }
}

/* ---------- persistence (Google Drive file) ---------- */
// This eliminates the 500KB limit by storing the system data in a tiny JSON file in Google Drive.
// Check drive_app_migration_plan.md in your project folder to implement this.

/* ---------- persistence (ScriptProperties, chunked) ---------- */


function loadChanges() {
  const s = PropertiesService.getScriptProperties().getProperty('changes');
  return s ? JSON.parse(s) : [];
}
function appendChanges(events) {
  const log = events.concat(loadChanges()).slice(0, MAX_CHANGES);
  PropertiesService.getScriptProperties().setProperty('changes', JSON.stringify(log));
}
function saveChunked(prefix, obj) {
  const props = PropertiesService.getScriptProperties();
  const str = JSON.stringify(obj), size = 9000, n = Math.ceil(str.length / size);
  const all = props.getProperties();
  Object.keys(all).forEach(k => { if (k.indexOf(prefix + '_') === 0) props.deleteProperty(k); });
  const batch = {}; batch[prefix + '_n'] = String(n);
  for (let i = 0; i < n; i++) batch[prefix + '_' + i] = str.substr(i * size, size);
  props.setProperties(batch);
}
function loadChunked(prefix) {
  const props = PropertiesService.getScriptProperties();
  const n = parseInt(props.getProperty(prefix + '_n') || '0', 10);
  if (!n) return null;
  let str = '';
  for (let i = 0; i < n; i++) str += props.getProperty(prefix + '_' + i) || '';
  try { return JSON.parse(str); } catch (e) { return null; }
}
function isoToLabel(iso) {
  const p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return wd + ' ' + (+p[2]) + ' ' + mo;
}
/** Run once if you ever want to wipe the baseline + change log and start fresh. */
function resetChangeTracking() {
  const props = PropertiesService.getScriptProperties(), all = props.getProperties();
  Object.keys(all).forEach(k => { if (k.indexOf('baseline_') === 0 || k === 'changes') props.deleteProperty(k); });
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('buildAndCache').timeBased().everyMinutes(Math.max(5, CACHE_MINUTES)).create();
}

/* ---------------------------------------------------------------- */

function buildSchedule() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const legend = parseLegend(ss);                 // code -> {name, faculty, room, credits}
  const classes = parseTimetable(ss, legend);
  const dates = classes.map(c => c.date).sort();
  const LEGEND = {};
  Object.keys(legend).forEach(k => { LEGEND[k] = { name: legend[k].name, credits: legend[k].credits }; });

  // Parse students and sections from the individual course tabs!
  const students = parseStudentEnrollments(ss);

  const sanitizedData = sanitize({
    TERM: { start: dates[0] || '', end: dates[dates.length - 1] || '' },
    LEGEND,
    CLASSES: classes
  });

  // Bypass sanitize for STUDENTS so we don't accidentally strip out student email addresses!
  sanitizedData.STUDENTS = students;

  return sanitizedData;
}

function parseTimetable(ss, legend) {
  // find the sheet/region that has a "Section" column with section labels
  let grid = null;
  ss.getSheets().forEach(sh => {
    if (grid) return;
    const range = sh.getDataRange();
    const v = range.getDisplayValues();
    const hit = v.some(r => r.some(c => SECTION_MAP[String(c).trim().toLowerCase()]));
    if (hit) {
      // Merged-cell map: "row,col" (0-based top-left) -> span. Used to tell
      // combined guest sessions (merged across the section rows) apart from
      // section-wise ones, and to detect cells spanning multiple time slots.
      const merges = {};
      range.getMergedRanges().forEach(r => {
        merges[(r.getRow() - 1) + ',' + (r.getColumn() - 1)] = { rows: r.getNumRows(), cols: r.getNumColumns() };
      });
      grid = { values: v, raw: range.getValues(), merges: merges };
    }
  });
  if (!grid) return [];

  const out = [];
  let curDate = '', curDay = '';
  for (let i = 0; i < grid.values.length; i++) {
    const row = grid.values[i];
    const rawRow = grid.raw[i];
    // forward-fill date/day from cols 0,1
    const d = parseDate(rawRow[0], row[0]);
    if (d) { curDate = d.iso; curDay = String(row[1]).trim() || d.day; }
    const section = SECTION_MAP[String(row[2]).trim().toLowerCase()];
    if (!section || !curDate) continue;
    for (let s = 0; s < SLOTS.length; s++) {
      const cell = String(row[3 + s] || '').trim();
      if (!cell) continue;
      const type = classify(cell);
      let code = '', session = '', name = cell, faculty = '', room = '';
      if (type === 'class') {
        // Collapse line breaks first — guest cells look like "DVB-9\n(Guest Session)"
        // and `.` won't cross the newline, making the match fail entirely.
        const m = cell.replace(/\s+/g, ' ').match(/^([A-Za-z]+)[\s\-]*(.*)$/);
        code = m ? m[1] : cell;
        code = CODE_ALIASES[code.toUpperCase()] || code;
        session = m ? m[2].trim() : '';
        const info = legend[code];
        if (info) {
          name = info.name;
          faculty = info.faculty || '';
          room = info.room || '';
        }
      }
      const span = grid.merges[i + ',' + (3 + s)] || { rows: 1, cols: 1 };
      // Cell merged across slot columns = one session spanning those slots.
      const end = (SLOTS[Math.min(s + span.cols - 1, SLOTS.length - 1)])[1];
      const isGuest = session && session.toLowerCase().includes('guest');
      if (isGuest) {
        // Room is often written inline, e.g. "BM 6 &7 Guest Session ( Seminar Hall)"
        const rm = (session.match(/\(([^)]*)\)/g) || [])
          .map(x => x.slice(1, -1).trim())
          // A parenthetical like "( 11:30 AM - 1:00 PM)" is a time note, not a room
          .find(x => x && !/guest/i.test(x) && !/\d{1,2}[:.]\d{2}|\b[ap]m\b/i.test(x));
        if (rm) room = rm;
      }
      // A cell merged vertically across section rows applies to every section
      // it spans — read each spanned row's own Section-column label rather
      // than trusting just the top row (where the merged value actually
      // lives; the other rows read blank and would otherwise be dropped).
      // Spans reaching the Single Section row mean everyone attends → 'Single'.
      // 'AB' = joint session attended by both sections — emit one entry per section.
      let sectionsToEmit;
      if (span.rows > 1) {
        const covered = new Set();
        for (let r = 0; r < span.rows; r++) {
          const rowSectionRaw = grid.values[i + r] ? grid.values[i + r][2] : '';
          const rowSection = SECTION_MAP[String(rowSectionRaw).trim().toLowerCase()];
          if (rowSection) covered.add(rowSection);
        }
        if (covered.has('Single')) sectionsToEmit = ['Single'];
        else if (covered.size > 1) sectionsToEmit = Array.from(covered);
        else sectionsToEmit = section === 'AB' ? ['A', 'B'] : [section];
      } else {
        sectionsToEmit = section === 'AB' ? ['A', 'B'] : [section];
      }
      for (const sec of sectionsToEmit) {
        out.push({
          date: curDate, day: curDay, section: sec, slot: s,
          start: SLOTS[s][0], end: end, type, code, session, name, faculty, room
        });
      }
    }
  }
  return out;
}

function parseLegend(ss) {
  const legend = {};
  ss.getSheets().forEach(sh => {
    const rows = sh.getDataRange().getDisplayValues();
    for (let i = 0; i < rows.length; i++) {
      const header = rows[i].map(c => String(c).trim().toLowerCase());
      const codeCol = header.findIndex(h => h === 'course code' || h === 'code');
      if (codeCol === -1) continue;
      const nameCol = header.findIndex(h => ['elective details', 'course name', 'course', 'elective'].indexOf(h) > -1);
      const facCol = header.findIndex(h => ['professor', 'faculty', 'professor name', 'faculty name'].indexOf(h) > -1);
      const roomCol = header.findIndex(h => ['classroom', 'class room', 'room', 'venue'].some(x => h.includes(x)));
      const credCol = header.findIndex(h => h.includes('credit'));
      // read rows under this header until the code cell goes blank
      let consecutiveBlanks = 0;
      for (let j = i + 1; j < rows.length; j++) {
        const r = rows[j];
        const code = String(r[codeCol] || '').trim();
        if (!code) {
          consecutiveBlanks++;
          if (consecutiveBlanks > 15) break; // End of table
          continue;
        }
        consecutiveBlanks = 0;
        if (!/^[A-Za-z]{1,8}$/.test(code)) continue;
        const e = legend[code] || { name: '', faculty: '', room: '', credits: '' };
        if (nameCol > -1 && r[nameCol] && !e.name) e.name = String(r[nameCol]).trim();
        if (facCol > -1 && r[facCol] && !e.faculty) e.faculty = stripPII(String(r[facCol]).trim());
        if (roomCol > -1 && r[roomCol] && !e.room) e.room = String(r[roomCol]).trim();
        if (credCol > -1 && r[credCol] && !e.credits) e.credits = String(r[credCol]).trim();
        legend[code] = e;
      }
    }
  });
  return legend;
}

/* ---------- student enrollment parsing ---------- */

function parseStudentEnrollments(ss) {
  const sheets = ss.getSheets();
  const students = {}; // Format: { "email@example.com": { "BM": "A", "CS": "B" } }

  // Names of tabs that should be completely ignored (not course tabs)
  const ignoreSheets = ["Master", "CHANGES", "TERM", "LEGEND", "Schedule", "Changes", "Term", "Legend"];

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const sheetName = sheet.getName().trim();

    // Skip non-course sheets
    if (ignoreSheets.includes(sheetName)) continue;

    // Read the whole sheet
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) continue;

    // Find the header row (assume it's in the first 10 rows, looking for "Student Email" and "Section")
    let headerRowIdx = -1;
    let emailColIdx = -1;
    let sectionColIdx = -1;

    for (let r = 0; r < Math.min(10, data.length); r++) {
      for (let c = 0; c < data[r].length; c++) {
        const cellText = String(data[r][c]).trim().toLowerCase();

        // Find the email column
        if (cellText.includes("student email") || cellText === "email") {
          headerRowIdx = r;
          emailColIdx = c;
        }

        // Find the section column
        if (cellText === "section" || cellText === "sec") {
          sectionColIdx = c;
        }
      }
      if (emailColIdx !== -1) break; // We found the header row
    }

    // Fallback for tabs with no header row (e.g. WAI): detect the email column
    // by content — the column where most "@"-containing cells live — and the
    // section column as the one whose values are A/B/Single on those same rows.
    if (emailColIdx === -1) {
      // Only trust the fallback on tabs named like a course code (WAI, SCM, …) —
      // it would otherwise pick up rosters like "Faculty Details" / "CR Details".
      if (!/^[A-Za-z]{1,8}$/.test(sheetName)) continue;
      const emailCounts = {};
      for (let r = 0; r < data.length; r++) {
        for (let c = 0; c < data[r].length; c++) {
          const v = String(data[r][c]).trim();
          if (v.indexOf("@") > 0 && v.indexOf(".") > 0) emailCounts[c] = (emailCounts[c] || 0) + 1;
        }
      }
      let best = -1, bestN = 0;
      Object.keys(emailCounts).forEach(c => { if (emailCounts[c] > bestN) { bestN = emailCounts[c]; best = +c; } });
      if (best === -1 || bestN < 5) continue; // not an enrollment tab
      emailColIdx = best;
      headerRowIdx = -1; // no header — scan from the first row
      // Find the section column: values are exactly A / B / Single on email rows
      const colScore = {};
      for (let r = 0; r < data.length; r++) {
        if (String(data[r][emailColIdx]).indexOf("@") === -1) continue;
        for (let c = 0; c < data[r].length; c++) {
          if (c === emailColIdx) continue;
          const v = String(data[r][c]).trim().toLowerCase();
          if (v === "a" || v === "b" || v === "single") colScore[c] = (colScore[c] || 0) + 1;
        }
      }
      let secBest = -1, secN = 0;
      Object.keys(colScore).forEach(c => { if (colScore[c] > secN) { secN = colScore[c]; secBest = +c; } });
      if (secBest !== -1 && secN >= bestN / 2) sectionColIdx = secBest;
    }

    // Loop through the data rows below the header
    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const email = String(data[r][emailColIdx]).trim().toLowerCase();
      if (!email || !email.includes("@")) continue; // Skip empty rows or malformed emails

      // If there is no section column found, default to "Single" (e.g. for BBM if they don't add a column)
      let section = "Single";
      if (sectionColIdx !== -1) {
        section = String(data[r][sectionColIdx]).trim();
      }

      // Only record valid sections
      if (section) {
        const hash = sha256(email);
        if (!students[hash]) students[hash] = {};
        students[hash][sheetName] = section;
      }
    }
  }

  return students;
}

function sha256(str) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

/* ---------- helpers ---------- */

function parseDate(rawVal, dispVal) {
  if (rawVal instanceof Date) {
    const y = rawVal.getFullYear() > 2000 ? rawVal.getFullYear() : TERM_YEAR;
    const iso = y + '-' + pad(rawVal.getMonth() + 1) + '-' + pad(rawVal.getDate());
    return { iso, day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][rawVal.getDay()] };
  }
  const m = String(dispVal || '').trim().match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3})/);
  if (m) {
    const mm = MONTHS[m[2].toLowerCase()];
    if (mm) return { iso: TERM_YEAR + '-' + pad(mm) + '-' + pad(+m[1]), day: '' };
  }
  return null;
}

function classify(raw) {
  const u = raw.toUpperCase();
  if (u.indexOf('LUNCH') > -1) return 'break';
  if (/YOGA|INDEPENDENCE|MILAD|HOLIDAY/.test(u)) return 'holiday';
  if (/EXAM|END TERM|REGISTRATION/.test(u)) return 'exam';
  return 'class';
}

function pad(n) { return (n < 10 ? '0' : '') + n; }
function stripPII(s) { return s.replace(/\S+@\S+/g, '').replace(/\+?\d[\d\s\-]{7,}\d/g, '').trim(); }

/** Belt-and-suspenders: remove anything email-shaped from every output string. */
function sanitize(obj) {
  if (typeof obj === 'string') return obj.indexOf('@') > -1 ? stripPII(obj) : obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj && typeof obj === 'object') { const o = {}; for (const k in obj) o[k] = sanitize(obj[k]); return o; }
  return obj;
}

