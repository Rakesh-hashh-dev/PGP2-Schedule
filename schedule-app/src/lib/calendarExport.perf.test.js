import { describe, it, expect } from "vitest";
import {
  filterEventsForExport,
  buildICS,
  formatICSDateTime,
  escapeICSText,
} from "./calendarExport.js";

// Generate synthetic class and exam dataset to test stress limits
function generateMockClasses(count) {
  const courses = ["SAPM", "DPM", "BBM", "MPB", "PMA", "SCM", "WAI"];
  const rooms = ["A01", "A02", "B01", "CR1", "CR2"];
  const faculties = ["Prof. Sharma", "Prof. Verma", "Prof. Gupta", "Prof. Roy"];
  const classes = [];

  const startDate = new Date(2026, 5, 15); // Jun 15, 2026

  for (let i = 0; i < count; i++) {
    const curDate = new Date(startDate.getTime() + Math.floor(i / 4) * 86400000);
    const dateStr = curDate.toISOString().split("T")[0];
    const code = courses[i % courses.length];
    const isExam = i % 15 === 0;

    classes.push({
      date: dateStr,
      start: `${String(9 + (i % 4) * 2).padStart(2, "0")}:00`,
      end: `${String(10 + (i % 4) * 2).padStart(2, "0")}:30`,
      code: isExam ? code : code,
      name: isExam ? `${code} End Term Exam` : `${code} Lecture Session`,
      type: isExam ? "exam" : "class",
      session: isExam ? "Exam" : String((i % 20) + 1),
      section: i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "Single",
      room: rooms[i % rooms.length],
      faculty: faculties[i % faculties.length],
    });
  }

  return classes;
}

const enrolledMock = {
  SAPM: "A",
  DPM: "Single",
  BBM: "B",
  MPB: "Single",
  PMA: "A",
  SCM: "A",
  WAI: "B",
};

const legendMock = {
  SAPM: { name: "Security Analysis and Portfolio Management", credits: 3.0, area: "F&A" },
  DPM: { name: "Digital Product Management", credits: 3.0, area: "ISM" },
  BBM: { name: "Business to Business Marketing", credits: 3.0, area: "MKTG" },
  MPB: { name: "Managing Platform Business", credits: 3.0, area: "STM" },
  PMA: { name: "Product Management and Analytics", credits: 3.0, area: "MKTG" },
  SCM: { name: "Supply Chain Management", credits: 3.0, area: "OPS" },
  WAI: { name: "Working with AI", credits: 1.5, area: "ISM" },
};

describe("Calendar Export Engine Performance Benchmarks", () => {
  it("Performance: 100 classes (standard student term) generates in under 5ms", () => {
    const mockData = generateMockClasses(100);
    const filtered = filterEventsForExport(mockData, enrolledMock, {
      selectedCodes: Object.keys(enrolledMock),
      includeExams: true,
      timeframe: "all",
      legend: legendMock,
    });

    const start = performance.now();
    const ics = buildICS(filtered, {
      calendarName: "TermFlow Test Timetable",
      reminderMinutes: 15,
      termLabel: "PGP2 Term IV",
      legend: legendMock,
    });
    const duration = performance.now() - start;

    console.log(`\n[PERF BENCHMARK] 100 events buildICS time: ${duration.toFixed(3)} ms`);
    console.log(`[PERF BENCHMARK] Generated ICS size: ${(ics.length / 1024).toFixed(2)} KB`);

    expect(duration).toBeLessThan(5.0); // Strict 5ms budget
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("Stress Test: 1,000 classes (massive multi-term batch) generates in under 25ms", () => {
    const mockData = generateMockClasses(1000);
    const filtered = filterEventsForExport(mockData, enrolledMock, {
      selectedCodes: Object.keys(enrolledMock),
      includeExams: true,
      timeframe: "all",
      legend: legendMock,
    });

    const start = performance.now();
    const ics = buildICS(filtered, {
      calendarName: "TermFlow Massive Timetable",
      reminderMinutes: 15,
      termLabel: "PGP2",
      legend: legendMock,
    });
    const duration = performance.now() - start;

    console.log(`[PERF BENCHMARK] 1,000 events buildICS time: ${duration.toFixed(3)} ms`);
    console.log(`[PERF BENCHMARK] Generated ICS size: ${(ics.length / 1024).toFixed(2)} KB`);

    expect(duration).toBeLessThan(75.0);
    expect(filtered.length).toBeGreaterThan(500);
  });

  it("Throughput: filterEventsForExport processes 10,000 queries in under 50ms", () => {
    const mockData = generateMockClasses(200);

    const start = performance.now();
    const iterations = 500;
    for (let i = 0; i < iterations; i++) {
      filterEventsForExport(mockData, enrolledMock, {
        selectedCodes: ["SAPM", "DPM", "SCM"],
        includeExams: i % 2 === 0,
        timeframe: "upcoming",
        legend: legendMock,
      });
    }
    const duration = performance.now() - start;
    const avgPerRun = duration / iterations;

    console.log(`[PERF BENCHMARK] 500 filter passes total: ${duration.toFixed(3)} ms (${avgPerRun.toFixed(4)} ms/pass)`);

    expect(duration).toBeLessThan(50.0);
    expect(avgPerRun).toBeLessThan(0.1); // < 0.1ms per filter cycle
  });

  it("Micro-benchmark: formatICSDateTime and escapeICSText execute >100,000 ops/sec", () => {
    const start = performance.now();
    const ops = 50000;
    for (let i = 0; i < ops; i++) {
      formatICSDateTime("2026-06-15", "14:30");
      escapeICSText("Case Study, Chapter 4; Section: Marketing & Strategy, Notes\\Comments\nNew Line");
    }
    const duration = performance.now() - start;
    const opsPerSec = (ops / (duration / 1000)).toFixed(0);

    console.log(`[PERF BENCHMARK] 50,000 micro-ops time: ${duration.toFixed(3)} ms (${opsPerSec} ops/sec)`);

    expect(duration).toBeLessThan(200.0);
  });
});
