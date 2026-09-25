import { describe, expect, it } from "vitest";
import { buildAttendanceForecast, buildAttendanceScenario, buildDailyBrief, buildPlannerInsights, buildWeeklyPlanner, findFreeWindows, flattenAssignments } from "./studentPlanner.js";
import { sessionKey } from "./attendance.js";

const now = new Date(2026, 8, 20, 10, 0);
const classes = [
  { type: "class", date: "2026-09-19", start: "09:00", end: "10:00", code: "A", section: "Single" },
  { type: "class", date: "2026-09-20", start: "11:00", end: "12:00", code: "A", section: "Single" },
  { type: "class", date: "2026-09-21", start: "09:00", end: "10:00", code: "A", section: "Single" },
];

describe("student planner", () => {
  it("classifies assignment urgency without changing source data", () => {
    const source = { A: [{ id: "1", title: "Case", dueDate: "2026-09-20", completed: false }] };
    expect(flattenAssignments(source, { A: { name: "Analytics" } }, now)[0]).toMatchObject({ urgency: "today", courseName: "Analytics" });
    expect(source.A[0]).not.toHaveProperty("urgency");
  });

  it("projects attendance and recovery after planned misses", () => {
    const attendance = { [sessionKey(classes[0])]: "present" };
    const result = buildAttendanceForecast({ allClasses: classes, enrolled: { A: "Single" }, attendance, legend: {}, now, plannedMisses: { A: 1 } })[0];
    expect(result.currentPct).toBe(100);
    expect(result.projectedPct).toBe(50);
    expect(result.recoveryNeeded).toBe(3);
  });

  it("finds free windows around scheduled sessions", () => {
    const free = findFreeWindows(classes, now, 1, 60);
    expect(free.map((slot) => [slot.start, slot.end])).toEqual([[600, 660], [720, 1320]]);
  });

  it("builds a brief from current classes, deadlines and changes", () => {
    const forecast = [{ code: "A", risk: "watch" }];
    const brief = buildDailyBrief({ today: classes.filter((item) => item.date === "2026-09-20"), tomorrow: [], assignments: { A: [{ dueDate: "2026-09-21" }] }, changes: [{ date: "2026-09-21" }], attendanceForecast: forecast, now });
    expect(brief.nextClass.code).toBe("A");
    expect(brief.tasks).toHaveLength(1);
    expect(brief.risks).toHaveLength(1);
  });

  it("derives private insights locally", () => {
    const result = buildPlannerInsights({ visible: classes, assignments: { A: [{ completed: true }, { completed: false, dueDate: "2026-09-22" }] }, attendanceForecast: [{ currentPct: 80, risk: "safe" }], now });
    expect(result.completionRate).toBe(50);
    expect(result.dueThisWeek).toBe(1);
    expect(result.averageAttendance).toBe(80);
  });

  it("compares attendance outcomes for the selected number of future sessions", () => {
    expect(buildAttendanceScenario({ present: 3, marked: 4, currentPct: 75, plannedMisses: 2, upcoming: 4 }))
      .toEqual({ count: 2, attendPct: 83, missPct: 50 });
    expect(buildAttendanceScenario({ present: 3, marked: 4, currentPct: 75, plannedMisses: 0, upcoming: 4 }))
      .toEqual({ count: 0, attendPct: 75, missPct: 75 });
  });

  it("groups the next seven days without treating unestimated tasks as zero-effort work", () => {
    const week = buildWeeklyPlanner({
      visible: classes,
      assignments: { A: [
        { id: "case", dueDate: "2026-09-21", completed: false },
        { id: "quiz", dueDate: "2026-09-21", completed: false },
        { id: "done", dueDate: "2026-09-22", completed: true },
      ] },
      effort: { case: 90 },
      now,
    });
    expect(week.days).toHaveLength(7);
    expect(week.days[1]).toMatchObject({ date: "2026-09-21", classMinutes: 60, estimatedMinutes: 90, dueCount: 2 });
    expect(week.estimatedMinutes).toBe(90);
    expect(week.dueCount).toBe(2);
    expect(week.unestimatedCount).toBe(1);
  });
});
