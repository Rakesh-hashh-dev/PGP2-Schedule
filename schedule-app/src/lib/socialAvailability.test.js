import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), channel: vi.fn(), removeChannel: vi.fn(), plans: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: mocks }));
vi.mock("./meetups.js", () => ({ fetchMyMeetups: mocks.plans }));
import { acceptedCommitments, loadSocialAvailability, subscribeBusyBlocks } from "./socialAvailability.js";
import { findPlanConflicts, sharedTimeSuggestions } from "./socialPlanning.js";
beforeEach(() => vi.clearAllMocks());
describe("private scheduling commitments", () => {
 it("retains private block 201 and accepted plans instead of silently truncating commitments", async () => {
  const blocks = Array.from({ length: 201 }, (_, i) => ({ id: `block-${i}`, starts_at: "2099-01-01T10:00:00Z", ends_at: "2099-01-01T11:00:00Z" }));
  const order = vi.fn(); const eq = vi.fn(); const range = vi.fn(async (from, to) => ({ data: blocks.slice(from, to + 1) }));
  mocks.from.mockReturnValue({ select() { return this; }, eq(...args) { eq(...args); return this; }, gt() { return this; }, order(...args) { order(...args); return this; }, range });
  mocks.plans.mockResolvedValue({ meetups: [{ id: "late-plan", created_by: "me", starts_at: "2099-01-02T10:00:00Z", ends_at: "2099-01-02T11:00:00Z" }] });
  const result = await loadSocialAvailability("me");
  expect(result.blocks).toHaveLength(201); expect(result.commitments).toHaveLength(202);
  expect(result.commitments.some(block => block.id === "block-200")).toBe(true);
  expect(result.commitments.some(block => block.id === "late-plan")).toBe(true);
  expect(range.mock.calls).toEqual([[0, 199], [200, 399]]);
  expect(order.mock.calls.slice(0, 2)).toEqual([["starts_at"], ["id"]]);
  expect(eq.mock.calls.every(args => args[0] === "user_id" && args[1] === "me")).toBe(true);
 });
 it("subscribes only to the current owner's private blocks and removes the channel", () => {
  const on = vi.fn(); const channel = { on(...args) { on(...args); return this; }, subscribe() { return this; } };
  mocks.channel.mockReturnValue(channel);
  const refresh = vi.fn(); const stop = subscribeBusyBlocks("owner", refresh);
  expect(on).toHaveBeenCalledWith("postgres_changes", { event: "*", schema: "public", table: "social_busy_blocks", filter: "user_id=eq.owner" }, refresh);
  stop(); expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
 });
 it("counts organizer and accepted plans but excludes pending/declined/cancelled plans", () => {
  const meetups = ["own", "accepted", "pending", "declined", "cancelled"].map(id => ({ id, created_by: id === "own" ? "me" : "other", starts_at: "2026-11-12T10:00:00Z", ends_at: "2026-11-12T11:00:00Z", cancelled: id === "cancelled" }));
  expect(acceptedCommitments("me", { meetups, rsvpsByMeetup: { accepted: [{ user_id: "me", response: "going" }], declined: [{ user_id: "me", response: "declined" }] } }).map(m => m.id)).toEqual(["own", "accepted"]);
 });
 it("checks private commitments even when course data is unavailable and allows adjacency", () => {
  const block = { startsAt: "2026-11-12T10:00:00", endsAt: "2026-11-12T11:00:00", source: "Private busy block" };
  const check = start => findPlanConflicts([{ startsAt: `2026-11-12T${start}`, endsAt: "2026-11-12T11:30:00" }], [{ name: "You", courses: {} }], [], [block]);
  expect(check("10:30:00").conflicts[0].code).toBe("Private busy block"); expect(check("11:00:00").conflicts).toEqual([]);
 });
 it("removes your overnight blocks from timetable suggestions without exposing their details", () => {
  const courses = { PM: "A" }; const allClasses = [{ code: "PM", section: "A", type: "class", date: "2026-11-12", start: "09:00", end: "10:00" }];
  const slots = sharedTimeSuggestions({ enrolled: courses, allClasses, friends: [{ cloudId: "friend", name: "Friend", courses }], now: new Date("2026-11-12T10:00:00"), commitments: [{ startsAt: "2026-11-11T20:00:00", endsAt: "2026-11-12T15:00:00", source: "secret reason" }] });
  expect(slots.filter(s => s.date === "2026-11-12").every(s => s.start >= "15:00")).toBe(true); expect(JSON.stringify(slots)).not.toContain("secret reason");
 });
});
