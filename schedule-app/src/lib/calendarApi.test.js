import { describe, expect, it } from "vitest";
import { buildCalendar, calendarEvents, validCalendarQuery } from "../../api/calendar.js";

describe("live calendar endpoint", () => {
  const payload = { CLASSES: [
    { date: "2026-10-01", code: "CRM", section: "Single", start: "10:00", end: "11:30", type: "class", name: "CRM" },
    { date: "2026-10-01", code: "ECOM", section: "B", start: "12:00", end: "13:30", type: "exam", name: "Exam" },
  ] };

  it("filters by course, section and event type", () => {
    expect(calendarEvents(payload, { courses: "CRM,ECOM", sections: "ECOM:A", exams: "0" })).toHaveLength(1);
  });

  it("creates a valid calendar with a reminder", () => {
    const ics = buildCalendar(payload.CLASSES.slice(0, 1), { reminder: "30" });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain("DTSTART;TZID=Asia/Kolkata:20261001T100000");
  });

  it("rejects empty, oversized and malformed subscription options", () => {
    expect(validCalendarQuery({ courses: "CRM,ECOM", sections: "ECOM:A", reminder: "30" })).toBe(true);
    expect(validCalendarQuery({ courses: "" })).toBe(false);
    expect(validCalendarQuery({ courses: "CRM<script>" })).toBe(false);
    expect(validCalendarQuery({ courses: Array.from({ length: 33 }, (_, index) => `C${index}`).join(",") })).toBe(false);
    expect(validCalendarQuery({ courses: "CRM", reminder: "99999" })).toBe(false);
  });
});
