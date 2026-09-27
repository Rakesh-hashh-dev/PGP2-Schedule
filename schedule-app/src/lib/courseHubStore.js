import { supabase } from "./supabase.js";

export const COURSE_HUB_KEY = "pgp2.course-hub-items";
export const courseHubStamp = () => Date.now();
export const courseHubId = () => crypto.randomUUID();

export function loadCourseHubItems() {
  try {
    const items = JSON.parse(localStorage.getItem(COURSE_HUB_KEY) || "[]");
    return Array.isArray(items) ? items : [];
  } catch { return []; }
}

export function saveCourseHubItems(items) {
  try { localStorage.setItem(COURSE_HUB_KEY, JSON.stringify(items)); } catch { /* device storage can be unavailable */ }
}

export function mergeCourseHubItems(local, remote) {
  const byId = new Map(remote.map((item) => [item.id, { ...item, pending: false }]));
  for (const item of local) {
    const server = byId.get(item.id);
    if (!server || item.updatedAt > server.updatedAt || (item.updatedAt === server.updatedAt && item.pending)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

const fromRow = (row) => ({
  id: row.id, term: row.term, code: row.course_code, kind: row.kind,
  title: row.title, url: row.url || "", sessionKey: row.session_key || "",
  details: row.details || {},
  done: Boolean(row.done), deleted: Boolean(row.deleted), updatedAt: Number(row.updated_at), pending: false,
});
const toRow = (item, userId) => ({
  user_id: userId, id: item.id, term: item.term, course_code: item.code,
  kind: item.kind, title: item.title, url: item.url || null,
  session_key: item.sessionKey || null, done: Boolean(item.done),
  details: item.details || {},
  deleted: Boolean(item.deleted), updated_at: item.updatedAt,
});

export async function syncCourseHubItems(userId, local, { readOnly = false } = {}) {
  if (!userId) return { items: local, synced: false };
  const { data, error } = await supabase.from("course_hub_items").select("*").eq("user_id", userId);
  if (error) return { items: local, synced: false };
  const merged = mergeCourseHubItems(local, (data || []).map(fromRow));
  if (readOnly) return { items: merged, synced: true };
  const pending = merged.filter((item) => item.pending);
  if (!pending.length) return { items: merged, synced: true };
  const result = await supabase.from("course_hub_items").upsert(pending.map((item) => toRow(item, userId)), { onConflict: "user_id,id" });
  if (result.error) return { items: merged, synced: false };
  const savedIds = new Set(pending.map((item) => item.id));
  return { items: merged.map((item) => savedIds.has(item.id) ? { ...item, pending: false } : item), synced: true };
}
