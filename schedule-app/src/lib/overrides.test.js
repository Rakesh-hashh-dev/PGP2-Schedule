import { describe, it, expect } from "vitest";
import { classIdent, makeOverrideKey, lookupOverride, parseOverrideKey } from "./overrides.js";

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
