import { describe, expect, it } from "vitest";
import {
  attendanceCourseState,
  attendanceCoverage,
  attendanceRequirement,
  groupPendingSessions,
  sessionsToRecover,
  sortAttendanceCourses,
} from "./attendanceWorkspace.js";

function course(overrides = {}) {
  return {
    code: "TEST",
    present: 8,
    absent: 2,
    unmarked: 0,
    total: 10,
    pct: 80,
    requiredPct: 80,
    totalAllowedSkips: 2,
    skipsRemaining: 0,
    penaltyHit: false,
    ...overrides,
  };
}

describe("attendance workspace", () => {
  it("separates marking coverage from attendance rate", () => {
    expect(attendanceCoverage({ present: 1, absent: 0, total: 23 })).toBe(4);
  });

  it("uses the higher requirement for zero-credit courses", () => {
    expect(attendanceRequirement(0)).toBe(90);
    expect(attendanceRequirement("0")).toBe(90);
    expect(attendanceRequirement(3)).toBe(80);
  });

  it("calculates how many consecutive sessions are needed to recover", () => {
    expect(sessionsToRecover(7, 3, 80)).toBe(5);
    expect(sessionsToRecover(8, 2, 80)).toBe(0);
    expect(sessionsToRecover(8, 2, 90)).toBe(10);
  });

  it("prioritizes below-target courses over incomplete records", () => {
    const below = course({ code: "LOW", present: 7, absent: 3, pct: 70, skipsRemaining: 2 });
    const incomplete = course({ code: "OPEN", present: 0, absent: 0, pct: null, unmarked: 4, skipsRemaining: 2 });
    const sorted = sortAttendanceCourses([incomplete, below]);
    expect(sorted.map((item) => item.code)).toEqual(["LOW", "OPEN"]);
    expect(attendanceCourseState(below).detail).toBe("Attend the next 5 sessions to recover");
  });

  it("groups pending sessions newest first", () => {
    const grouped = groupPendingSessions([
      { key: "a", date: "2026-09-18", start: "08:00" },
      { key: "c", date: "2026-09-19", start: "10:00" },
      { key: "b", date: "2026-09-19", start: "08:00" },
    ]);
    expect(grouped.map((group) => group.date)).toEqual(["2026-09-19", "2026-09-18"]);
    expect(grouped[0].sessions.map((session) => session.key)).toEqual(["c", "b"]);
  });
});
