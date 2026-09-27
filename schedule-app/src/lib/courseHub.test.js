import { describe, expect, it } from "vitest";
import { buildCourseHub, courseAttention, courseJourney, courseWeeklyLoad, examCourseCode, nextReviewDate, reviewQueue } from "./courseHub.js";
import { mergeCourseHubItems } from "./courseHubStore.js";

const now = new Date(2026, 8, 25, 10, 0);
const sessions = [
  { type: "class", code: "AAIM", section: "A01", date: "2026-09-24", start: "09:00", end: "10:30" },
  { type: "class", code: "AAIM", section: "A01", date: "2026-09-26", start: "11:00", end: "12:30", room: "A02" },
  { type: "class", code: "AAIM", section: "B01", date: "2026-09-27", start: "11:00", end: "12:30" },
  { type: "exam", code: "", name: "AAIM MID Term Exam", date: "2026-10-01", start: "14:00", end: "15:00" },
  { type: "exam", code: "", name: "END Term", date: "2026-10-02", start: "14:00", end: "15:00" },
];

describe("Course Hub data", () => {
  it("uses the enrolled section and attaches only a reliably matched exam", () => {
    const [course] = buildCourseHub({ allClasses: sessions, enrolled: { AAIM: "A01" }, legend: { AAIM: { name: "Agentic AI", credits: "3" } },
      attendance: { "2026-09-24_09:00_AAIM_A01": "present" }, assignments: { AAIM: [{ id: "a", title: "Case", dueDate: "2026-09-28", completed: false }] }, now });
    expect(course.sessions).toHaveLength(2);
    expect(course.nextClass.date).toBe("2026-09-26");
    expect(course.exams).toHaveLength(1);
    expect(course.stats.pct).toBe(100);
    expect(course.coverage).toBe(100);
    expect(course.openTasks).toHaveLength(1);
    expect(examCourseCode(sessions[4], ["AAIM"])).toBeNull();
  });

  it("groups four weeks of course events and estimated load", () => {
    const [course] = buildCourseHub({ allClasses: sessions, enrolled: { AAIM: "A01" }, legend: { AAIM: { name: "Agentic AI", credits: "3" } },
      assignments: { AAIM: [{ id: "a", title: "Case", dueDate: "2026-09-28", completed: false }] }, now });
    expect(courseJourney(course, now).map((event) => event.kind)).toEqual(["class", "task", "exam"]);
    const weeks = courseWeeklyLoad(course, { a: 90 }, now);
    expect(weeks).toHaveLength(4);
    expect(weeks[0]).toMatchObject({ classMinutes: 90, estimatedMinutes: 90, examCount: 1 });
  });

  it("surfaces urgent work and past classes missing attendance", () => {
    const [course] = buildCourseHub({ allClasses: sessions, enrolled: { AAIM: "A01" }, legend: { AAIM: { name: "Agentic AI", credits: "3" } },
      assignments: { AAIM: [{ id: "a", title: "Case", dueDate: "2026-09-26", completed: false }] }, now });
    expect(courseAttention(course, now)).toMatchObject({ kind: "task", label: "Assignment due soon" });
    expect(courseAttention({ ...course, openTasks: [] }, now)).toMatchObject({ kind: "attendance", label: "1 class unmarked" });
  });

  it("queues flagged topics and spaces successful reviews", () => {
    const topic = { id: "t", title: "Pricing", details: { flagged: true, reviewAt: "2026-09-25", reviewStep: 0 } };
    expect(reviewQueue([topic, { id: "x", title: "Other", details: {} }], now).map((item) => item.id)).toEqual(["t"]);
    expect(nextReviewDate(now, 0, true)).toEqual({ reviewAt: "2026-09-28", reviewStep: 1 });
    expect(nextReviewDate(now, -1, true)).toEqual({ reviewAt: "2026-09-26", reviewStep: 0 });
    expect(nextReviewDate(now, 2, false)).toEqual({ reviewAt: "2026-09-26", reviewStep: 0 });
  });
});

it("keeps unsynced device edits when cloud data is older", () => {
  const local = [{ id: "x", title: "New title", updatedAt: 2, pending: true }];
  const remote = [{ id: "x", title: "Old title", updatedAt: 1 }];
  expect(mergeCourseHubItems(local, remote)[0].title).toBe("New title");
});
