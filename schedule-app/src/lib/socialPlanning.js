import { findGroupFreeSlots, friendVisibleClasses } from "./friends.js";
import { fmtTime12 } from "./datetime.js";

export const PLAN_TEMPLATES = Object.freeze([
  { id: "coffee", title: "Coffee", duration: 30, place: "Amul" },
  { id: "study", title: "Group study", duration: 60, place: "Library" },
  { id: "case", title: "Case preparation", duration: 60, place: "Library" },
  { id: "interview", title: "Mock interview", duration: 45, place: "" },
  { id: "project", title: "Project meeting", duration: 60, place: "" },
]);

export function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const toMinutes = time => { const [h, m] = String(time).split(":").map(Number); return h * 60 + m; };
const toTime = minutes => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export const courseCodes = courses => Object.keys(courses || {}).filter(code => !code.startsWith("_") && typeof courses[code] === "string");

export function hasKnownSchedule(courses, allClasses) {
  const codes = courseCodes(courses);
  return codes.length > 0 && codes.every(code => allClasses.some(c => c.code === code && (c.section === "Single" || c.section === courses[code]) && ["class", "exam"].includes(c.type)));
}

export function overlaps(start, end, otherStart, otherEnd) {
  return start < otherEnd && otherStart < end;
}

export function buildOccurrences(date, time, duration, count = 1) {
  const start = new Date(`${date}T${time}`);
  if (!Number.isFinite(start.getTime()) || localDate(start) !== date || toTime(start.getHours() * 60 + start.getMinutes()) !== time
    || !Number.isInteger(Number(duration)) || duration < 15 || duration > 240 || !Number.isInteger(Number(count)) || count < 1 || count > 8) {
    throw new Error("Choose a valid date, time, duration (15–240 minutes) and 1–8 occurrences.");
  }
  return Array.from({ length: Number(count) }, (_, index) => {
    const next = new Date(start); next.setDate(next.getDate() + index * 7);
    return { startsAt: next.toISOString(), endsAt: new Date(next.getTime() + Number(duration) * 60000).toISOString(), index };
  });
}

export function findPlanConflicts(occurrences, participants, allClasses, commitments = []) {
  const conflicts = [];
  const unknown = [];
  for (const person of participants) {
    if (!hasKnownSchedule(person.courses, allClasses)) { unknown.push(person.name); continue; }
    const classes = friendVisibleClasses(allClasses, person.courses).filter(c => ["class", "exam"].includes(c.type));
    for (const occurrence of occurrences) {
      const start = new Date(occurrence.startsAt).getTime();
      const end = new Date(occurrence.endsAt).getTime();
      for (const c of classes) {
        if (overlaps(start, end, new Date(`${c.date}T${c.start}`).getTime(), new Date(`${c.date}T${c.end}`).getTime())) {
          conflicts.push({ name: person.name, code: c.code || "Exam", date: c.date, start: c.start, end: c.end });
        }
      }
    }
  }
  for (const occurrence of occurrences) {
    for (const block of commitments) {
      if (overlaps(new Date(occurrence.startsAt).getTime(), new Date(occurrence.endsAt).getTime(), new Date(block.startsAt).getTime(), new Date(block.endsAt).getTime())) {
        const start = new Date(block.startsAt); const end = new Date(block.endsAt);
        conflicts.push({ name: "You", code: block.source, date: localDate(start), start: toTime(start.getHours() * 60 + start.getMinutes()), end: toTime(end.getHours() * 60 + end.getMinutes()) });
      }
    }
  }
  // Compare affected occurrences once per pair after excluding their old
  // intervals from commitments. Adjacent occurrences remain valid.
  for (let first = 0; first < occurrences.length; first++) {
    for (let second = first + 1; second < occurrences.length; second++) {
      const start = Math.max(new Date(occurrences[first].startsAt).getTime(), new Date(occurrences[second].startsAt).getTime());
      const end = Math.min(new Date(occurrences[first].endsAt).getTime(), new Date(occurrences[second].endsAt).getTime());
      if (start >= end || !Number.isFinite(start) || !Number.isFinite(end)) continue;
      const from = new Date(start); const until = new Date(end);
      conflicts.push({ name: "You", code: `Proposed occurrences ${first + 1} and ${second + 1} overlap`, date: localDate(from), start: toTime(from.getHours() * 60 + from.getMinutes()), end: toTime(until.getHours() * 60 + until.getMinutes()) });
    }
  }
  return { conflicts, unknown };
}

export function sharedTimeSuggestions({ enrolled, friends, groups = [], allClasses = [], now, presence = {}, userId, duration = 30, preferredStart = "08:00", preferredEnd = "22:00", dayType = "all", commitments = [], circleId = "all" }) {
  if (!now || !hasKnownSchedule(enrolled, allClasses)) return [];
  const minutes = Number(duration);
  const windowStart = toMinutes(preferredStart); const windowEnd = toMinutes(preferredEnd);
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 240 || !Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowStart < 480 || windowEnd > 1320 || windowEnd <= windowStart || !["all", "weekday", "weekend"].includes(dayType)) return [];
  const myClasses = friendVisibleClasses(allClasses, enrolled);
  const eligible = friends.filter(f => f.cloudId && hasKnownSchedule(f.courses, allClasses));
  const circles = eligible.filter(f => circleId === "all" || circleId === `friend:${f.cloudId}`).map(f => ({ name: f.name, members: [f] }));
  for (const group of groups) {
    if (circleId !== "all" && circleId !== `group:${group.id}`) continue;
    const cloudIds = group.isReceived ? (group.cloudMemberIds || []).filter(id => id !== userId)
      : [...new Set([...(group.memberIds || []).map(id => friends.find(f => f.id === id)?.cloudId), ...(group.inviteMembers || []).map(m => m.userId)].filter(Boolean))];
    const members = cloudIds.map(id => eligible.find(f => f.cloudId === id));
    if (members.length > 1 && members.every(Boolean)) circles.push({ name: group.name, members, groupId: group.id, groupName: group.name });
  }
  const suggestions = [];
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(now); day.setDate(day.getDate() + offset);
    const weekend = [0, 6].includes(day.getDay());
    if ((dayType === "weekday" && weekend) || (dayType === "weekend" && !weekend)) continue;
    const date = localDate(day);
    const dayStart = offset === 0 ? Math.max(windowStart, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15) : windowStart;
    if (dayStart + minutes > windowEnd) continue;
    for (const circle of circles) {
      if (circle.members.some(f => { const away = presence[f.cloudId]?.away; return away?.from <= date && away?.to >= date; })) continue;
      const privateIntervals = commitments.flatMap(block => {
        const start = new Date(block.startsAt); const end = new Date(block.endsAt);
        if (end <= new Date(`${date}T00:00:00`) || start >= new Date(`${date}T23:59:59`)) return [];
        return [{ date, start: localDate(start) < date ? "00:00" : toTime(start.getHours() * 60 + start.getMinutes()), end: localDate(end) > date ? "23:59" : toTime(end.getHours() * 60 + end.getMinutes()), type: "class" }];
      });
      const lists = [[...myClasses, ...privateIntervals], ...circle.members.map(f => friendVisibleClasses(allClasses, f.courses))];
      const candidates = findGroupFreeSlots(lists, date, dayStart, windowEnd).flatMap(slot => {
        const start = Math.ceil(Math.max(dayStart, toMinutes(slot.start)) / 15) * 15;
        const last = Math.floor((Math.min(windowEnd, toMinutes(slot.end)) - minutes) / 15) * 15;
        if (last < start) return [];
        return [start, Math.floor((start + last) / 30) * 15, last];
      });
      const starts = [...new Set(candidates)].sort((a, b) => a - b);
      // Spread choices across the day, rather than listing adjacent variations of one gap.
      const selected = starts.length <= 3 ? starts : [starts[0], starts[Math.floor(starts.length / 2)], starts.at(-1)];
      for (const start of selected) {
        const slot = { start: toTime(start), end: toTime(start + minutes), durationMin: minutes };
        suggestions.push({ ...slot, date, name: circle.name, groupId: circle.groupId, groupName: circle.groupName,
          explanation: `${minutes} min within your preferred hours · no class/exam or known personal conflicts; friends’ private commitments unverified`,
          memberCloudIds: circle.members.map(f => f.cloudId), names: circle.members.map(f => f.name),
          id: `${circle.groupId || "friend"}:${date}:${slot.start}:${circle.members.map(f => f.cloudId).sort().join(",")}` });
      }
    }
  }
  return [...new Map(suggestions.map(s => [s.id, s])).values()].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || b.names.length - a.names.length);
}

export function scheduleAvailability(friend, allClasses, now, presence = {}) {
  if (!now || !Number.isFinite(now.getTime())) return { state: "unknown", scheduleKnown: false };
  const date = localDate(now);
  if (presence.away?.from <= date && presence.away?.to >= date) return { state: "away" };
  const active = presence.status?.until && new Date(presence.status.until) > now ? presence.status : null;
  const known = hasKnownSchedule(friend.courses, allClasses);
  const current = friendVisibleClasses(allClasses, friend.courses).find(c => ["class", "exam"].includes(c.type) && c.date === date && overlaps(now.getTime(), now.getTime() + 1, new Date(`${c.date}T${c.start}`).getTime(), new Date(`${c.date}T${c.end}`).getTime()));
  if (current) return { state: "busy", end: current.end, kind: current.type, scheduleKnown: known };
  if (active?.availability === "unavailable") return { state: "unavailable", scheduleKnown: known };
  if (active?.availability === "available") return { state: "available", scheduleKnown: known };
  return known ? { state: "free", scheduleKnown: true } : { state: "unknown", scheduleKnown: false };
}

export function scheduleStatusLabel(status) {
  if (status?.state === "free") return "Free now";
  if (status?.state === "busy") return `${status.kind === "exam" ? "In exam" : "In class"}${status.end ? ` till ${fmtTime12(status.end)}` : ""}`;
  if (status?.state === "available") return "Says available";
  if (status?.state === "unavailable") return "Busy outside class";
  if (status?.state === "away") return "Reported away";
  return "Schedule unknown";
}

export function friendScheduleFreshness(friend, now) {
  if (typeof friend.lastCheckedAt !== "string" || !friend.lastCheckedAt) return "unverified";
  const checked = new Date(friend.lastCheckedAt).getTime();
  if (!Number.isFinite(checked) || !now || checked > now.getTime() + 5 * 60000) return "unverified";
  return now.getTime() - checked > 24 * 3600000 ? "stale" : "checked";
}
