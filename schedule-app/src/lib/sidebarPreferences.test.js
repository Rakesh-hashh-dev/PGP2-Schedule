import { describe, expect, it } from "vitest";
import { normalizeSidebarPins, toggleSidebarPin } from "./sidebarPreferences.js";

describe("sidebar preferences", () => {
  it("keeps only valid, unique pins up to the three-page limit", () => {
    expect(normalizeSidebarPins(["today", "today", "attendance", "split", "board", "unknown"]))
      .toEqual(["today", "attendance", "split"]);
  });

  it("adds and removes a pin without exceeding the limit", () => {
    expect(toggleSidebarPin(["today"], "attendance")).toEqual(["today", "attendance"]);
    expect(toggleSidebarPin(["today", "attendance", "split"], "board")).toEqual(["today", "attendance", "split"]);
    expect(toggleSidebarPin(["today", "attendance"], "today")).toEqual(["attendance"]);
  });

});
