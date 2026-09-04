import { describe, it, expect } from "vitest";
import {
  taughtSectionsByCode,
  provisionalSectionCodes,
  applyRosterAllocation,
  manualSectionCodes,
  unscheduledCodes,
} from "./sections.js";
import { getSnapshot } from "./sheet.js";

const cls = (code, section, type = "class") => ({ code, section, type });

describe("taughtSectionsByCode", () => {
  it("reports the real sections of a two-section course", () => {
    expect(taughtSectionsByCode([cls("DM", "A"), cls("DM", "B")]).DM).toEqual(["A", "B"]);
  });

  it("keeps Single for a genuinely combined course", () => {
    expect(taughtSectionsByCode([cls("CRM", "Single")]).CRM).toEqual(["Single"]);
  });

  it("ignores combined sessions on a sectioned course", () => {
    // BAV runs A and B plus one combined mid-term — the mid-term is not a choice.
    const out = taughtSectionsByCode([cls("BAV", "A"), cls("BAV", "B"), cls("BAV", "Single")]);
    expect(out.BAV).toEqual(["A", "B"]);
  });

  it("skips non-class rows and rows with no code", () => {
    const out = taughtSectionsByCode([
      cls("", "Single", "break"),
      cls("X", "Single", "holiday"),
      { type: "class", section: "A" },
    ]);
    expect(out).toEqual({});
  });

  it("tolerates missing input", () => {
    expect(taughtSectionsByCode(undefined)).toEqual({});
    expect(taughtSectionsByCode([])).toEqual({});
  });
});

describe("provisionalSectionCodes", () => {
  const taught = { ECOM: ["A", "B"], DM: ["A", "B"], CRM: ["Single"] };

  it("flags a Single allocation against an A/B timetable", () => {
    // The exact ECOM case: the roster script defaults to "Single" when it can't
    // find a section column, and that matches no ECOM row.
    expect([...provisionalSectionCodes({ ECOM: "Single" }, taught)]).toEqual(["ECOM"]);
  });

  it("leaves a correctly allocated student alone", () => {
    expect(provisionalSectionCodes({ DM: "A", CRM: "Single" }, taught).size).toBe(0);
  });

  it("flags a section allocation against a combined course", () => {
    expect([...provisionalSectionCodes({ CRM: "A" }, taught)]).toEqual(["CRM"]);
  });

  it("never flags a course with no classes scheduled yet", () => {
    // BAV before its rows land: an empty timetable is not a bad allocation.
    expect(provisionalSectionCodes({ BAV: "Single" }, taught).size).toBe(0);
    expect(provisionalSectionCodes({ BAV: "Single" }, { ...taught, BAV: [] }).size).toBe(0);
  });

  it("tolerates missing input", () => {
    expect(provisionalSectionCodes(null, taught).size).toBe(0);
    expect(provisionalSectionCodes({ DM: "A" }, undefined).size).toBe(0);
  });
});

describe("against the shipped snapshot", () => {
  const snap = getSnapshot();
  const taught = taughtSectionsByCode(snap.CLASSES);

  it("does not flag the current cohort", () => {
    // ECOM is the mismatch this guard was written for: 111 students were
    // allocated "Single" against an A/B timetable, so the plain filter showed
    // them no ECOM classes at all. That allocation was corrected upstream on
    // 2026-09-04 (they now split A:55 / B:56), so the live snapshot should
    // flag nothing.
    //
    // This assertion tracks the source sheet, not our logic — the guard's
    // mechanism is pinned by the two tests below, which do not depend on how
    // students happen to be allocated today. If this starts failing, a NEW
    // allocation mismatch has appeared upstream: fix it in the sheet, and
    // only then update this expectation.
    const flagged = new Set();
    for (const alloc of Object.values(snap.STUDENTS)) {
      for (const code of provisionalSectionCodes(alloc, taught)) flagged.add(code);
    }
    expect([...flagged]).toEqual([]);
  });

  it("would have hidden every ECOM class without the guard", () => {
    const ecomStudents = Object.values(snap.STUDENTS).filter(a => a.ECOM !== undefined);
    expect(ecomStudents.length).toBeGreaterThan(100);
    // Under the plain filter, a "Single" allocation matches no ECOM row at all.
    const ecom = snap.CLASSES.filter(c => c.type === "class" && c.code === "ECOM");
    const wouldSee = ecom.filter(c => c.section === "Single" || c.section === "All");
    expect(wouldSee).toHaveLength(0);
    // With the guard the course is flagged, so the filter falls through to all of it.
    expect(provisionalSectionCodes({ ECOM: "Single" }, taught).has("ECOM")).toBe(true);
  });

  it("does not flag any correctly sectioned course", () => {
    for (const code of ["DM", "CBM", "FMCG", "MST", "SOM", "SLTDM", "MCBPP", "FME"]) {
      expect(provisionalSectionCodes({ [code]: "A" }, taught).has(code)).toBe(false);
      expect(provisionalSectionCodes({ [code]: "B" }, taught).has(code)).toBe(false);
    }
    for (const code of ["CRM", "SCA", "AAIM", "AOA", "BOM", "DSC"]) {
      expect(provisionalSectionCodes({ [code]: "Single" }, taught).has(code)).toBe(false);
    }
  });
});

describe("applyRosterAllocation", () => {
  const taught = { BAV: ["A", "B"], CRM: ["Single"] };

  it("adds a course the roster gained after onboarding", () => {
    const out = applyRosterAllocation({ DM: "A" }, { DM: "A", BAV: "B" }, { taught });
    expect(out.courses).toEqual({ DM: "A", BAV: "B" });
    expect(out.added).toBe(true);
  });

  it("never resurrects a deliberately dropped course", () => {
    const out = applyRosterAllocation({ DM: "A" }, { DM: "A", BAV: "B" }, { taught, droppedCodes: ["BAV"] });
    expect(out.changed).toBe(false);
  });

  // The BAV case: the Section column was blank at onboarding, so the student
  // added the course by hand and guessed A. Today's allocation says B.
  it("corrects a guessed section once the sheet allocates", () => {
    const out = applyRosterAllocation({ BAV: "A" }, { BAV: "B" }, { taught });
    expect(out.courses.BAV).toBe("B");
    expect(out.changed).toBe(true);
    expect(out.added).toBe(false); // must not reset the subject filter
  });

  it("leaves a deliberate override alone", () => {
    const out = applyRosterAllocation({ BAV: "A" }, { BAV: "B" }, { taught, manualSections: ["BAV"] });
    expect(out.courses.BAV).toBe("A");
    expect(out.changed).toBe(false);
  });

  it("ignores a sheet section the timetable never teaches", () => {
    const out = applyRosterAllocation({ CRM: "Single" }, { CRM: "B" }, { taught });
    expect(out.courses.CRM).toBe("Single");
    expect(out.changed).toBe(false);
  });

  it("still corrects a course with no rows in the timetable yet", () => {
    const out = applyRosterAllocation({ BAV: "A" }, { BAV: "B" }, { taught: {} });
    expect(out.courses.BAV).toBe("B");
  });

  it("returns the original object when nothing applies", () => {
    const enrolled = { BAV: "B" };
    expect(applyRosterAllocation(enrolled, { BAV: "B" }, { taught }).courses).toBe(enrolled);
  });
});

describe("manualSectionCodes", () => {
  it("flags only a pick that contradicts a published allocation", () => {
    expect(manualSectionCodes({ BAV: "A", DM: "B" }, { BAV: "B", DM: "B" })).toEqual(["BAV"]);
  });

  it("treats a guess against an unallocated course as sheet-owned", () => {
    // BAV absent from the sheet — exactly the pre-allocation state.
    expect(manualSectionCodes({ BAV: "A" }, { DM: "B" })).toEqual([]);
  });

  it("clears an override once the student re-aligns with the sheet", () => {
    expect(manualSectionCodes({ BAV: "B" }, { BAV: "B" })).toEqual([]);
  });
});

describe("unscheduledCodes", () => {
  // BMD: in the term legend (so it's pickable at onboarding) but the master
  // timetable has no sessions and there's no roster tab for it either.
  it("flags an enrolled course the timetable has no sessions for", () => {
    expect(unscheduledCodes({ BMD: "Single", DM: "A" }, { DM: ["A", "B"] })).toEqual(["BMD"]);
  });

  it("says nothing about a course that is scheduled", () => {
    expect(unscheduledCodes({ DM: "A" }, { DM: ["A", "B"] })).toEqual([]);
  });

  it("does not double-report a provisional course", () => {
    const taught = { BAV: ["A", "B"] };
    const enrolled = { BAV: "Single" };
    expect(unscheduledCodes(enrolled, taught)).toEqual([]);
    expect([...provisionalSectionCodes(enrolled, taught)]).toEqual(["BAV"]);
  });
});
