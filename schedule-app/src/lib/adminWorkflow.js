import { classIdent, classMatchesKey, parseOverrideKey } from "./overrides.js";

const DAY_MS = 86400000;
const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function feedbackState(feedback, triage = {}) {
  const saved = triage[String(feedback.id)];
  return {
    status: saved?.status || (feedback.status === "resolved" ? "resolved" : "pending"),
    severity: saved?.severity || "normal",
    ownerId: saved?.owner_id || "",
  };
}

export function buildSupportQueue(users, feedback, triage = {}, now = Date.now(), inactiveDays = 14) {
  const openByUser = new Map();
  for (const item of feedback) {
    if (!item.user_id || ["resolved", "duplicate"].includes(feedbackState(item, triage).status)) continue;
    openByUser.set(item.user_id, (openByUser.get(item.user_id) || 0) + 1);
  }
  return users.map(user => {
    const reasons = [];
    const courseKeys = Object.keys(user.courses || {}).filter(key => !key.startsWith("_"));
    if (!courseKeys.length) reasons.push("Setup incomplete");
    const lastSeen = user.last_seen_at ? new Date(user.last_seen_at).getTime() : NaN;
    if (!Number.isFinite(lastSeen)) reasons.push("No activity recorded");
    else if (now - lastSeen >= inactiveDays * DAY_MS) reasons.push(`Inactive ${inactiveDays}+ days`);
    const openFeedback = openByUser.get(user.user_id) || 0;
    if (openFeedback) reasons.push(`${openFeedback} open feedback item${openFeedback === 1 ? "" : "s"}`);
    return { user, reasons, openFeedback };
  }).filter(row => row.reasons.length).sort((a, b) => b.openFeedback - a.openFeedback || b.reasons.length - a.reasons.length || (a.user.name || "").localeCompare(b.user.name || ""));
}

export function buildDataQualityIssues(classes, overrides = {}, snapshot = {}, now = Date.now()) {
  const issues = [];
  if (snapshot.status !== "success") issues.push({ key: "feed", level: "error", title: "Snapshot generation failed", detail: snapshot.error || "Check the timetable source and snapshot job.", area: "system" });
  const sourceTime = new Date(snapshot.lastSuccessTs || snapshot.ts || 0).getTime();
  if (Number.isFinite(sourceTime) && now - sourceTime > 3 * DAY_MS) issues.push({ key: "stale", level: "warn", title: "Snapshot is over 3 days old", detail: `Last successful snapshot: ${new Date(sourceTime).toLocaleString("en-IN")}`, area: "system" });
  const seen = new Set();
  const duplicateReported = new Set();
  for (const item of classes) {
    if (item.type !== "class") continue;
    const label = `${item.date} · ${item.code || item.name || "Class"} · ${item.section || "All"}`;
    const fingerprint = [item.date, item.section, item.code, item.start, item.end].join("|");
    if (seen.has(fingerprint)) {
      if (!duplicateReported.has(fingerprint)) issues.push({ key: `dup:${fingerprint}`, level: "warn", title: "Possible duplicate class", detail: label, area: "schedule", date: item.date });
      duplicateReported.add(fingerprint);
      continue;
    }
    seen.add(fingerprint);
    if (!item.code || !item.room || !item.faculty || !item.section) issues.push({ key: `missing:${label}:${item.start}`, level: "warn", title: "Missing class detail", detail: `${label}: ${[!item.code && "code", !item.room && "room", !item.faculty && "faculty", !item.section && "section"].filter(Boolean).join(", ")}`, area: "schedule", date: item.date });
    if (!VALID_TIME.test(item.start || "") || !VALID_TIME.test(item.end || "") || item.end <= item.start) issues.push({ key: `time:${label}:${item.start}`, level: "error", title: "Invalid class time", detail: `${label}: ${item.start || "?"}–${item.end || "?"}`, area: "schedule", date: item.date });
  }
  for (const [date, changes] of Object.entries(overrides || {})) {
    if (date >= new Date(now).toISOString().slice(0, 10)) continue;
    const count = Object.keys(changes || {}).length;
    if (count) issues.push({ key: `old:${date}`, level: "info", title: "Past override still stored", detail: `${date} · ${count} override${count === 1 ? "" : "s"}`, area: "schedule", date });
  }
  return issues.sort((a, b) => ({ error: 0, warn: 1, info: 2 })[a.level] - ({ error: 0, warn: 1, info: 2 })[b.level]);
}

function appliesToStudent(user, code, section) {
  const courses = Object.entries(user.courses || {}).filter(([key]) => !key.startsWith("_"));
  return courses.some(([key, value]) =>
    (!code || key === code || key.startsWith(`${code}_`))
    && (section === "All" || section === "Single" || value === section || key.endsWith(`_${section}`)));
}

export function buildBroadcastAudience(users, filter = {}, stagedChanges = [], now = Date.now()) {
  const { section = "", course = "", activity = "all", affected = false } = filter;
  const cutoff = now - 14 * DAY_MS;
  const matches = users.filter(user => {
    const courses = Object.entries(user.courses || {}).filter(([key]) => !key.startsWith("_"));
    if (course && !courses.some(([key, value]) =>
      (key === course || key.startsWith(`${course}_`))
      && (!section || value === section || key.endsWith(`_${section}`)))) return false;
    if (!course && section && !courses.some(([key, value]) => value === section || key.endsWith(`_${section}`))) return false;
    if (activity === "incomplete" && courses.length) return false;
    if (activity === "inactive" && (!user.last_seen_at || new Date(user.last_seen_at).getTime() >= cutoff)) return false;
    if (affected && !stagedChanges.some(change => appliesToStudent(user, change.code, change.section))) return false;
    return Boolean(user.user_id);
  });
  return { users: matches, ids: [...new Set(matches.map(user => user.user_id))], sample: matches.slice(0, 5).map(user => user.name || user.email || user.user_id) };
}

export function buildScheduleImpact(classes, overrides = {}, announcements = [], today = new Date().toISOString().slice(0, 10)) {
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const last = end.toISOString().slice(0, 10);
  const days = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    const entries = Object.entries(overrides[key] || {});
    days.push({
      date: key,
      classes: classes.filter(item => item.date === key && item.type === "class").length,
      cancellations: entries.filter(([, value]) => value?.type === "cancelled").length,
      roomChanges: entries.filter(([, value]) => value?.room && value.type !== "cancelled").length,
      timeChanges: entries.filter(([, value]) => (value?.start || value?.end) && value.type !== "cancelled").length,
      announcements: announcements.filter(item => item.start <= key && item.end >= key).length,
    });
  }
  return { days, totalOverrides: days.reduce((sum, day) => sum + day.cancellations + day.roomChanges + day.timeChanges, 0), last };
}

export function buildAdoptionTrend(presenceHistory, users, now = Date.now()) {
  const dates = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(now + 330 * 60000);
    day.setUTCDate(day.getUTCDate() - (13 - index));
    return day.toISOString().slice(0, 10);
  });
  const byDate = new Map(dates.map(date => [date, new Set()]));
  for (const row of presenceHistory || []) if (byDate.has(row.activity_date)) byDate.get(row.activity_date).add(row.user_id);
  const daily = dates.map(date => ({ date, active: byDate.get(date).size }));
  const current = new Set((presenceHistory || []).filter(row => dates.slice(7).includes(row.activity_date)).map(row => row.user_id)).size;
  const previous = new Set((presenceHistory || []).filter(row => dates.slice(0, 7).includes(row.activity_date)).map(row => row.user_id)).size;
  const completed = users.filter(user => Object.keys(user.courses || {}).some(key => !key.startsWith("_"))).length;
  return { daily, current, previous, completed, total: users.length };
}

export function buildChangeTimeline(logs = []) {
  return logs.map(log => {
    const details = log.details && typeof log.details === "object" ? log.details : {};
    const object = details.date || details.feedback || details.note || details.target || details.class || details.title || "";
    const action = String(log.action || "admin_action").replaceAll("_", " ");
    const area = /push|broadcast|announcement|flash/i.test(action) ? "broadcast"
      : /class|schedule|override|holiday|room/i.test(action) ? "schedule"
      : /feedback|handoff|user|onboarding|status/i.test(action) ? "users" : "system";
    return { id: log.id || `${log.created_at}:${log.action}`, action, object: String(object), area, actor: log.admin_id || "Admin", at: log.created_at };
  });
}

function sectionsOverlap(a, b) {
  return a === b || a === "All" || b === "All" || a === "Single" || b === "Single";
}

export function previewScheduleChange({ classes, users, date, code, section = "All", original, proposed }) {
  const before = original || classes.find(item => item.date === date && classIdent(item) === code && sectionsOverlap(item.section, section));
  const after = proposed?.type === "cancelled" || (!before && !proposed) ? null : { ...before, ...proposed, date, code, section };
  const affected = users.filter(user => appliesToStudent(user, code, section)).length;
  const findConflicts = candidate => {
    const found = [];
    if (!candidate?.start || !candidate?.end || !VALID_TIME.test(candidate.start) || !VALID_TIME.test(candidate.end)) return found;
    for (const item of classes) {
      const isOriginal = item === before || (before && item.date === before.date && item.section === before.section && classIdent(item) === classIdent(before) && item.start === before.start && item.end === before.end);
      if (item.date !== date || item.type !== "class" || isOriginal || !sectionsOverlap(item.section, section)) continue;
      if (candidate.start >= item.end || item.start >= candidate.end) continue;
      if (candidate.room && item.room && candidate.room === item.room) found.push(`Room ${candidate.room} overlaps ${item.code || item.name}`);
      else found.push(`Section time overlaps ${item.code || item.name}`);
    }
    return [...new Set(found)];
  };
  const existingConflicts = new Set(findConflicts(before));
  const conflicts = findConflicts(after).filter(conflict => !existingConflicts.has(conflict));
  return { before, after, affected, conflicts, section, date, code };
}

export function previewStagedScheduleChanges(classes, overrides, users, originalOverrides = {}) {
  const changes = [];
  const affectedIds = new Set();
  let conflicts = 0;
  const dates = new Set([...Object.keys(overrides || {}), ...Object.keys(originalOverrides || {})]);
  const entries = [...dates].flatMap(date => [...new Set([...Object.keys(overrides?.[date] || {}), ...Object.keys(originalOverrides?.[date] || {})])].map(key => ({ date, key, value: overrides?.[date]?.[key] })));
  for (const { date, key, value } of entries) {
    if (JSON.stringify(originalOverrides?.[date]?.[key]) === JSON.stringify(value)) continue;
    const parsed = parseOverrideKey(key);
    const { ident, section } = parsed;
    // Session-scoped keys carry the feed start, so this picks the right one of
    // a course's same-day sessions rather than always the first.
    const original = classes.find(item => item.date === date && classMatchesKey(item, parsed));
    const preview = previewScheduleChange({ classes, users, date, code: ident, section, original, proposed: value });
    users.filter(user => appliesToStudent(user, ident, section)).forEach(user => affectedIds.add(user.user_id));
    conflicts += preview.conflicts.length;
    changes.push({ ...preview, key, restored: value === undefined });
  }
  return { changes, affected: affectedIds.size, conflicts };
}
