import { describe, it, expect } from "vitest";
import { classIdent, makeOverrideKey, classOverrideKey, classMatchesKey, lookupOverride, parseOverrideKey, buildOverrideAdds } from "./overrides.js";

describe("classIdent", () => {
  it("uses the course code when present", () => {
    expect(classIdent({ code: "SCM", name: "Supply Chain" })).toBe("SCM");
  });
  it("falls back to the name for code-less rows (exams / END Term)", () => {
    expect(classIdent({ code: "", name: "PMA End Term" })).toBe("PMA End Term");
  });
  it("is empty for a nullish/blank class", () => {
    expect(classIdent(null)).toBe("");
    expect(classIdent({})).toBe("");
  });
});

describe("makeOverrideKey", () => {
  it("scopes A/B sections with a suffix", () => {
    expect(makeOverrideKey("SCM", "A")).toBe("SCM_A");
    expect(makeOverrideKey("SCM", "B")).toBe("SCM_B");
  });
  it("uses the bare ident for All/Single/empty sections", () => {
    expect(makeOverrideKey("SCM", "All")).toBe("SCM");
    expect(makeOverrideKey("SCM", "Single")).toBe("SCM");
    expect(makeOverrideKey("SCM", "")).toBe("SCM");
    expect(makeOverrideKey("SCM", undefined)).toBe("SCM");
  });
});

describe("lookupOverride", () => {
  it("prefers the section-scoped key over the bare All key", () => {
    const forDate = { "SCM_A": { note: "sectioned" }, "SCM": { note: "all" } };
    expect(lookupOverride(forDate, { code: "SCM", section: "A" })).toEqual({ note: "sectioned" });
  });
  it("falls back to the bare All-section override", () => {
    const forDate = { "SCM": { note: "all" } };
    expect(lookupOverride(forDate, { code: "SCM", section: "A" })).toEqual({ note: "all" });
  });
  it("returns null when nothing matches or the date map is empty", () => {
    expect(lookupOverride(null, { code: "SCM", section: "A" })).toBeNull();
    expect(lookupOverride({}, { code: "SCM", section: "A" })).toBeNull();
  });

  // Regression: two code-less exams on the same date+section must NOT collide.
  // Before overrides.js keyed by name-fallback, both mapped to "_A" and editing
  // one badged/applied to the other.
  it("keeps distinct code-less exams separate by name", () => {
    const scm = { code: "", name: "SCM End Term", section: "A" };
    const pma = { code: "", name: "PMA End Term", section: "A" };
    const forDate = {
      [makeOverrideKey(classIdent(scm), scm.section)]: { room: "H1" },
      [makeOverrideKey(classIdent(pma), pma.section)]: { room: "H2" },
    };
    expect(lookupOverride(forDate, scm)).toEqual({ room: "H1" });
    expect(lookupOverride(forDate, pma)).toEqual({ room: "H2" });
  });
});

describe("parseOverrideKey", () => {
  it("splits a section-scoped key", () => {
    expect(parseOverrideKey("SCM_A")).toEqual({ ident: "SCM", section: "A" });
    expect(parseOverrideKey("SCM_B")).toEqual({ ident: "SCM", section: "B" });
  });
  it("treats a bare key as an All-section override", () => {
    expect(parseOverrideKey("SCM")).toEqual({ ident: "SCM", section: "All" });
  });
  it("does not mistake other underscores for a section suffix", () => {
    expect(parseOverrideKey("PMA End Term")).toEqual({ ident: "PMA End Term", section: "All" });
    expect(parseOverrideKey("FOO_C")).toEqual({ ident: "FOO_C", section: "All" });
  });
  it("round-trips with makeOverrideKey for A/B and All", () => {
    for (const [ident, section] of [["SCM", "A"], ["SCM", "B"], ["SCM", "All"]]) {
      const key = makeOverrideKey(ident, section);
      expect(parseOverrideKey(key)).toEqual({ ident, section });
    }
  });
});

describe("buildOverrideAdds", () => {
  it("adds a titled override with no matching class", () => {
    const overrides = { "2026-09-03": { WAI: { name: "Working with AI", type: "exam", start: "15:00", end: "17:00" } } };
    const added = buildOverrideAdds(overrides, []);
    expect(added).toEqual([
      { date: "2026-09-03", code: "WAI", section: "All", name: "Working with AI", room: "", start: "15:00", end: "17:00", type: "exam" },
    ]);
  });

  it("does NOT resurrect a name-less field-patch whose class left the feed (Term V '1/3' bug)", () => {
    // A prior term's room/time edits (no `name`) no longer match the live feed.
    const overrides = {
      "2026-07-10": { CS: { start: "12:30", end: "14:00" } },
      "2026-08-11": { CS_A: { room: "A02", start: "10:00", end: "11:30" } },
      "2026-08-27": { CS_A: { room: "A01", start: "11:10", end: "13:30" } },
    };
    expect(buildOverrideAdds(overrides, [])).toEqual([]);
  });

  it("produces nothing for a modification that DOES match a live class", () => {
    const classes = [{ date: "2026-09-08", code: "CS", section: "A", type: "class" }];
    const overrides = { "2026-09-08": { CS_A: { room: "B02" } } };
    expect(buildOverrideAdds(overrides, classes)).toEqual([]);
  });

  it("never adds a cancelled override", () => {
    const overrides = { "2026-08-08": { DVB_B: { name: "Cancelled: DVB", type: "cancelled" } } };
    expect(buildOverrideAdds(overrides, [])).toEqual([]);
  });

  it("defaults type to class and fills blank fields for a titled add", () => {
    const overrides = { "2026-09-04": { BBM: { name: "Business to Business Marketing", type: "exam" } } };
    expect(buildOverrideAdds(overrides, [])).toEqual([
      { date: "2026-09-04", code: "BBM", section: "All", name: "Business to Business Marketing", room: "", start: "", end: "", type: "exam" },
    ]);
  });
});

// Regression: a course meeting twice a day in the same section (BMD Sec A at
// 17:00 and 18:30) shared one `BMD_A` key, so editing one session edited both.
describe("same-day double sessions", () => {
  const early = { date: "2026-10-12", code: "BMD", section: "A", start: "17:00", end: "18:30", type: "class" };
  const late = { date: "2026-10-12", code: "BMD", section: "A", start: "18:30", end: "20:00", type: "class" };

  it("gives each session its own key", () => {
    expect(classOverrideKey(early)).toBe("BMD_A@17:00");
    expect(classOverrideKey(late)).toBe("BMD_A@18:30");
    expect(classOverrideKey({ code: "SCA", section: "Single", start: "08:00" })).toBe("SCA@08:00");
  });

  it("an edit to one session does not touch the other", () => {
    const forDate = { [classOverrideKey(early)]: { room: "A04" } };
    expect(lookupOverride(forDate, early)).toEqual({ room: "A04" });
    expect(lookupOverride(forDate, late)).toBeNull();
  });

  it("layers a session edit over a legacy whole-day override", () => {
    const forDate = { BMD_A: { room: "A02" }, "BMD_A@18:30": { start: "19:00" } };
    expect(lookupOverride(forDate, early)).toEqual({ room: "A02" });
    expect(lookupOverride(forDate, late)).toEqual({ room: "A02", start: "19:00" });
  });

  it("parses session keys and round-trips", () => {
    expect(parseOverrideKey("BMD_A@18:30")).toEqual({ ident: "BMD", section: "A", start: "18:30" });
    expect(parseOverrideKey("SCA@08:00")).toEqual({ ident: "SCA", section: "All", start: "08:00" });
    expect(parseOverrideKey(makeOverrideKey("PMA End Term", "B", "10:00"))).toEqual({ ident: "PMA End Term", section: "B", start: "10:00" });
  });

  it("matches a session key only to its own session", () => {
    const parsed = parseOverrideKey("BMD_A@18:30");
    expect(classMatchesKey(early, parsed)).toBe(false);
    expect(classMatchesKey(late, parsed)).toBe(true);
    expect(classMatchesKey(late, parseOverrideKey("BMD_A"))).toBe(true);
  });

  it("does not treat a moved session's own override as an added class", () => {
    const overrides = { "2026-10-12": { "BMD_A@18:30": { name: "Business Models", start: "19:00" } } };
    expect(buildOverrideAdds(overrides, [early, late])).toEqual([]);
  });
});
