import { describe, it, expect } from "vitest";
import {
  formatICSDateTime,
  formatUTCDateTime,
  escapeICSText,
  formatAlarmTrigger,
  buildAlarmComponent,
  buildVEvent,
  buildICS,
  filterEventsForExport,
  createGoogleCalendarUrl,
} from "./calendarExport.js";

describe("calendarExport", () => {
  describe("formatICSDateTime", () => {
    it("formats YYYY-MM-DD and HH:MM into YYYYMMDDTHHMMSS", () => {
      expect(formatICSDateTime("2026-06-15", "14:30")).toBe("20260615T143000");
      expect(formatICSDateTime("2026-09-04", "08:00")).toBe("20260904T080000");
    });

    it("returns empty string if date or time is missing", () => {
      expect(formatICSDateTime("", "14:30")).toBe("");
      expect(formatICSDateTime("2026-06-15", "")).toBe("");
    });
  });

  describe("formatUTCDateTime", () => {
    it("formats Date into UTC string YYYYMMDDTHHMMSSZ", () => {
      const d = new Date(Date.UTC(2026, 5, 15, 14, 30, 0));
      expect(formatUTCDateTime(d)).toBe("20260615T143000Z");
    });
  });

  describe("escapeICSText", () => {
    it("escapes semicolons, commas, backslashes, and newlines", () => {
      expect(escapeICSText("Hello, World; Testing\\Slash\nNext line")).toBe(
        "Hello\\, World\\; Testing\\\\Slash\\nNext line"
      );
    });

    it("handles null/undefined gracefully", () => {
      expect(escapeICSText(null)).toBe("");
      expect(escapeICSText(undefined)).toBe("");
    });
  });

  describe("formatAlarmTrigger & buildAlarmComponent", () => {
    it("formats alarm triggers correctly", () => {
      expect(formatAlarmTrigger(15)).toBe("-PT15M");
      expect(formatAlarmTrigger(30)).toBe("-PT30M");
      expect(formatAlarmTrigger(60)).toBe("-PT1H");
      expect(formatAlarmTrigger(120)).toBe("-PT2H");
    });

    it("builds VALARM block when reminderMinutes > 0", () => {
      const alarm = buildAlarmComponent(15, "Class Reminder");
      expect(alarm).toContain("BEGIN:VALARM");
      expect(alarm).toContain("ACTION:DISPLAY");
      expect(alarm).toContain("TRIGGER:-PT15M");
      expect(alarm).toContain("END:VALARM");
    });

    it("returns empty string when reminderMinutes is 0 or negative", () => {
      expect(buildAlarmComponent(0)).toBe("");
      expect(buildAlarmComponent(-5)).toBe("");
    });
  });

  describe("buildVEvent", () => {
    const mockClass = {
      date: "2026-06-15",
      start: "14:30",
      end: "16:00",
      type: "class",
      code: "SAPM",
      session: "1",
      name: "Security Analysis and Portfolio Management",
      faculty: "Prof. Soumya Guha Deb",
      room: "A01",
      section: "A",
    };

    const mockLegend = {
      SAPM: {
        name: "Security Analysis and Portfolio Management",
        credits: "3",
        area: "F&A",
      },
    };

    it("generates a valid VEVENT for a class", () => {
      const vevent = buildVEvent(mockClass, { reminderMinutes: 15, legend: mockLegend });
      expect(vevent).toContain("BEGIN:VEVENT");
      expect(vevent).toContain("UID:2026-06-15-1430-SAPM-1-termflow@iimsambalpur.ac.in");
      expect(vevent).toContain("DTSTART;TZID=Asia/Kolkata:20260615T143000");
      expect(vevent).toContain("DTEND;TZID=Asia/Kolkata:20260615T160000");
      expect(vevent).toContain("SUMMARY:[SAPM] Security Analysis and Portfolio Management · S1");
      expect(vevent).toContain("LOCATION:A01\\, IIM Sambalpur");
      expect(vevent).toContain("DESCRIPTION:Course: Security Analysis and Portfolio Management (SAPM)");
      expect(vevent).toContain("BEGIN:VALARM");
      expect(vevent).toContain("TRIGGER:-PT15M");
      expect(vevent).toContain("END:VEVENT");
    });

    it("generates a valid VEVENT for an exam", () => {
      const mockExam = {
        date: "2026-07-20",
        start: "10:00",
        end: "12:00",
        type: "exam",
        code: "SAPM",
        session: "",
        name: "SAPM Mid Term Exam",
        faculty: "",
        room: "A01",
        section: "A",
      };

      const vevent = buildVEvent(mockExam, { reminderMinutes: 30, legend: mockLegend });
      expect(vevent).toContain("BEGIN:VEVENT");
      expect(vevent).toContain("SUMMARY:[SAPM] SAPM Mid Term Exam");
      expect(vevent).toContain("DTSTART;TZID=Asia/Kolkata:20260720T100000");
      expect(vevent).toContain("TRIGGER:-PT30M");
      expect(vevent).toContain("END:VEVENT");
    });
  });

  describe("buildICS", () => {
    it("wraps events in valid VCALENDAR envelope with VTIMEZONE", () => {
      const events = [
        {
          date: "2026-06-15",
          start: "14:30",
          end: "16:00",
          type: "class",
          code: "SAPM",
          session: "1",
          name: "SAPM",
          room: "A01",
        },
      ];

      const ics = buildICS(events, { calendarName: "My PGP2 Timetable", reminderMinutes: 15 });
      expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
      expect(ics).toContain("X-WR-CALNAME:My PGP2 Timetable");
      expect(ics).toContain("BEGIN:VTIMEZONE");
      expect(ics).toContain("TZID:Asia/Kolkata");
      expect(ics).toContain("BEGIN:VEVENT");
      expect(ics).toContain("END:VEVENT");
      expect(ics).toContain("END:VCALENDAR");
    });
  });

  describe("filterEventsForExport", () => {
    const sampleClasses = [
      { date: "2026-06-15", start: "14:30", end: "16:00", type: "class", code: "SAPM", section: "A", name: "SAPM" },
      { date: "2026-06-15", start: "16:30", end: "18:00", type: "class", code: "SAPM", section: "B", name: "SAPM" },
      { date: "2026-06-15", start: "18:30", end: "20:00", type: "class", code: "CS", section: "A", name: "CS" },
      { date: "2026-06-16", start: "10:00", end: "11:30", type: "class", code: "DVB", section: "Single", name: "DVB" },
      { date: "2026-07-20", start: "10:00", end: "12:00", type: "exam", code: "SAPM", section: "A", name: "SAPM Mid Term Exam" },
      { date: "2026-07-21", start: "10:00", end: "12:00", type: "exam", code: "BM", section: "A", name: "BM Mid Term Exam" },
    ];

    const enrolled = { SAPM: "A", CS: "A" };
    const legend = {
      SAPM: { name: "Security Analysis and Portfolio Management" },
      CS: { name: "Corporate Strategy" },
      DVB: { name: "Data Visualization" },
      BM: { name: "Brand Management" },
    };

    it("filters only enrolled subjects and matching sections for full term", () => {
      const filtered = filterEventsForExport(sampleClasses, enrolled, {
        timeframe: "all",
        includeExams: false,
        includeClasses: true,
        legend,
      });

      expect(filtered.length).toBe(2);
      expect(filtered.map((c) => c.code)).toEqual(["SAPM", "CS"]);
      // Section B of SAPM must be excluded
      expect(filtered.find((c) => c.section === "B")).toBeUndefined();
    });

    it("filters specific subjects when selectedCodes is provided", () => {
      const filtered = filterEventsForExport(sampleClasses, enrolled, {
        selectedCodes: ["SAPM"],
        timeframe: "all",
        includeExams: false,
        legend,
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].code).toBe("SAPM");
    });

    it("includes exams matching enrolled subjects", () => {
      const filtered = filterEventsForExport(sampleClasses, enrolled, {
        timeframe: "all",
        includeExams: true,
        includeClasses: false,
        legend,
      });

      // SAPM exam is enrolled; BM exam is not
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe("SAPM Mid Term Exam");
    });
  });

  describe("createGoogleCalendarUrl", () => {
    it("generates a valid web URL for Google Calendar", () => {
      const ev = {
        date: "2026-06-15",
        start: "14:30",
        end: "16:00",
        type: "class",
        code: "SAPM",
        session: "1",
        name: "Security Analysis and Portfolio Management",
        faculty: "Prof. Soumya Guha Deb",
        room: "A01",
        section: "A",
      };

      const url = createGoogleCalendarUrl(ev);
      expect(url).toContain("https://calendar.google.com/calendar/render");
      expect(url).toContain("dates=20260615T143000%2F20260615T160000");
      expect(url).toContain("ctz=Asia%2FKolkata");
      expect(url).toContain("SAPM");
    });
  });
});
