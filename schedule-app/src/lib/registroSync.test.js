import { describe, it, expect } from "vitest";
import {
  resolveTermFlowCourseCode,
  parseRegistroPaste,
  encodeRegistroSyncPayload,
  decodeRegistroSyncPayload,
  parseRegistroBookmarkletPayload,
  getPendingFeedbackCourses,
  buildRegistroBookmarklet,
} from "./registroSync.js";

const SAMPLE_LEGEND = {
  DSC: { name: "Digital Supply Chain", credits: "3", area: "OPS" },
  SP: { name: "Strategic Procurement", credits: "1.5", area: "OPS" },
  FMCG: { name: "FMCG Marketing", credits: "1.5", area: "MKTG" },
  CRM: { name: "Customer Relationship Marketing & \nCustomer Analytics", credits: "3", area: "MKTG" },
};

const SAMPLE_CLASSES = [
  { date: "2026-09-07", start: "18:30", end: "20:00", type: "class", code: "DSC", section: "Single", name: "Digital Supply Chain" },
  { date: "2026-09-12", start: "18:30", end: "20:00", type: "class", code: "FMCG", section: "B", name: "FMCG Marketing" },
  { date: "2026-09-13", start: "18:30", end: "20:00", type: "class", code: "FMCG", section: "B", name: "FMCG Marketing" },
  { date: "2026-12-12", start: "08:00", end: "13:30", type: "exam", code: "DSC", section: "Single", name: "End Term Exam" },
];

const SAMPLE_ENROLLED = { DSC: "Single", FMCG: "B", SP: "A" };

describe("registroSync", () => {
  it("resolves Registro course code aliases (e.g. DSYC) via course title to TermFlow code (DSC)", () => {
    expect(resolveTermFlowCourseCode("DSYC", "Digital Supply Chain", SAMPLE_LEGEND)).toBe("DSC");
    expect(resolveTermFlowCourseCode("SP", "Strategic Procurement", SAMPLE_LEGEND)).toBe("SP");
    expect(resolveTermFlowCourseCode("FMCG", "FMCG Marketing", SAMPLE_LEGEND)).toBe("FMCG");
  });

  it("parses copied Term Summary table including empty Attendance Grade Drop cells and feedback flags", () => {
    const pasted = [
      "S.N",
      "o\tCourse Title\tCode\tTotal Sessions\tAttendance Given\tPresent\tAbsent\tAttendance %\tAttendance Grade Drop\tIs Feedback Given\tFeedback Grade Drop\tTotal Grade Drop",
      "1\tDigital Supply Chain (A)\tDSYC\t20\t14\t10\t4\t71.43 %\t1\tNo\t1\t2",
      "4\tStrategic Procurement (A)\tSP\t10\t0\t0\t0\t0 %\t-\t-\t-\t-",
      "6\tFMCG Marketing (B)\tFMCG\t10\t10\t8\t2\t80 %\t\tYes\t0\t0",
    ].join("\n");

    const result = parseRegistroPaste(pasted, {
      legend: SAMPLE_LEGEND,
      allClasses: SAMPLE_CLASSES,
      enrolled: SAMPLE_ENROLLED,
    });

    expect(result.kind).toBe("summary");
    expect(result.courses.DSC).toMatchObject({
      code: "DSC",
      registroCode: "DSYC",
      section: "A",
      totalSessions: 20,
      attGiven: 14,
      present: 10,
      absent: 4,
      pct: 71.43,
      attGradeDrop: "1",
      isFeedbackGiven: false,
      feedbackGradeDrop: "1",
      totalGradeDrop: "2",
    });
    expect(result.courses.FMCG).toMatchObject({
      code: "FMCG",
      pct: 80,
      attGradeDrop: "",
      isFeedbackGiven: true,
      feedbackGradeDrop: "0",
      totalGradeDrop: "0",
    });
    expect(result.pendingFeedbackCourses.map((c) => c.code)).toEqual(["DSC"]);
  });

  it("parses copied session-by-session table with breadcrumb header and maps to TermFlow sessionKeys", () => {
    const pasted = [
      "Attendance / TERM-V / Digital Supply Chain (A)",
      "S.No\tDate\tTimeslot\tSession Number\tAttendance Status",
      "1\t07-Sep-2026\t18:30-20:00\t1\tPresent",
      "2\t22-Sep-2026\t14:30-16:00\t2\tMedical Leave",
      "3\t24-Nov-2026\t18:30-20:00\t15\t-",
    ].join("\n");

    const result = parseRegistroPaste(pasted, {
      legend: SAMPLE_LEGEND,
      allClasses: SAMPLE_CLASSES,
      enrolled: SAMPLE_ENROLLED,
    });

    expect(result.kind).toBe("sessions");
    expect(result.tfCode).toBe("DSC");
    expect(result.sessionUpdates).toEqual({
      "2026-09-07_18:30_DSC_Single": "present",
    });
    expect(result.leaveCounts).toEqual({ DSC: 1 });
    expect(result.matchedSessionsCount).toBe(2);
    expect(result.skippedSessionsCount).toBe(1);
  });

  it("encodes, decodes, and resolves compact bookmarklet payload and detects pending feedback notifications", () => {
    const rawPayload = {
      v: 1,
      s: "b",
      at: 1795500000000,
      tn: "TERM-V",
      c: [
        ["DSYC", "Digital Supply Chain", "A", 20, 14, 10, 4, 71.43, "1", false, "1", "2", "Prof. X : Not Provided<br>", 1],
        ["FMCG", "FMCG Marketing", "B", 10, 10, 8, 2, 80, "", true, "0", "0", "Dr. Vivek : Provided<br>", 0],
      ],
      l: [
        ["2026-09-07", "18:30-20:00", "DSYC", "Digital Supply Chain", "A", "Present"],
        ["2026-09-12", "18:30-20:00", "FMCG", "FMCG Marketing", "B", "Absent"],
      ],
    };

    const encoded = encodeRegistroSyncPayload(rawPayload);
    const decoded = decodeRegistroSyncPayload(encoded);
    const parsed = parseRegistroBookmarkletPayload(decoded, {
      legend: SAMPLE_LEGEND,
      allClasses: SAMPLE_CLASSES,
      enrolled: SAMPLE_ENROLLED,
    });

    expect(parsed.kind).toBe("bookmarklet");
    expect(parsed.termName).toBe("TERM-V");
    expect(parsed.courses.DSC.leaves).toBe(1);
    expect(parsed.courses.DSC.feedbackInfo).toBe("Prof. X : Not Provided");
    expect(parsed.sessionUpdates).toEqual({
      "2026-09-07_18:30_DSC_Single": "present",
      "2026-09-12_18:30_FMCG_B": "absent",
    });
    expect(getPendingFeedbackCourses(parsed).map((c) => c.code)).toEqual(["DSC"]);
  });

  it("builds a valid javascript: bookmarklet URL pointing at the target origin", () => {
    const url = buildRegistroBookmarklet("https://pgp2.termflow.tech/");
    expect(url.startsWith("javascript:")).toBe(true);
    expect(url).toContain("https://pgp2.termflow.tech");
    expect(url).toContain("get-student-term-wise-attendance");
  });
});
