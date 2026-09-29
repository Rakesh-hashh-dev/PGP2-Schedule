import { describe, expect, it, vi } from "vitest";
import { createPlacement, filterPlacements, placementStats } from "./placements.js";

describe("placement workspace", () => {
  it("normalizes a new opportunity", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "placement-1" });
    expect(createPlacement({ company: " ACME ", role: "PM", stage: "unknown" }, 10)).toMatchObject({
      id: "placement-1", company: "ACME", role: "PM", stage: "saved", updatedAt: 10,
    });
    vi.unstubAllGlobals();
  });

  it("filters by pipeline stage and text", () => {
    const rows = [
      { company: "Acme", role: "Product", notes: "Case", stage: "interview" },
      { company: "Nova", role: "Consulting", notes: "", stage: "applied" },
    ];
    expect(filterPlacements(rows, "product", "interview")).toHaveLength(1);
    expect(filterPlacements(rows, "nova", "interview")).toHaveLength(0);
  });

  it("summarizes active applications and upcoming deadlines", () => {
    const rows = [
      { stage: "applied", deadline: "2026-09-30" },
      { stage: "interview", deadline: "2026-10-05" },
      { stage: "offer", deadline: "" },
    ];
    expect(placementStats(rows, new Date(2026, 8, 29))).toEqual({ active: 2, interviews: 1, offers: 1, dueSoon: 2 });
  });
});
