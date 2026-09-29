import { describe, expect, it } from "vitest";
import { feedbackFlashAudience } from "./feedbackFlash.js";

describe("feedback flash audience", () => {
  const enrolled = { CBM: "A", SOM: "B", RMS: "Single" };
  it("requires both the subject and its actual assigned section", () => {
    expect(feedbackFlashAudience({ subjectCode: "CBM", section: "A" }, enrolled)).toBe("CBM");
    expect(feedbackFlashAudience({ subjectCode: "CBM", section: "B" }, enrolled)).toBeNull();
    expect(feedbackFlashAudience({ subjectCode: "AOA", section: "A" }, enrolled)).toBeNull();
    expect(feedbackFlashAudience({ subjectCode: "RMS", section: "Single" }, enrolled)).toBe("RMS");
  });
  it("does not broaden incomplete new targets", () => {
    expect(feedbackFlashAudience({ subjectCode: "", section: "" }, enrolled)).toBeNull();
    expect(feedbackFlashAudience({ subjectCode: "CBM", section: "" }, enrolled)).toBeNull();
  });
  it("does not deliver legacy flashes without an explicit section", () => {
    expect(feedbackFlashAudience({ subjects: ["SOM"] }, enrolled)).toBeNull();
    expect(feedbackFlashAudience({ subjects: [] }, enrolled)).toBeNull();
  });
});
