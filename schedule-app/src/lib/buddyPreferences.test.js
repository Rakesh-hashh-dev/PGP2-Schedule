import { describe, expect, it } from "vitest";
import { normalizeBuddyPreferences, matchBuddy } from "./buddyPreferences.js";
describe("Study preferences", () => {
  it("normalizes bounded inputs and ignores unsupported purposes", () => {
    expect(normalizeBuddyPreferences({ subjects: [" PM ", "PM", 2], interests: [" Finance ", "Finance"], purposes: ["Revision", "Other"], discoverable: "yes" })).toEqual({ subjects: ["PM"], interests: ["Finance"], purposes: ["Revision"], discoverable: false });
  });
  it("explains course and optional preference matches separately", () => {
    const mine = { purposes: ["Interview practice"], interests: ["Product Management"], discoverable: true };
    const theirs = { purposes: ["Interview practice"], interests: ["product management"], discoverable: true };
    const match = matchBuddy({ PM: "A" }, { FIN: "B" }, mine, theirs);
    expect(match.score).toBe(0); expect(match.eligible).toBe(true); expect(match.reasons.join(" ")).toContain("Interview practice"); expect(match.reasons.join(" ")).toContain("Product Management");
  });
  it("does not use preferences when either student has opted out", () => {
    const pref = { purposes: ["Revision"], discoverable: true };
    expect(matchBuddy({ PM: "A" }, { FIN: "B" }, pref, { ...pref, discoverable: false }).eligible).toBe(false);
    expect(matchBuddy({ PM: "A", _name: "Me" }, { PM: "B", _status: {} }, null, null).score).toBe(100);
  });
});