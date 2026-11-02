import { DEFAULT_CONTROLS, DEFAULT_TIMES } from './controlsSchema.js';
export function istDate(date) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
export function istMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date).split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}
export function istDay(date) { return new Date(`${istDate(date)}T00:00:00Z`).getUTCDay(); }
export function resolveMealTimes(date, config = DEFAULT_CONTROLS.mess) {
  const dated = config.datedTimings?.[istDate(date)] || {};
  return DEFAULT_TIMES.map(m => ({ ...m, ...config.timings?.[m.id], ...dated[m.id] }));
}
export function activeNotices(now, config = DEFAULT_CONTROLS.mess) { return (config.notices || []).filter(n => Date.parse(n.start) <= +now && +now < Date.parse(n.end)); }
export function resolveMenu(base, feed, date, config = DEFAULT_CONTROLS.mess, extras = []) {
  const key = istDate(date), day = istDay(date);
  const d = { ...base[day], ...feed?.[day], ...config.weekly?.[day] };
  if (!base[day]) return null;
  const weeks = Math.floor((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${config.anchor || '2026-10-19'}T00:00:00Z`)) / 604800000);
  const snacksKey = ((weeks % 2) + 2) % 2 ? 'snacksW24' : 'snacksW13';
  // An explicit empty meal means unavailable; do not silently re-add extras.
  const breakfast = d.breakfast?.length ? [...new Set([...d.breakfast, ...extras])] : [];
  return { breakfast, lunch: d.lunch || [], snacks: d[snacksKey] || [], dinner: d.dinner || [], ...config.dates?.[key] };
}
