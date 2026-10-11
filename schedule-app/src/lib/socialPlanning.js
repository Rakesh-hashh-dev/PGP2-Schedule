import { findGroupFreeSlots, friendVisibleClasses } from "./friends.js";

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

export function findPlanConflicts(occurrences, participants, allClasses) {
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
  return { conflicts, unknown };
}

export function sharedTimeSuggestions({ enrolled, friends, groups = [], allClasses = [], now, presence = {}, userId }) {
  if (!now || !hasKnownSchedule(enrolled, allClasses)) return [];
  const myClasses = friendVisibleClasses(allClasses, enrolled);
  const eligible = friends.filter(f => f.cloudId && hasKnownSchedule(f.courses, allClasses));
  const circles = eligible.map(f => ({ name: f.name, members: [f] }));
  for (const group of groups) {
    const cloudIds = group.isReceived ? (group.cloudMemberIds || []).filter(id => id !== userId)
      : [...new Set([...(group.memberIds || []).map(id => friends.find(f => f.id === id)?.cloudId), ...(group.inviteMembers || []).map(m => m.userId)].filter(Boolean))];
    const members = cloudIds.map(id => eligible.find(f => f.cloudId === id));
    if (members.length > 1 && members.every(Boolean)) circles.push({ name: group.name, members, groupId: group.id, groupName: group.name });
  }
  const suggestions = [];
  for (let offset = 0; offset < 3; offset++) {
    const day = new Date(now); day.setDate(day.getDate() + offset);
    const date = localDate(day);
    const dayStart = offset === 0 ? Math.max(480, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15) : 480;
    if (dayStart >= 1320) continue;
    for (const circle of circles) {
      if (circle.members.some(f => { const away = presence[f.cloudId]?.away; return away?.from <= date && away?.to >= date; })) continue;
      const lists = [myClasses, ...circle.members.map(f => friendVisibleClasses(allClasses, f.courses))];
      const slots = findGroupFreeSlots(lists, date, dayStart, 1320).map(slot => {
        const start = Math.max(dayStart, toMinutes(slot.start)); const end = Math.min(1320, toMinutes(slot.end));
        return { start: toTime(start), end: toTime(end), durationMin: end - start };
      }).filter(slot => slot.durationMin >= 30);
      if (!slots.length) continue;
      const slot = slots[0];
      suggestions.push({ ...slot, date, name: circle.name, groupId: circle.groupId, groupName: circle.groupName,
        memberCloudIds: circle.members.map(f => f.cloudId), names: circle.members.map(f => f.name),
        id: `${date}:${slot.start}:${circle.members.map(f => f.cloudId).sort().join(",")}` });
    }
  }
  return [...new Map(suggestions.map(s => [s.id, s])).values()].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || b.names.length - a.names.length).slice(0, 12);
}

export function scheduleAvailability(friend, allClasses, now, presence = {}) {
  if (!now) return null;
  const date = localDate(now);
  if (presence.away?.from <= date && presence.away?.to >= date) return { state: "away" };
  const active = presence.status?.until && new Date(presence.status.until) > now ? presence.status : null;
  const known = hasKnownSchedule(friend.courses, allClasses);
  const current = friendVisibleClasses(allClasses, friend.courses).find(c => ["class", "exam"].includes(c.type) && c.date === date && overlaps(now.getTime(), now.getTime() + 1, new Date(`${c.date}T${c.start}`).getTime(), new Date(`${c.date}T${c.end}`).getTime()));
  if (current) return { state: "busy", end: current.end, scheduleKnown: known };
  if (active?.availability === "unavailable") return { state: "unavailable", scheduleKnown: known };
  if (active?.availability === "available") return { state: "available", scheduleKnown: known };
  return known ? { state: "free", scheduleKnown: true } : null;
}
