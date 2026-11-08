export { diwaliCampaign, DIWALI_2026 } from '../../supabase/functions/_shared/diwali.js';
export const DIWALI_DEFAULTS = Object.freeze({ enabled: true, lit: false, outfit: true, fireworks: true });
export function diwaliStorageKey(userId, campaignKey) {
  return `pgp2.diwali.${encodeURIComponent(userId || 'guest')}.${campaignKey}`;
}
export function readDiwaliPrefs(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return Object.fromEntries(Object.entries(DIWALI_DEFAULTS).map(([field, fallback]) => [field, typeof saved?.[field] === 'boolean' ? saved[field] : fallback]));
  } catch { return { ...DIWALI_DEFAULTS }; }
}
export function saveDiwaliPrefs(key, prefs) {
  try { localStorage.setItem(key, JSON.stringify(prefs)); } catch { /* Remain usable for this visit when storage is blocked. */ }
}
