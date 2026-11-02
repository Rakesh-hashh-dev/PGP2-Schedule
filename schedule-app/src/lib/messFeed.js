import { getControls } from './appControls.js';
import { validateControls } from './controlsSchema.js';
export const MESS_MENU_FEED_URL = "https://script.google.com/macros/s/AKfycbylRyf5UlCtwS2dfrxIOS8S6huCmuy1QderIhWfQL5i3O_NvMfSeOEGL2zKxBFbBYCIpQ/exec";
const CACHE_KEY = 'pgp2-mess-feed-cache';
export let lastMessFeedStatus = { source: 'bundled', fetchedAt: null, buildTs: null, error: null };
function readCache(url) {
  try {
    const value = JSON.parse(localStorage.getItem(`${CACHE_KEY}:${url}`) || (url === MESS_MENU_FEED_URL ? localStorage.getItem(CACHE_KEY) : null) || 'null');
    if (value && (value.url === url || (!value.url && url === MESS_MENU_FEED_URL))) {
      validateControls('mess', { weekly: value.menu }); return value;
    }
  } catch { /* discard malformed cache */ }
  return null;
}
export function validateMessPayload(data) {
  if (data?.error) throw new Error(String(data.error));
  const menu = data?.menu;
  if (!menu || !Object.keys(menu).length) throw new Error('Empty menu payload');
  validateControls('mess', { weekly: menu });
  const normalized = Object.fromEntries(Object.entries(menu).map(([day, meals]) => [day,
    Object.fromEntries(Object.entries(meals).map(([meal, dishes]) => [meal, [...new Set(dishes.map(s => s.trim().toLowerCase().replace(/(^|[\s+/&(-])([a-z])/g, (_, b, l) => b + l.toUpperCase()).replace(/\s*\+\s*/g, ' + ').replace(/\s*\/\s*/g, ' / ')))]]))
  ]));
  return normalized;
}
export async function fetchMessMenuResult({ url = getControls().payload.mess.feedUrl || MESS_MENU_FEED_URL, fresh = false } = {}) {
  const cached = readCache(url);
  try {
    validateControls('mess', { feedUrl: url });
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(12000), ...(fresh ? { cache: 'no-store' } : {}) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json(); const menu = validateMessPayload(data);
    const value = { url, ts: Date.now(), buildTs: data.buildTs ?? null, menu };
    try { localStorage.setItem(`${CACHE_KEY}:${url}`, JSON.stringify(value)); } catch { /* optional */ }
    const result = { menu, source: 'live', fetchedAt: value.ts, buildTs: value.buildTs, error: null };
    lastMessFeedStatus = result; return result;
  } catch (error) {
    const result = { menu: cached?.menu || null, source: cached ? 'cache' : 'bundled', fetchedAt: cached?.ts || null, buildTs: cached?.buildTs || null, error: error.message };
    lastMessFeedStatus = result; return result;
  }
}
export async function fetchMessMenu(options) {
  const url = options?.url || getControls().payload.mess.feedUrl || MESS_MENU_FEED_URL;
  const result = await fetchMessMenuResult({ ...options, url });
  // A response from the old source must not overwrite a newly configured source.
  return options?.url || url === (getControls().payload.mess.feedUrl || MESS_MENU_FEED_URL) ? result.menu : null;
}
