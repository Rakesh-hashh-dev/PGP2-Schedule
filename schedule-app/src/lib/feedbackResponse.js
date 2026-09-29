import { feedbackState } from "./adminWorkflow.js";

export const DEFAULT_RESPONSE_TARGET_HOURS = 48;
export const RESPONSE_TARGET_OPTIONS = [12, 24, 48, 72, 168];

export function feedbackResponseState(item, triage = {}, now = Date.now()) {
  const saved = triage[String(item.id)] || {};
  const status = feedbackState(item, triage).status;
  const created = Date.parse(item.created_at);
  const firstQueued = saved.first_reply_queued_at ? Date.parse(saved.first_reply_queued_at) : NaN;
  const targetHours = RESPONSE_TARGET_OPTIONS.includes(saved.response_target_hours)
    ? saved.response_target_hours : DEFAULT_RESPONSE_TARGET_HOURS;
  const closed = status === "resolved" || status === "duplicate";
  const hasReply = Number.isFinite(firstQueued);
  const validCreated = Number.isFinite(created);
  const ageHours = validCreated ? Math.max(0, Math.floor((now - created) / 3600000)) : null;
  const elapsedHours = validCreated && hasReply ? Math.max(0, (firstQueued - created) / 3600000) : null;
  const overdue = validCreated && !hasReply && !closed && now > created + targetHours * 3600000;
  return { status, closed, hasReply, targetHours, ageHours, elapsedHours, overdue,
    dueAt: validCreated ? new Date(created + targetHours * 3600000) : null,
    firstQueuedAt: hasReply ? new Date(firstQueued) : null };
}

export function feedbackResponseSummary(feedback = [], triage = {}, now = Date.now()) {
  const rows = feedback.map(item => ({ item, response: feedbackResponseState(item, triage, now) }));
  return {
    rows,
    openAwaiting: rows.filter(row => !row.response.closed && !row.response.hasReply).length,
    overdue: rows.filter(row => row.response.overdue).length,
    queued: rows.filter(row => row.response.hasReply).length,
    closedWithoutRecordedReply: rows.filter(row => row.response.closed && !row.response.hasReply).length,
  };
}
