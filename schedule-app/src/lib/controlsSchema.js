import { termKey } from './bidflowPlan.js';

export const MEALS = ['breakfast', 'lunch', 'snacks', 'dinner'];
export const MENU_KEYS = ['breakfast', 'lunch', 'snacksW13', 'snacksW24', 'dinner'];
export const NAV_IDS = ['today', 'tomorrow', 'fullSchedule', 'courseHub', 'planner', 'attendance', 'exams', 'assignments', 'notifications', 'friends', 'board', 'messMenu', 'split', 'pet', 'wrapped'];
export const CARD_IDS = ['upcoming', 'summary', 'timeline', 'mess', 'todayCommand', 'deadlines'];
export const DEFAULT_TIMES = [
  { id: 'breakfast', label: 'Breakfast', start: '08:30', end: '10:30' },
  { id: 'lunch', label: 'Lunch', start: '13:00', end: '15:00' },
  { id: 'snacks', label: 'Snacks', start: '17:30', end: '18:30' },
  { id: 'dinner', label: 'Dinner', start: '20:00', end: '22:30' },
];
export const DEFAULT_CONTROLS = {
  mess: { weekly: {}, dates: {}, timings: {}, datedTimings: {}, notices: [], anchor: '2026-10-19', feedUrl: '' },
  navigation: { items: {}, order: [] },
  dashboard: {},
  bidflow: {
    enabled: false,
    cohort: 'PGP1',
    term: 'Term IV',
    sheetUrl: '',
    minCredits: 15,
    maxCredits: 21,
    totalMinCredits: null,
    totalMaxCredits: null,
    termCreditRanges: {},
    rulesText: 'Select your primary and backup courses. Ensure your total credits fall within the required range shown above.',
    courses: [],
    updatedAt: '',
  },
};
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = message => { throw new Error(message); };
function keys(value, allowed, label) {
  if (!object(value) || Object.keys(value).some(k => !allowed.includes(k))) fail(`Invalid ${label} fields.`);
}
export function validDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v; }
export function validFeedUrl(v) {
  if (v === '') return true;
  try { const u = new URL(v); return u.protocol === 'https:' && u.hostname === 'script.google.com' && /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname) && !u.username && !u.password && !u.search && !u.hash; } catch { return false; }
}
function dishes(value) {
  if (!Array.isArray(value) || value.length > 40 || value.some(v => typeof v !== 'string' || !v.trim() || v.length > 160) || new Set(value).size !== value.length) fail('Use up to 40 unique, non-empty dishes (160 characters each).');
}
function menuMap(map, dated) {
  if (!object(map) || Object.keys(map).length > (dated ? 120 : 7)) fail('Invalid menu map.');
  for (const [day, meals] of Object.entries(map)) {
    if (dated ? !validDate(day) : !/^[0-6]$/.test(day)) fail('Invalid menu date/day.');
    keys(meals, dated ? MEALS : MENU_KEYS, 'meal'); Object.values(meals).forEach(dishes);
  }
}
function timingMap(map) {
  keys(map, MEALS, 'timings');
  const times = DEFAULT_TIMES.map(m => {
    const t = map[m.id];
    if (t) { keys(t, ['start', 'end'], 'time'); if (![t.start, t.end].every(s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s))) fail('Invalid meal time.'); }
    return { ...m, ...t };
  });
  times.forEach((t, i) => { if (t.start >= t.end || (i && times[i - 1].end > t.start)) fail('Meal times must increase without overlap.'); });
}
function validText(value, limit, required = false) {
  return typeof value === 'string' && value.length <= limit && (!required || Boolean(value.trim()));
}

export function validateControls(section, value) {
  if (section === 'mess') {
    keys(value, Object.keys(DEFAULT_CONTROLS.mess), 'mess');
    const v = { ...DEFAULT_CONTROLS.mess, ...value };
    menuMap(v.weekly, false); menuMap(v.dates, true); timingMap(v.timings);
    if (!validDate(v.anchor) || new Date(`${v.anchor}T00:00:00Z`).getUTCDay() !== 1) fail('Rotation anchor must be a Monday.');
    if (!validFeedUrl(v.feedUrl)) fail('Use an HTTPS Google Apps Script /exec URL.');
    if (!object(v.datedTimings) || Object.keys(v.datedTimings).length > 120) fail('Invalid dated timings.');
    for (const [day, t] of Object.entries(v.datedTimings)) { if (!validDate(day)) fail('Invalid timing date.'); timingMap({ ...v.timings, ...t }); keys(t, MEALS, 'dated timings'); }
    if (!Array.isArray(v.notices) || v.notices.length > 30) fail('Use at most 30 notices.');
    for (const n of v.notices) { keys(n, ['id', 'text', 'start', 'end'], 'notice'); if (typeof n.id !== 'string' || !n.id || n.id.length > 80 || typeof n.text !== 'string' || !n.text.trim() || n.text.length > 300 || ![n.start, n.end].every(t => typeof t === 'string' && /[Zz]|[+-]\d\d:\d\d$/.test(t) && Number.isFinite(Date.parse(t))) || Date.parse(n.start) >= Date.parse(n.end)) fail('Notice needs text and a valid start/end with timezone.'); }
    return v;
  }
  if (section === 'navigation') {
    keys(value, ['items', 'order'], 'navigation');
    const v = { ...DEFAULT_CONTROLS.navigation, ...value }; keys(v.items, NAV_IDS, 'navigation items');
    for (const [id, p] of Object.entries(v.items)) { keys(p, ['label', 'visible'], 'navigation item'); if (p.label !== undefined && (typeof p.label !== 'string' || !p.label.trim() || p.label.length > 40)) fail('Labels need 1–40 characters.'); if (p.visible !== undefined && typeof p.visible !== 'boolean') fail('Invalid visibility.'); if (id === 'today' && p.visible === false) fail('Today must remain available.'); }
    if (!Array.isArray(v.order) || v.order.some(id => !NAV_IDS.includes(id)) || new Set(v.order).size !== v.order.length) fail('Invalid navigation order.');
    return v;
  }
  if (section === 'dashboard') {
    keys(value, ['order', 'visible', 'density', 'weekPanel'], 'dashboard');
    if (value.order !== undefined && (!Array.isArray(value.order) || value.order.some(id => !CARD_IDS.includes(id)) || new Set(value.order).size !== value.order.length)) fail('Invalid widget order.');
    if (value.visible !== undefined) { keys(value.visible, ['summary', 'todayCommand', 'upcoming', 'mess', 'weather', 'deadlines'], 'widget visibility'); if (Object.values(value.visible).some(v => typeof v !== 'boolean')) fail('Invalid widget visibility.'); }
    if (value.density !== undefined && !['compact', 'comfortable'].includes(value.density)) fail('Invalid density.');
    if (value.weekPanel !== undefined && typeof value.weekPanel !== 'boolean') fail('Invalid week panel setting.');
    return value;
  }
  if (section === 'bidflow') {
    keys(value, Object.keys(DEFAULT_CONTROLS.bidflow), 'bidflow');
    const v = { ...DEFAULT_CONTROLS.bidflow, ...value };
    if (typeof v.enabled !== 'boolean') fail('BidFlow enabled must be boolean.');
    if (![v.cohort, v.term].every(text => validText(text, 40, true)) || !termKey(v.term)) fail('Enter a cohort and term (up to 40 characters).');
    if (!validText(v.sheetUrl, 2048) || !validText(v.updatedAt, 40)) fail('Invalid catalog metadata.');
    if (!Number.isFinite(v.minCredits) || v.minCredits < 0) fail('Minimum credits must be zero or more.');
    if (!Number.isFinite(v.maxCredits) || v.maxCredits <= 0 || v.maxCredits < v.minCredits) fail('Maximum credits must be positive and at least the minimum.');
    if ((v.totalMinCredits !== null || v.totalMaxCredits !== null) &&
        (!Number.isFinite(v.totalMinCredits) || !Number.isFinite(v.totalMaxCredits) || v.totalMinCredits < 0 || v.totalMaxCredits <= 0 || v.totalMaxCredits < v.totalMinCredits)) fail('Enter a valid overall credit range or leave both values blank.');
    if (!object(v.termCreditRanges) || Object.keys(v.termCreditRanges).length > 20) fail('Use up to 20 term credit ranges.');
    for (const [term, range] of Object.entries(v.termCreditRanges)) {
      keys(range, ['min', 'max'], 'term credit range');
      if (!validText(term, 40, true) || term !== termKey(term) || !Number.isFinite(range.min) || !Number.isFinite(range.max) ||
          range.min < 0 || range.max <= 0 || range.max < range.min) fail('Enter a valid credit range for ' + term + '.');
    }
    if (!validText(v.rulesText, 2000)) fail('Use up to 2,000 characters for the rules.');
    if (!Array.isArray(v.courses) || v.courses.length > 500 || (v.enabled && !v.courses.length)) fail('A visible catalog requires 1–500 electives.');
    const codes = new Set();
    for (const c of v.courses) {
      keys(c, ['code', 'name', 'area', 'credits', 'faculty', 'facultyType', 'term', 'slots', 'description'], 'course');
      const identity = JSON.stringify([termKey(c.term || v.term), c.code]);
      if (!validText(c.code, 40, true) || c.code !== c.code.trim().toUpperCase() || codes.has(identity)) fail('Course codes must be unique within each term, uppercase and up to 40 characters.');
      codes.add(identity);
      if (!validText(c.name, 250, true) || !Number.isFinite(c.credits) || c.credits <= 0) fail(c.code + ' requires a name and positive credits.');
      if (!validText(c.area ?? 'Other', 80, true) || !validText(c.faculty ?? '', 200) || !validText(c.term ?? '', 40) || !validText(c.description ?? '', 2000)) fail('Invalid course details for ' + c.code + '.');
      if (c.facultyType !== undefined && !validText(c.facultyType, 80)) fail('Invalid faculty type for ' + c.code + '.');
      if (c.slots != null && (!Number.isSafeInteger(c.slots) || c.slots < 0)) fail('Invalid seat count for ' + c.code + '.');
    }
    return { ...v, courses: v.courses.map(c => ({ ...c, area: c.area ?? 'Other', faculty: c.faculty ?? '', term: c.term?.trim() || '', slots: c.slots ?? null, description: c.description ?? '' })) };
  }
  fail('Unknown settings section.');
}
export function normalizeControls(payload) {
  return Object.fromEntries(Object.keys(DEFAULT_CONTROLS).map(section => {
    try { return [section, validateControls(section, payload?.[section] || {})]; } catch { return [section, structuredClone(DEFAULT_CONTROLS[section])]; }
  }));
}
