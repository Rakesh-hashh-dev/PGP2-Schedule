import { describe, expect, it } from "vitest";
import { scheduleEntryKind } from "./adminSchedule.js";

describe("admin schedule event highlights", () => {
  it.each(["MID TERM", "Mid-term", "endterm", "Quiz"])("recognizes %s stored as a class", session => {
    expect(scheduleEntryKind({ type: "class", session })).toBe("exam");
  });
  it.each(["exam", "event", "placement"])("recognizes feed and admin-created %s entries", type => {
    expect(scheduleEntryKind({ type })).toBe(type);
    expect(scheduleEntryKind({ type: "class", session: "5" }, { type })).toBe(type);
    expect(scheduleEntryKind({ type }, { type: "cancelled" })).toBe(type);
    expect(scheduleEntryKind({ type: "class" }, { type: "cancelled", cancelledType: type })).toBe(type);
  });
  it("keeps regular teaching sessions as classes", () => {
    expect(scheduleEntryKind({ type: "class", session: "5" })).toBe("class");
  });
});
