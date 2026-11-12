export const CHAT_PAGE_SIZE = 40;
export function compareChatTimes(a, b) {
  const millis = new Date(a || 0) - new Date(b || 0);
  if (millis) return millis;
  const micros = value => Number((String(value).match(/\.(\d+)/)?.[1] || "").padEnd(6, "0").slice(3, 6));
  return micros(a) - micros(b);
}
export const compareMessages = (a, b) => compareChatTimes(a.created_at, b.created_at) || a.id.localeCompare(b.id);
export const messageCursor = message => message ? { createdAt: message.created_at, id: message.id } : null;
export function messageBeforeCursor(cursor) {
  if (!cursor || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id) || !Number.isFinite(Date.parse(cursor.createdAt))) throw new Error("Invalid chat cursor.");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(cursor.createdAt)) throw new Error("Invalid chat cursor.");
  const time = cursor.createdAt;
  return `created_at.lt.${time},and(created_at.eq.${time},id.lt.${cursor.id})`;
}
export function normalizeChatMessage(row) {
  return { id: row.id, from_id: row.from_id, name: row.from_name || row.name || "Someone", text: row.text || "", created_at: row.created_at, reply_to: row.reply_to || null };
}
export function mergeChatMessages(current, incoming) {
  return [...new Map([...current, ...incoming].map(row => [row.id, row])).values()].sort(compareMessages);
}
export function reconcileChatMessages(current, checkedIds, readableRows, recentRows) {
  const checked = new Set(checkedIds);
  return mergeChatMessages(current.filter(row => !checked.has(row.id)), [...readableRows, ...recentRows]);
}
export const chatDraftKey = (userId, groupId) => `pgp2.group-draft:${encodeURIComponent(userId)}:${encodeURIComponent(groupId)}`;
export function loadChatDraft(userId, groupId) {
  try { const draft = JSON.parse(localStorage.getItem(chatDraftKey(userId, groupId))); return { text: typeof draft?.text === "string" ? draft.text : "", replyTo: typeof draft?.replyTo === "string" ? draft.replyTo : null }; }
  catch { return { text: "", replyTo: null }; }
}
export function storeChatDraft(userId, groupId, value) {
  try { const key = chatDraftKey(userId, groupId); if (!value.text && !value.replyTo) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* optional device draft */ }
}
export function firstUnreadMessage(messages, userId, seenAt) {
  return messages.find(message => message.from_id !== userId && compareChatTimes(message.created_at, seenAt) > 0)?.id || null;
}
export function visibleReadCursor(messages, visibleIds, seenAt, hasOlder) {
  if (!messages.length || (hasOlder && compareChatTimes(messages[0].created_at, seenAt) > 0)) return null;
  let latest = null;
  // A timestamp cursor covers every tied row. Advance only when every row in
  // each unseen timestamp bucket has actually been visible.
  const buckets = new Map();
  for (const message of messages) if (compareChatTimes(message.created_at, seenAt) > 0) {
    const bucket = buckets.get(message.created_at) || []; bucket.push(message); buckets.set(message.created_at, bucket);
  }
  for (const [time, rows] of buckets) { if (!rows.every(row => visibleIds.has(row.id))) break; latest = time; }
  return latest;
}
