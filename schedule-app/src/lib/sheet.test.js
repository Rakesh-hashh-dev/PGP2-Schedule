import { afterEach, describe, it, expect, vi } from "vitest";
import { getSnapshot, cleanRoom, fetchSchedule, normalizeEndTermExam } from "./sheet.js";

// No localStorage in the node env, so getSnapshot() falls through to the
// bundled snapshot — which is exactly the payload these tests are about.
const snap = getSnapshot();

afterEach(() => vi.unstubAllGlobals());

describe("schedule sync error details", () => {
  it("identifies a failed request to the schedule feed", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const data = await fetchSchedule(true);
    expect(data._meta).toMatchObject({
      status: "error",
      source: "Google Apps Script schedule feed",
      step: "Request schedule feed",
      message: "Couldn't reach the schedule server. Check your connection and tap Retry.",
      detail: "Failed to fetch",
    });
  });

  it("falls back to the cached feed when a forced refresh fails", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ CLASSES: snap.CLASSES, TERM: snap.TERM, LEGEND: snap.LEGEND }) });
    vi.stubGlobal("fetch", fetchMock);
    const data = await fetchSchedule(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("force=");
    expect(fetchMock.mock.calls[1][0]).not.toContain("force=");
    expect(data._meta.status).toBe("success");
  });

  it("identifies an error returned by the feed", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: "Sheet unavailable" }) }));
    const data = await fetchSchedule(true);
    expect(data._meta).toMatchObject({
      status: "error",
      source: "Google Apps Script schedule feed",
      step: "Check feed response",
      message: "Sheet unavailable",
    });
  });
});

describe("bundled snapshot", () => {
  it("is the static snapshot, not a cached live payload", () => {
    expect(snap._source).toBe("snapshot");
  });

  it("ships the STUDENTS allocation map so onboarding survives a feed outage", () => {
    expect(snap.STUDENTS).toBeTruthy();
    expect(Object.keys(snap.STUDENTS).length).toBeGreaterThan(100);
  });

  it("keys STUDENTS by sha256 hex, never by raw email", () => {
    for (const key of Object.keys(snap.STUDENTS).slice(0, 25)) {
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(key).not.toContain("@");
    }
  });
});

describe("single-section courses with stray section rows", () => {
  // CRM, SCA and AOA are combined, but the sheet emits some stray A/B rows.
  // Every student is allocated "Single", so an un-normalised A/B row is invisible
  // to the entire cohort.
  for (const code of ["CRM", "SCA", "AOA"]) {
    it(`normalises every ${code} row to a section students can see`, () => {
      const rows = snap.CLASSES.filter(c => c.type === "class" && c.code === code);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.filter(c => c.section === "B")).toHaveLength(0);
      expect(rows.every(c => c.section === "Single")).toBe(true);
    });
  }

  it("leaves genuinely two-section courses alone", () => {
    // DM really does run separate A and B sections — normalising it would merge
    // two different timetables into one.
    const dm = snap.CLASSES.filter(c => c.type === "class" && c.code === "DM");
    const sections = new Set(dm.map(c => c.section));
    expect(sections.has("A")).toBe(true);
    expect(sections.has("B")).toBe(true);
  });

  it("leaves no course with a lone B row and no A row", () => {
    const bycode = {};
    for (const c of snap.CLASSES) {
      if (c.type === "class" && c.code) (bycode[c.code] ||= new Set()).add(c.section);
    }
    const orphaned = Object.entries(bycode)
      .filter(([, secs]) => secs.has("B") && !secs.has("A"))
      .map(([code]) => code);
    expect(orphaned).toEqual([]);
  });
});

describe("cleanRoom", () => {
  it("drops a value that just repeats the guest named in the session", () => {
    expect(cleanRoom({
      room: "Mr. Procyon Mukherjee",
      session: "17 Guest Session (Mr. Procyon Mukherjee)",
      name: "Digital Supply Chain",
    })).toBe("");
  });

  it("drops a company name echoed from the session text", () => {
    expect(cleanRoom({
      room: "Zoho",
      session: "8 (Guest Session) Mr. Sampath Kumar (Zoho)",
      name: "Customer Relationship Marketing",
    })).toBe("");
  });

  it("drops anything carrying a personal title", () => {
    expect(cleanRoom({ room: "Dr. A. Sharma", session: "5", name: "X" })).toBe("");
    expect(cleanRoom({ room: "Prof. Nitin Soni", session: "", name: "" })).toBe("");
  });

  it("keeps a real room, including one mentioning a course-ish token", () => {
    expect(cleanRoom({ room: "AC-201", session: "3 (Prof. Anoop TS)", name: "Digital Marketing" })).toBe("AC-201");
    expect(cleanRoom({ room: "LH 4", session: "12", name: "Bank Operations Management" })).toBe("LH 4");
  });

  it("trims and tolerates a missing room", () => {
    expect(cleanRoom({ room: "  AC-201  ", session: "", name: "" })).toBe("AC-201");
    expect(cleanRoom({ session: "", name: "" })).toBe("");
    expect(cleanRoom({ room: "", session: "", name: "" })).toBe("");
  });

  it("leaves no guest-name rooms in the shipped snapshot", () => {
    const rooms = [...new Set(snap.CLASSES.map(c => c.room).filter(Boolean))];
    expect(rooms.filter(r => /^(mr|mrs|ms|dr|prof)\.?\s/i.test(r))).toEqual([]);
  });
});

describe("roster-confirmed section repair", () => {
  const row = { type: "class", date: "2026-10-13", code: "SCA", name: "Supply Chain Analytics", session: "MID TERM", start: "14:30", end: "16:00", room: "AC-201" };
  const payload = students => ({ LEGEND: { SCA: { name: row.name } }, STUDENTS: students, CLASSES: [{ ...row, section: "A" }, { ...row, section: "Single" }, { ...row, section: "B", start: "17:00", end: "18:30" }] });
  it("repairs cached combined rows, removes an exact duplicate, and keeps a distinct session", () => {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ data: payload({ student: { SCA: "Single" } }) }) });
    const result = getSnapshot();
    expect(result.CLASSES.map(c => [c.section, c.start])).toEqual([["Single", "14:30"], ["Single", "17:00"]]);
  });
  it("keeps sectioned rows when the current roster has A/B allocations", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload({ first: { SCA: "A" }, second: { SCA: "B" } }) }));
    const result = await fetchSchedule(true);
    expect(result._meta.status).toBe("success");
    expect(result.CLASSES.map(c => c.section)).toEqual(["A", "Single", "B"]);
  });
  it("applies the same repair to fresh feed rows without changing the source payload", async () => {
    const data = payload({ student: { SCA: "Single" } });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    const result = await fetchSchedule(true);
    expect(result._meta.status).toBe("success");
    expect(result.CLASSES.map(c => c.section)).toEqual(["Single", "Single"]);
    expect(data.CLASSES.map(c => c.section)).toEqual(["A", "Single", "B"]);
  });
});

describe("normalizeEndTermExam", () => {
  it("normalizes a 5.5-hour class slot on or after Dec 11 to an exam", () => {
    const rawSOM = {
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
      faculty: "Prof. Ramakrushna Padhy",
      room: "A02",
    };
    const normalized = normalizeEndTermExam(rawSOM);
    expect(normalized.type).toBe("exam");
    expect(normalized.session).toBe("End Term Exam");
    expect(normalized.code).toBe("SOM");
  });

  it("leaves lunch breaks intact", () => {
    const lunch = {
      date: "2026-12-11",
      day: "Fri",
      section: "Single",
      slot: 3,
      start: "13:30",
      end: "14:30",
      type: "break",
      code: "",
      session: "",
      name: "Lunch\nBreak",
    };
    const normalized = normalizeEndTermExam(lunch);
    expect(normalized.type).toBe("break");
  });

  it("leaves regular teaching sessions before Dec 11 alone", () => {
    const regularClass = {
      date: "2026-12-10",
      day: "Thu",
      section: "Single",
      slot: 0,
      start: "08:00",
      end: "09:30",
      type: "class",
      code: "SP",
      session: "9",
      name: "Strategic Procurement",
    };
    const normalized = normalizeEndTermExam(regularClass);
    expect(normalized.type).toBe("class");
    expect(normalized.session).toBe("9");
  });

  it("normalizes all Dec 11-20 exam courses in snapshot", () => {
    const decExams = snap.CLASSES.filter(c => c.date >= "2026-12-11" && c.code);
    expect(decExams.length).toBeGreaterThan(0);
    expect(decExams.every(c => c.type === "exam")).toBe(true);
    expect(decExams.every(c => c.session.includes("End Term"))).toBe(true);
  });
});
