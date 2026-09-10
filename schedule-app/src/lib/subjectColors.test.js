import { describe, expect, it } from "vitest";
import { assignSubjectColors, cleanSessionLabel, subjectClass, subjectHue } from "./subjectColors.js";

describe("subjectColors", () => {
  it("assigns stable hues and class names", () => {
    assignSubjectColors(["AAIM", "DSC"]);
    expect(subjectHue("AAIM")).toBeDefined();
    expect(subjectClass("AAIM")).toMatch(/^subj-\d$/);
  });

  describe("cleanSessionLabel", () => {
    it("returns empty string if falsy", () => {
      expect(cleanSessionLabel("")).toBe("");
      expect(cleanSessionLabel(null)).toBe("");
      expect(cleanSessionLabel(undefined)).toBe("");
    });

    it("strips professor names in parentheses", () => {
      expect(cleanSessionLabel("1 (Prof. Pritee Kumari)")).toBe("1");
      expect(cleanSessionLabel("2 (Prof. Harshad Sonar)")).toBe("2");
      expect(cleanSessionLabel("3 (Faculty Name)")).toBe("3");
      expect(cleanSessionLabel("4 (Dr. Someone)")).toBe("4");
    });

    it("preserves regular session labels and numbers", () => {
      expect(cleanSessionLabel("1")).toBe("1");
      expect(cleanSessionLabel("Mid-term")).toBe("Mid-term");
      expect(cleanSessionLabel("1 (Guest)")).toBe("1 (Guest)");
    });
  });
});
