import { describe, expect, it, vi } from "vitest";
vi.mock("./supabase.js", () => ({ supabase: {} }));
import { sharedSlotDraft, groupPlanningSlots, mutatePrivateBusyTime } from "./planningUi.js";
import { sharedTimeSuggestions } from "./socialPlanning.js";

describe("integrated planning flow", () => {
  const courses = { PM: "A" };
  const allClasses = [{ type: "class", code: "PM", section: "A", date: "2026-11-11", start: "09:00", end: "10:00" }];
  const friends = Array.from({ length: 15 }, (_, index) => ({ id: `f${index}`, cloudId: `u${index}`, name: `Friend ${index}`, courses }));
  it("calculates a selected friend or circle independently of other candidate volume", () => {
    const args = { enrolled: courses, friends, allClasses, now: new Date("2026-11-11T10:00:00"), groups: [{ id: "g", name: "Late circle", memberIds: ["f13", "f14"] }] };
    const selected = sharedTimeSuggestions({ ...args, circleId: "friend:u14" });
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every(slot => slot.memberCloudIds.length === 1 && slot.memberCloudIds[0] === "u14")).toBe(true);
    const group = sharedTimeSuggestions({ ...args, circleId: "group:g" });
    expect(group.length).toBeGreaterThan(0);
    expect(group.every(slot => slot.groupId === "g" && slot.memberCloudIds.join(",") === "u13,u14")).toBe(true);
    expect(sharedTimeSuggestions({ ...args, circleId: "friend:missing" })).toEqual([]);
  });
  it("carries the selected window, duration, group and all participant names into the composer", () => {
    const slot = { date: "2026-11-11", start: "14:00", end: "15:30", durationMin: 90, groupId: "g", groupName: "Case circle", memberCloudIds: ["one", "two"], names: ["Meera", "Aarav"] };
    expect(sharedSlotDraft(slot)).toEqual(expect.objectContaining({ source: "shared-time", title: "Case circle", groupId: "g", groupName: "Case circle", date: slot.date, start: slot.start, end: slot.end, duration: 90, memberCloudIds: ["one", "two"], inviteeNames: { one: "Meera", two: "Aarav" } }));
    expect(groupPlanningSlots([slot, { ...slot, start: "16:00" }, { ...slot, date: "2026-11-12" }]).map(day => day.slots.length)).toEqual([2, 1]);
  });
  it("keeps an unsaved add form after successful removal or failed add/remove", async () => {
    const draft = { start: "2026-11-11T15:00", end: "2026-11-11T16:00" };
    const remove = vi.fn().mockResolvedValue(undefined);
    expect(await mutatePrivateBusyTime({ userId: "me", kind: "remove", blockId: "old", draft, remove })).toEqual(draft);
    const save = vi.fn().mockRejectedValue(new Error("Save failed"));
    await expect(mutatePrivateBusyTime({ userId: "me", kind: "add", draft, save })).rejects.toThrow("Save failed");
    expect(draft.start).toBe("2026-11-11T15:00");
    remove.mockRejectedValue(new Error("Remove failed"));
    await expect(mutatePrivateBusyTime({ userId: "me", kind: "remove", blockId: "old", draft, remove })).rejects.toThrow("Remove failed");
    save.mockResolvedValue(undefined);
    expect(await mutatePrivateBusyTime({ userId: "me", kind: "add", draft, save })).toEqual({ start: "", end: "" });
  });
  it("rejects invalid local dates before persisting a private block", async () => {
    const save = vi.fn();
    await expect(mutatePrivateBusyTime({ userId: "me", kind: "add", draft: { start: "", end: "" }, save })).rejects.toThrow("valid end");
    expect(save).not.toHaveBeenCalled();
  });
});
