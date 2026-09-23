import { describe, expect, it } from "vitest";
import { attentionPriority, daysUntilChange, isAttentionChange, notificationDateParts } from "./notificationWorkspace.js";

const now = new Date("2026-09-20T12:00:00").getTime();

describe("notification workspace", () => {
  it("prioritizes imminent cancellations and moves", () => {
    expect(attentionPriority({ kind: "removed", date: "2026-09-21" }, now)).toBe(5);
    expect(attentionPriority({ kind: "moved", date: "2026-09-29" }, now)).toBe(4);
  });

  it("keeps distant additions out of needs attention", () => {
    expect(isAttentionChange({ kind: "added", date: "2026-10-19" }, now)).toBe(false);
    expect(isAttentionChange({ kind: "added", date: "2026-09-24" }, now)).toBe(true);
  });

  it("ignores stale changes", () => {
    expect(isAttentionChange({ kind: "removed", date: "2026-09-10" }, now)).toBe(false);
  });

  it("reports the affected-date distance", () => {
    expect(daysUntilChange({ date: "2026-09-25" }, now)).toBe(5);
    expect(daysUntilChange({}, now)).toBeNull();
  });

  it("separates the affected time from the update summary", () => {
    expect(notificationDateParts({ text: "Mon 21 Sep · 08:00 — Finance class cancelled" })).toEqual({
      affectedWhen: "Mon 21 Sep · 08:00",
      summary: "Finance class cancelled",
    });
  });
});
