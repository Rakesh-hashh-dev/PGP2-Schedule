import { describe, it, expect } from "vitest";
import { isExamSession, courseSkipStats, sessionKey } from "./attendance.js";

describe("attendance isExamSession", () => {
  it("recognizes exam by type: exam", () => {
    expect(isExamSession({ type: "exam", code: "SOM", date: "2026-12-11" })).toBe(true);
  });

  it("recognizes Mid Term variants in session label", () => {
    expect(isExamSession({ type: "class", session: "MID TERM", code: "SCA" })).toBe(true);
    expect(isExamSession({ type: "class", session: "mid-term", code: "SOM" })).toBe(true);
    expect(isExamSession({ type: "class", session: "Midterm exam", code: "CBM" })).toBe(true);
    expect(isExamSession({ type: "class", session: "Quiz 2", code: "EF" })).toBe(true);
  });

  it("recognizes Mid Term or End Term in name", () => {
    expect(isExamSession({ type: "class", name: "SOM End-Term Exam", session: "", code: "SOM" })).toBe(true);
    expect(isExamSession({ type: "class", name: "SCA Mid Term Exam", session: "", code: "SCA" })).toBe(true);
  });

  it("recognizes End Term examination window (from Dec 11) even if session is blank", () => {
    // 2026-12-11 SOM Afternoon slot (14:30-20:00, slot 4)
    expect(isExamSession({
      date: "2026-12-11",
      day: "Fri",
      section: "Single",
      slot: 4,
      start: "14:30",
      end: "20:00",
      type: "class",
      code: "SOM",
      session: "",
      name: "Service Operations Management",
    })).toBe(true);

    // 2026-12-12 SDM Morning slot (08:00-13:30, slot 0)
    expect(isExamSession({
      date: "2026-12-12",
      day: "Sat",
      section: "Single",
      slot: 0,
      start: "08:00",
      end: "13:30",
      type: "class",
      code: "SDM",
      session: "",
      name: "Sales & Distribution Management",
    })).toBe(true);
  });

  it("does not classify regular teaching classes before Dec 11 as exams", () => {
    expect(isExamSession({
      date: "2026-12-10",
      slot: 0,
      start: "08:00",
      end: "09:30",
      type: "class",
      code: "SP",
      session: "9 (Prof. V.G Venkatesh)",
      name: "Strategic Procurement",
    })).toBe(false);

    expect(isExamSession({
      date: "2026-11-20",
      slot: 1,
      start: "10:00",
      end: "11:30",
      type: "class",
      code: "CRM",
      session: "14",
      name: "Customer Relationship Marketing",
    })).toBe(false);
  });

  it("excludes End Term exams from courseSkipStats scheduled count", () => {
    const classes = [
      { date: "2026-11-10", slot: 1, start: "10:00", end: "11:30", type: "class", code: "SOM", section: "Single", session: "1" },
      { date: "2026-11-12", slot: 1, start: "10:00", end: "11:30", type: "class", code: "SOM", section: "Single", session: "2" },
      // End term exam on Dec 11
      { date: "2026-12-11", slot: 4, start: "14:30", end: "20:00", type: "class", code: "SOM", section: "Single", session: "" },
    ];
    const stats = courseSkipStats(classes, "SOM", "Single", {}, { credits: 3 });
    // Total scheduled classes should be 2, NOT 3
    expect(stats.totalScheduled).toBe(2);
  });
});
