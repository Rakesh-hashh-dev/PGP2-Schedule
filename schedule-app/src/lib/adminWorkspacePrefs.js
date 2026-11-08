const DATASETS = new Set(['audit','feedback','versions','students','notifications']);
const STATUSES = new Set(['open','resolved','dismissed','all']);
const knownPins = new Set(['classes-today','classes-tomorrow','menu-tomorrow','notification-diagnostics','reports','student-support','publication-history','system-controls']);
const key = userId => `pgp2.admin-workspace-v1:${encodeURIComponent(userId)}`;
export function normalizeAdminWorkspacePrefs(value) {
  const result = { version:1, pins:[], filters:{} };
  if (value?.version !== 1) return result;
  result.pins = [...new Set((Array.isArray(value.pins) ? value.pins : []).filter(pin=>knownPins.has(pin)))].slice(0,8);
  if(DATASETS.has(value.filters?.dataset)) result.filters.dataset=value.filters.dataset;
  if(STATUSES.has(value.filters?.reportStatus)) result.filters.reportStatus=value.filters.reportStatus;
  for(const field of ['from','to']) {
    const date=value.filters?.[field], parsed=Date.parse(`${date}T00:00:00Z`);
    if(typeof date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0,10)===date) result.filters[field]=date;
  }
  return result;
}
export function loadAdminWorkspacePrefs(userId, storage) {
  try { const target=storage===undefined?globalThis.localStorage:storage; return normalizeAdminWorkspacePrefs(JSON.parse(target?.getItem(key(userId)) || 'null')); } catch { return normalizeAdminWorkspacePrefs(null); }
}
export function saveAdminWorkspacePrefs(userId, value, storage) {
  try { const target=storage===undefined?globalThis.localStorage:storage; if(!target || !userId) return false; target.setItem(key(userId),JSON.stringify(normalizeAdminWorkspacePrefs(value))); return true; } catch { return false; }
}
