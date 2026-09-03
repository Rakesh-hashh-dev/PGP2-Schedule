import { describe, it, expect } from "vitest";
import { getSnapshot, cleanRoom } from "./sheet.js";

// No localStorage in the node env, so getSnapshot() falls through to the
// bundled snapshot — which is exactly the payload these tests are about.
const snap = getSnapshot();

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

describe("single-section courses with stray B rows", () => {
  // CRM and SCA are single-section, but the sheet emits the odd row tagged "B".
  // Every student is allocated "Single", so an un-normalised B row is invisible
  // to the entire cohort.
  for (const code of ["CRM", "SCA"]) {
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
