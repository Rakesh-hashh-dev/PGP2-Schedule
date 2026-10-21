import { describe, expect, it, vi } from "vitest";
vi.mock("./supabase.js", () => ({ supabase: {} }));
import { buildOccurrences, findPlanConflicts, sharedTimeSuggestions, scheduleAvailability, hasKnownSchedule } from "./socialPlanning.js";
const session = (date, start, end, code = "PM", section = "A") => ({ type: "class", date, start, end, code, section });
const courses = { PM: "A" };
const allClasses = [session("2026-10-08", "09:00", "10:00"), session("2026-10-15", "09:00", "10:00"), session("2026-10-08", "12:00", "13:00", "FIN")];

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
    expect(slots[0].start).toBe("10:15"); expect(slots.every(s => s.end <= "22:00" && s.memberCloudIds.length === 1 && s.memberCloudIds[0] === "one")).toBe(true);
  });
  it("counts an invite member already represented as a friend once", () => {
    const friends = [{ id: "1", cloudId: "one", name: "Meera", courses }, { id: "2", cloudId: "two", name: "Aarav", courses }];
    const groups = [{ id: "g", name: "Circle", memberIds: ["1", "2"], inviteMembers: [{ userId: "one" }] }];
    const suggestions = sharedTimeSuggestions({ enrolled: courses, allClasses, friends, groups, now: new Date("2026-10-08T10:00:00") });
    expect(suggestions.find(s => s.groupId === "g").memberCloudIds).toEqual(["one", "two"]);
  });
  it("separates timetable gaps from explicit availability and expiry", () => {
    const now = new Date("2026-10-08T10:00:00"); const friend = { courses };
    expect(scheduleAvailability(friend, allClasses, now).state).toBe("free");
    expect(scheduleAvailability(friend, allClasses, now, { status: { availability: "available", until: "2026-10-08T11:00:00" } }).state).toBe("available");
    expect(scheduleAvailability(friend, allClasses, now, { status: { availability: "available", until: "2026-10-08T09:59:00" } }).state).toBe("free");
    expect(scheduleAvailability({ courses: {} }, allClasses, now)).toBeNull();
    expect(scheduleAvailability(friend, allClasses, now, { status: { availability: "unavailable", until: "2026-10-08T11:00:00" } }).state).toBe("unavailable");
  });
  it("prioritizes known class commitments and away windows over available status", () => {
    const now = new Date("2026-10-08T09:30:00"); const status = { availability: "available", until: "2026-10-08T11:00:00" };
    expect(scheduleAvailability({ courses }, allClasses, now, { status }).state).toBe("busy");
    expect(scheduleAvailability({ courses }, allClasses, now, { status, away: { from: "2026-10-08", to: "2026-10-08" } }).state).toBe("away");
  });
});