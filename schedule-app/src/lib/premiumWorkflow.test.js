import { describe, expect, it } from "vitest";
import { sessionItems } from "./premiumWorkflow.js";

describe("premium schedule workflow", () => {
  it("uses the same term and session key as the course hub", () => {
    const session = { date: "2026-09-28", start: "10:00", code: "DSC", section: "A" };
    const items = [
      { id: "p", term: "5", code: "DSC", kind: "prep", sessionKey: "2026-09-28_10:00_DSC_A" },
      { id: "n", term: "5", code: "DSC", kind: "note", sessionKey: "2026-09-28_10:00_DSC_A" },
      { id: "x", term: "4", code: "DSC", kind: "prep", sessionKey: "2026-09-28_10:00_DSC_A" },
    ];
    expect(sessionItems(session, items, 5)).toMatchObject({ prep: [{ id: "p" }], notes: [{ id: "n" }], links: [] });
  });
});
