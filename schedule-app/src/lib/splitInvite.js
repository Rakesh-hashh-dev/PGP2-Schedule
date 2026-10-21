const KEY = "pgp2.pending-split-invite";
const valid = value => typeof value === "string" && /^(?:[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(value);
export function rememberSplitInvite(value, storage = globalThis.localStorage) {
  if (!valid(value)) return false;
  try { storage?.setItem(KEY, value); } catch { /* Keep the in-memory invitation if storage is unavailable. */ }
  return true;
}
export function pendingSplitInvite(storage = globalThis.localStorage) {
  try { const value = storage?.getItem(KEY); return valid(value) ? value : null; } catch { return null; }
}
export function clearSplitInvite(storage = globalThis.localStorage) {
  try { storage?.removeItem(KEY); } catch { /* Storage may be unavailable. */ }
}
