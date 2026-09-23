const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntilChange(change, nowMs = Date.now()) {
  if (!change?.date) return null;
  const target = new Date(`${change.date}T12:00:00`).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.floor((target - nowMs) / DAY_MS);
}

export function attentionPriority(change, nowMs = Date.now()) {
  const days = daysUntilChange(change, nowMs);
  if (days !== null && (days < -1 || days > 14)) return 0;

  if (change?.kind === "removed") return days !== null && days <= 3 ? 5 : 4;
  if (change?.kind === "moved") return days !== null && days <= 3 ? 5 : 4;
  if (change?.kind === "course") return 3;
  if (change?.kind === "added" && days !== null && days >= 0 && days <= 7) return 2;
  return 0;
}

export function isAttentionChange(change, nowMs = Date.now()) {
  return attentionPriority(change, nowMs) > 0;
}

export function notificationDateParts(change) {
  const text = typeof change?.text === "string" ? change.text : "";
  const match = text.match(/^(.+?)\s+—\s+(.*)$/s);
  return {
    affectedWhen: match?.[1] || (change?.date || "Schedule update"),
    summary: match?.[2] || text || "Schedule updated",
  };
}
