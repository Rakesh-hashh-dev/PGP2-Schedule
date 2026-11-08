import { sessionKey, isExamSession } from "./attendance.js";

// Prefer notes attached to this session; otherwise use the latest earlier class.
export function reminderNotes(session, items = [], termNumber) {
  if (!session?.code) return { notes: [], previous: false };
  const key = sessionKey(session);
  const notes = items.filter(item => !item.deleted && item.kind === "note"
    && String(item.term) === String(termNumber || "current") && item.code === session.code);
  const exact = notes.filter(item => item.sessionKey === key);
  if (exact.length) return { notes: exact, previous: false };
  const earlier = notes.filter(item => (item.sessionKey?.endsWith(`_${session.code}_${session.section}`) || item.sessionKey?.endsWith(`_${session.code}_Single`))
    && item.sessionKey.slice(0, 16) < key.slice(0, 16))
    .sort((a, b) => b.sessionKey.localeCompare(a.sessionKey));
  return { notes: earlier.filter(item => item.sessionKey === earlier[0]?.sessionKey), previous: true };
}

export function reminderStage(session, now, record = {}) {
  if (!session || session.type !== "class" || isExamSession(session) || record.opened) return null;
  const start = new Date(`${session.date}T${session.start}:00`);
  const minutes = (start - now) / 60000;
  if (!(minutes > 0)) return null;
  if (minutes <= 20) return record.soon ? null : "soon";
  return record.entry ? null : "entry";
}

const fallback = new Map();
export function reminderHistory(scope, date, update) {
  const key = `pgp2.notes-reminder.${scope}`;
  let history;
  try { history = JSON.parse(localStorage.getItem(key) || "null"); } catch { /* use memory when storage is blocked */ }
  history = history || fallback.get(key);
  if (history?.date !== date || !history.sessions || typeof history.sessions !== "object") history = { date, sessions: {} };
  if (update) {
    history = { ...history, sessions: { ...history.sessions, [update.key]: { ...history.sessions[update.key], ...update.record } } };
    fallback.set(key, history);
    try { localStorage.setItem(key, JSON.stringify(history)); } catch { /* current session still remembers */ }
  }
  return history.sessions;
}
