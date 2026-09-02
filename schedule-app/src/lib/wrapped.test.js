import { describe, expect, it } from "vitest";
import { sessionKey } from "./attendance.js";
import { buildWrapped, buildWrappedComparison } from "./wrapped.js";

function cls(date, code, start, extra = {}) {
  return {
    type: "class",
    date,
    code,
    name: code,
    section: "Single",
    start,
    end: extra.end || endTime(start),
    session: extra.session || "Class",
    ...extra,
  };
}

function endTime(start) {
  const [hour, minute] = start.split(":").map(Number);
  const total = hour * 60 + minute + 90;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function mark(rows, statuses) {
  return Object.fromEntries(statuses.map(([index, status]) => [sessionKey(rows[index]), status]));
}

const held = [
  cls("2026-08-03", "A", "08:00"),
  cls("2026-08-04", "B", "13:00"),
  cls("2026-08-05", "A", "18:00"),
  cls("2026-08-10", "A", "08:00"),
  cls("2026-08-11", "B", "13:00"),
  cls("2026-08-12", "A", "18:00"),
  cls("2026-08-17", "A", "08:00"),
  cls("2026-08-18", "B", "13:00"),
  cls("2026-08-19", "A", "18:00"),
  cls("2026-08-24", "A", "08:00"),
  cls("2026-08-25", "B", "13:00"),
  cls("2026-08-31", "A", "08:00"),
];

const attendance = mark(held, [
  [0, "present"],
  [1, "absent"],
  [2, "present"],
  [3, "present"],
  [4, "present"],
  // index 5 intentionally unmarked
  [6, "present"],
  [7, "present"],
  [8, "present"],
  [9, "absent"],
  [10, "present"],
  [11, "present"],
]);

const legend = {
  A: { name: "Alpha Strategy" },
  B: { name: "Beta Markets" },
};

describe("buildWrapped", () => {
  it("returns null until ten regular sessions have finished", () => {
    expect(buildWrapped(held.slice(0, 9), legend, {}, new Date(2026, 7, 31, 12), { includeLocalExtras: false })).toBeNull();
  });

  it("excludes exams, exam-like classes, future sessions, and classes still in progress", () => {
    const rows = [
      ...held,
      { ...cls("2026-08-20", "A", "10:00"), type: "exam" },
      cls("2026-08-21", "A", "10:00", { session: "Quiz 1" }),
      cls("2026-08-31", "B", "11:30", { end: "13:00" }),
      cls("2026-09-01", "B", "08:00"),
    ];
    const result = buildWrapped(rows, legend, attendance, new Date(2026, 7, 31, 12), { includeLocalExtras: false });

    expect(result.heldSessions).toBe(12);
    expect(result.totalHours).toBe(18);
    expect(result.examsTaken).toBe(2);
  });

  it("separates attendance rate from marking coverage", () => {
    const result = buildWrapped(held, legend, attendance, new Date(2026, 7, 31, 12), { includeLocalExtras: false });

    expect(result.attendance).toEqual({
      present: 9,
      absent: 2,
      unmarked: 1,
      marked: 11,
      pct: 82,
      coveragePct: 92,
    });
    expect(result.longestPresentStreak).toEqual({
      count: 3,
      startISO: "2026-08-05",
      endISO: "2026-08-11",
    });
  });

  it("builds sorted weekly and course datasets", () => {
    const result = buildWrapped(held, legend, attendance, new Date(2026, 7, 31, 12), { includeLocalExtras: false });

    expect(result.weeklyLoad.map((week) => week.sessions)).toEqual([3, 3, 3, 2, 1]);
    expect(result.weeklyLoad.map((week) => week.hours)).toEqual([4.5, 4.5, 4.5, 3, 1.5]);
    expect(result.courses.map((course) => [course.code, course.name, course.held, course.hours])).toEqual([
      ["A", "Alpha Strategy", 8, 12],
      ["B", "Beta Markets", 4, 6],
    ]);
    expect(result.topCourse).toEqual({ code: "A", name: "Alpha Strategy", hrs: 12 });
    expect(result.courses[0].sessions).toHaveLength(8);
    expect(result.courses[0].weeks.map((week) => week.sessions)).toEqual([2, 2, 2, 1, 1]);
    expect(result.courses[0].peakWeek).toMatchObject({ hours: 3, sessions: 2 });
    expect(result.weeklyLoad[0].events).toHaveLength(3);
    expect(result.weeklyLoad[0].busiestDay).toMatchObject({ sessions: 1, hours: 1.5 });
  });

  it("adds interpretable patterns and attendance confidence", () => {
    const result = buildWrapped(held, legend, attendance, new Date(2026, 7, 31, 12), { includeLocalExtras: false });

    expect(result.confidence).toMatchObject({ level: "high", label: "High confidence" });
    expect(result.archetype).toMatchObject({ id: "morning", title: "Morning Sprinter" });
    expect(result.earlyStarts).toBe(5);
    expect(result.averageWeeklyHours).toBe(3.6);
    expect(result.insights.map((insight) => insight.id)).toEqual(["rhythm", "peak", "attendance"]);
  });

  it("labels sparse attendance evidence as limited confidence", () => {
    const result = buildWrapped(held, legend, mark(held, [[0, "present"]]), new Date(2026, 7, 31, 12), { includeLocalExtras: false });
    expect(result.confidence.level).toBe("low");
    expect(result.attendance.coveragePct).toBe(8);
  });

  it("fills empty weeks so the workload graph keeps a truthful time axis", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => cls("2026-08-03", "A", `${String(8 + i).padStart(2, "0")}:00`)),
      ...Array.from({ length: 5 }, (_, i) => cls("2026-08-17", "A", `${String(8 + i).padStart(2, "0")}:00`)),
    ];
    const result = buildWrapped(rows, legend, {}, new Date(2026, 7, 31, 12), { includeLocalExtras: false });

    expect(result.weeklyLoad.map((week) => week.sessions)).toEqual([5, 0, 5]);
  });

  it("groups the weekly rhythm by weekday and time band", () => {
    const result = buildWrapped(held, legend, attendance, new Date(2026, 7, 31, 12), { includeLocalExtras: false });
    const [morning, afternoon, evening] = result.rhythm.rows;

    expect(morning.cells[0].sessions).toBe(5); // Monday mornings
    expect(afternoon.cells[1].sessions).toBe(4); // Tuesday afternoons
    expect(evening.cells[2].sessions).toBe(3); // Wednesday evenings
    expect(result.rhythm.busiest).toMatchObject({ day: "Mon", bandId: "morning", sessions: 5 });
  });

  it("falls back to the course code when legend metadata is missing", () => {
    const result = buildWrapped(held, {}, attendance, new Date(2026, 7, 31, 12), { includeLocalExtras: false });
    expect(result.courses[0].name).toBe("A");
  });

  it("does not mix current local extras into an archived-term recap", () => {
    const result = buildWrapped(held, legend, attendance, new Date(2026, 7, 31, 12), { includeLocalExtras: false });
    expect(result.assignmentsTotal).toBe(0);
    expect(result.likedDishes).toEqual([]);
    expect(result.favouriteCount).toBe(0);
  });
});

describe("buildWrappedComparison", () => {
  it("compares workload and only includes attendance when both terms have evidence", () => {
    const current = buildWrapped(held, legend, attendance, new Date(2026, 7, 31, 12), { includeLocalExtras: false });
    const previous = { ...current, totalHours: 15, attendancePct: 75, absent: 3, earlyStarts: 7, busiestWeek: { hours: 6 }, marked: 10 };
    const comparison = buildWrappedComparison(current, previous, "Term V", "Term IV");

    expect(comparison).toMatchObject({ currentLabel: "Term V", previousLabel: "Term IV" });
    expect(comparison.metrics.find((metric) => metric.id === "hours")).toMatchObject({ current: 18, previous: 15, delta: 3, unit: "h" });
    expect(comparison.metrics.find((metric) => metric.id === "attendance")).toMatchObject({ delta: 7, unit: "%", deltaUnit: "pp" });
    expect(comparison.metrics.find((metric) => metric.id === "early")).toMatchObject({ delta: -2, lowerIsBetter: true });

    const noPriorMarks = buildWrappedComparison(current, { ...previous, marked: 0, attendancePct: null }, "Term V", "Term IV");
    expect(noPriorMarks.metrics.map((metric) => metric.id)).not.toContain("attendance");
    expect(noPriorMarks.metrics.map((metric) => metric.id)).not.toContain("skips");
  });
});
