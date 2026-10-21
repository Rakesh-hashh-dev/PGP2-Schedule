import { describe, expect, it } from "vitest";
import { normalizeScheduleBreak, timelineActivitySummary } from "./scheduleBreaks.js";

describe("meal break schedule semantics", () => {
  const lunch = { type: "break", name: "Lunch\nBreak", start: "13:30", end: "14:30" };
  const morning = { type: "class", name: "Finance", start: "09:00", end: "10:30" };
  it("excludes lunch from counts, upcoming activity, day range and completion", () => {
    const summary = timelineActivitySummary([morning, lunch], 11 * 60);
    expect(summary).toMatchObject({ classCount: 1, completedClasses: 1, nextIndex: -1, firstStart: "09:00", lastEnd: "10:30", allDone: true });
    expect(summary.activities).toEqual([morning]);
  });
  it("keeps a lunch-only day free of activities", () => {
    expect(timelineActivitySummary([lunch], 8 * 60)).toMatchObject({ activities: [], classCount: 0, nextIndex: -1, firstStart: null, lastEnd: null, allDone: false });
  });
  it("repairs lunch incorrectly classified as a class or exam without changing real classes", () => {
    expect(normalizeScheduleBreak({ ...lunch, type: "class", code: "LUNCH", session: "1" })).toMatchObject({ type: "break", code: "", session: "" });
    expect(normalizeScheduleBreak({ ...lunch, type: "exam" }).type).toBe("break");
    expect(normalizeScheduleBreak(morning)).toBe(morning);
  });
  it("retains actual non-teaching activities while excluding breaks", () => {
    const event = { type: "event", name: "Club meetup", start: "17:00", end: "18:00" };
    expect(timelineActivitySummary([lunch, event], 12 * 60)).toMatchObject({ activities: [event], classCount: 0, nextIndex: 1, firstStart: "17:00", lastEnd: "18:00" });
  });
  it("keeps cancelled classes out of activity counts and upcoming status", () => {
    const cancelled = { ...morning, type: "cancelled", start: "17:00", end: "18:30" };
    expect(timelineActivitySummary([morning, cancelled], 11 * 60)).toMatchObject({ activities: [morning], classCount: 1, nextIndex: -1, firstStart: "09:00", lastEnd: "10:30", allDone: true });
    expect(timelineActivitySummary([cancelled], 8 * 60)).toMatchObject({ activities: [], classCount: 0, nextIndex: -1 });
  });
});
