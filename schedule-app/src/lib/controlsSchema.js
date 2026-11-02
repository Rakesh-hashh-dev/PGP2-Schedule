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
export const DEFAULT_CONTROLS = { mess: { weekly: {}, dates: {}, timings: {}, datedTimings: {}, notices: [], anchor: '2026-10-19', feedUrl: '' }, navigation: { items: {}, order: [] }, dashboard: {} };
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
  fail('Unknown settings section.');
}
export function normalizeControls(payload) {
  return Object.fromEntries(Object.keys(DEFAULT_CONTROLS).map(section => {
    try { return [section, validateControls(section, payload?.[section] || {})]; } catch { return [section, structuredClone(DEFAULT_CONTROLS[section])]; }
  }));
}
