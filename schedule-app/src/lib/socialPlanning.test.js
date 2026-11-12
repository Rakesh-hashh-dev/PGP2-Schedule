import { describe, expect, it, vi } from "vitest";
vi.mock("./supabase.js", () => ({ supabase: {} }));
import { buildOccurrences, findPlanConflicts, sharedTimeSuggestions, scheduleAvailability, hasKnownSchedule, scheduleStatusLabel, friendScheduleFreshness } from "./socialPlanning.js";
const session = (date, start, end, code = "PM", section = "A") => ({ type: "class", date, start, end, code, section });
const courses = { PM: "A" };
const allClasses = [session("2026-10-08", "09:00", "10:00"), session("2026-10-15", "09:00", "10:00"), session("2026-10-08", "12:00", "13:00", "FIN")];

describe("affected occurrence overlaps", () => {
  it("reports each proposed conflicting pair once without unrelated or adjacent occurrences", () => {
    const occurrences = [
      { startsAt: "2099-01-01T10:00:00", endsAt: "2099-01-01T12:00:00" },
      { startsAt: "2099-01-01T11:00:00", endsAt: "2099-01-01T13:00:00" },
      { startsAt: "2099-01-01T13:00:00", endsAt: "2099-01-01T14:00:00" },
      { startsAt: "2099-01-08T10:00:00", endsAt: "2099-01-08T12:00:00" },
    ];
    const result = findPlanConflicts(occurrences, [], []);
    expect(result.conflicts).toEqual([{ name: "You", code: "Proposed occurrences 1 and 2 overlap", date: "2099-01-01", start: "11:00", end: "12:00" }]);
    expect(findPlanConflicts([occurrences[0], { ...occurrences[1], startsAt: "2099-01-01T12:00:00" }], [], []).conflicts).toEqual([]);
  });
});

describe("Social planning", () => {
  it("creates bounded weekly occurrences with stable local wall time", () => {
    const occurrences = buildOccurrences("2026-10-08", "16:30", 45, 4);
    expect(occurrences).toHaveLength(4);
    expect(new Date(occurrences[3].startsAt).getDate()).toBe(29);
    expect(new Date(occurrences[3].startsAt).getHours()).toBe(16);
    expect(new Date(occurrences[3].endsAt) - new Date(occurrences[3].startsAt)).toBe(45 * 60000);
  });
  it("rejects invalid dates, out-of-range durations and excessive repeats", () => {
    for (const args of [["2026-02-30", "10:00", 60, 1], ["2026-10-08", "25:00", 60, 1], ["2026-10-08", "10:00", 14, 1], ["2026-10-08", "10:00", 60, 9]]) expect(() => buildOccurrences(...args)).toThrow();
  });
  it("flags conflicts for every occurrence while allowing adjacent meetings", () => {
    const people = [{ name: "You", courses }, { name: "Unknown", courses: {} }];
    expect(findPlanConflicts(buildOccurrences("2026-10-08", "09:30", 30, 2), people, allClasses).conflicts).toHaveLength(2);
    const adjacent = findPlanConflicts(buildOccurrences("2026-10-08", "10:00", 30), people, allClasses);
    expect(adjacent.conflicts).toEqual([]); expect(adjacent.unknown).toEqual(["Unknown"]);
  });
  it("does not mistake metadata-only or unknown course maps for known schedules", () => {
    expect(hasKnownSchedule({ _name: "Student" }, allClasses)).toBe(false);
    expect(hasKnownSchedule({ UNKNOWN: "A" }, allClasses)).toBe(false);
    expect(hasKnownSchedule({ PM: "A", _status: {} }, allClasses)).toBe(true);
  });
  it("suggests future bounded gaps and excludes unknown and away friends", () => {
    const now = new Date("2026-10-08T10:05:00");
    const friends = [{ id: "1", cloudId: "one", name: "Meera", courses }, { id: "2", cloudId: "two", name: "Unknown", courses: {} }, { id: "3", cloudId: "three", name: "Away", courses }];
    const slots = sharedTimeSuggestions({ enrolled: courses, allClasses, friends, now, presence: { three: { away: { from: "2026-10-08", to: "2026-10-10" } } } });
    expect(slots[0].start).toBe("10:15");
    expect(slots.every(s => s.end <= "22:00" && s.memberCloudIds.length === 1 && s.memberCloudIds[0] !== "two")).toBe(true);
    expect(slots.filter(s => s.date <= "2026-10-10").every(s => s.memberCloudIds[0] === "one")).toBe(true);
    expect(slots.some(s => s.date > "2026-10-10" && s.memberCloudIds[0] === "three")).toBe(true);
  });
  it("counts an invite member already represented as a friend once", () => {
    const friends = [{ id: "1", cloudId: "one", name: "Meera", courses }, { id: "2", cloudId: "two", name: "Aarav", courses }];
    const groups = [{ id: "g", name: "Circle", memberIds: ["1", "2"], inviteMembers: [{ userId: "one" }] }];
    const suggestions = sharedTimeSuggestions({ enrolled: courses, allClasses, friends, groups, now: new Date("2026-10-08T10:00:00") });
    expect(suggestions.find(s => s.groupId === "g").memberCloudIds).toEqual(["one", "two"]);
  });
  it("offers distinct duration-sized choices within preferred hours without class conflicts", () => {
    const slots = sharedTimeSuggestions({ enrolled: courses, allClasses, friends: [{ cloudId: "one", name: "Meera", courses: { FIN: "A" } }], now: new Date("2026-10-08T10:05:00"), duration: 60, preferredStart: "11:00", preferredEnd: "18:00" });
    const today = slots.filter(slot => slot.date === "2026-10-08");
    expect(today).toHaveLength(3);
    expect(new Set(today.map(slot => slot.start)).size).toBe(3);
    expect(today.every(slot => slot.start >= "11:00" && slot.end <= "18:00" && slot.durationMin === 60)).toBe(true);
    expect(today.every(slot => slot.end <= "12:00" || slot.start >= "13:00")).toBe(true);
    expect(today[0].explanation).toContain("60 min");
  });
  it("reaches weekends within the seven-day horizon and excludes the other day type", () => {
    const args = { enrolled: courses, allClasses, friends: [{ cloudId: "one", name: "Meera", courses }], now: new Date("2026-10-08T10:00:00") };
    const weekends = sharedTimeSuggestions({ ...args, dayType: "weekend" });
    expect(weekends.length).toBeGreaterThan(0);
    expect(weekends.every(slot => [0, 6].includes(new Date(`${slot.date}T12:00:00`).getDay()))).toBe(true);
    expect(sharedTimeSuggestions({ ...args, dayType: "weekday" }).every(slot => ![0, 6].includes(new Date(`${slot.date}T12:00:00`).getDay()))).toBe(true);
    expect(sharedTimeSuggestions({ ...args, preferredStart: "18:00", preferredEnd: "17:00" })).toEqual([]);
    expect(sharedTimeSuggestions({ ...args, duration: 241 })).toEqual([]);
  });
  it("separates timetable gaps from explicit availability and expiry", () => {
    const now = new Date("2026-10-08T10:00:00"); const friend = { courses };
    expect(scheduleAvailability(friend, allClasses, now).state).toBe("free");
    expect(scheduleAvailability(friend, allClasses, now, { status: { availability: "available", until: "2026-10-08T11:00:00" } }).state).toBe("available");
    expect(scheduleAvailability(friend, allClasses, now, { status: { availability: "available", until: "2026-10-08T09:59:00" } }).state).toBe("free");
    expect(scheduleAvailability({ courses: {} }, allClasses, now)).toEqual({ state: "unknown", scheduleKnown: false });
    expect(scheduleAvailability(friend, allClasses, now, { status: { availability: "unavailable", until: "2026-10-08T11:00:00" } }).state).toBe("unavailable");
  });
  it("prioritizes known class commitments and away windows over available status", () => {
    const now = new Date("2026-10-08T09:30:00"); const status = { availability: "available", until: "2026-10-08T11:00:00" };
    expect(scheduleAvailability({ courses }, allClasses, now, { status }).state).toBe("busy");
    expect(scheduleAvailability({ courses }, allClasses, now, { status, away: { from: "2026-10-08", to: "2026-10-08" } }).state).toBe("away");
  });
  it("keeps a current class visible with partially unmapped courses but never infers free from that partial schedule", () => {
    const friend = { courses: { PM: "A", UNKNOWN: "B", _name: "Friend", _buddy_preferences: { discoverable: false } } };
    const during = scheduleAvailability(friend, allClasses, new Date("2026-10-08T09:30:00"));
    expect(during).toMatchObject({ state: "busy", kind: "class", scheduleKnown: false, end: "10:00" });
    expect(scheduleStatusLabel(during)).toBe("In class till 10:00AM");
    const after = scheduleAvailability(friend, allClasses, new Date("2026-10-08T10:30:00"));
    expect(after.state).toBe("unknown"); expect(scheduleStatusLabel(after)).toBe("Schedule unknown");
  });
  it("labels a current exam accurately and preserves explicit status priorities", () => {
    const now = new Date("2026-10-08T09:30:00");
    const exam = [{ ...session("2026-10-08", "09:00", "10:00"), type: "exam" }];
    const unavailable = { status: { availability: "unavailable", until: "2026-10-08T11:00:00" } };
    expect(scheduleStatusLabel(scheduleAvailability({ courses }, exam, now, unavailable))).toBe("In exam till 10:00AM");
    expect(scheduleAvailability({ courses }, exam, now, { ...unavailable, away: { from: "2026-10-08", to: "2026-10-08" } }).state).toBe("away");
    const after = new Date("2026-10-08T10:30:00");
    expect(scheduleStatusLabel(scheduleAvailability({ courses }, exam, after, unavailable))).toBe("Busy outside class");
    expect(scheduleStatusLabel(scheduleAvailability({ courses }, exam, after))).toBe("Free now");
    expect(scheduleAvailability({ courses: { UNKNOWN: "A" } }, exam, after).state).toBe("unknown");
    expect(scheduleAvailability({ courses }, exam, null).state).toBe("unknown");
  });
  it("makes enrollment freshness explicit without treating local edits as authoritative source checks", () => {
    const now = new Date("2026-11-11T10:00:00Z");
    expect(friendScheduleFreshness({ updatedAt: now.toISOString() }, now)).toBe("unverified");
    expect(friendScheduleFreshness({ lastCheckedAt: null }, now)).toBe("unverified");
    expect(friendScheduleFreshness({ lastCheckedAt: "2026-11-09T10:00:00Z" }, now)).toBe("stale");
    expect(friendScheduleFreshness({ lastCheckedAt: "2026-11-11T09:00:00Z" }, now)).toBe("checked");
  });
});
