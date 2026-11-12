import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
import { createMeetupSeries, fetchMyMeetups, validPlanInterval, rsvpMeetup, updateMeetup, cancelMeetup } from "./meetups.js";
const occurrences = [{ startsAt: "2026-10-09T10:00:00Z", endsAt: "2026-10-09T11:00:00Z" }, { startsAt: "2026-10-16T10:00:00Z", endsAt: "2026-10-16T11:00:00Z" }];
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());
describe("Meetup persistence", () => {
  it("loads a series sibling and its acceptance beyond the first hundred plans", async () => {
    const starts_at = "2099-01-01T10:00:00Z";
    const rows = Array.from({ length: 101 }, (_, i) => ({ id: `plan-${String(i).padStart(3, "0")}`, created_by: "other", starts_at, ends_at: "2099-01-01T11:00:00Z", series_id: i === 100 ? "late-series" : null }));
    const ranges = vi.fn(async (from, to) => ({ data: rows.slice(from, to + 1) }));
    const orders = vi.fn();
    const query = { select() { return this; }, or() { return this; }, eq() { return this; }, gte() { return this; }, order(...args) { orders(...args); return this; }, range: ranges };
    mocks.from.mockImplementation(table => table === "meetups" ? query : { select() { return this; }, in(_column, ids) { this.ids = ids; return this; }, order() { return this; }, range() { return Promise.resolve({ data: this.ids.includes("plan-100") ? [{ meetup_id: "plan-100", user_id: "me", response: "going" }] : [] }); } });
    const result = await fetchMyMeetups("me", { strict: true });
    expect(result.meetups).toHaveLength(101);
    expect(result.meetups.at(-1).series_id).toBe("late-series");
    expect(result.rsvpsByMeetup["plan-100"][0].response).toBe("going");
    expect(ranges.mock.calls).toEqual([[0, 99], [100, 199]]);
    expect(orders.mock.calls.slice(0, 2)).toEqual([["starts_at", { ascending: true }], ["id", { ascending: true }]]);
  });
  it("writes all weekly occurrences in one batch, then invites each unique participant", async () => {
    const insert = vi.fn(rows => ({ select: async () => ({ data: rows.map((row, index) => ({ id: `m${index}`, ...row })), error: null }) }));
    const notify = vi.fn(async () => ({ error: null }));
    mocks.from.mockImplementation(table => table === "meetups" ? { insert } : { insert: notify });
    const rows = await createMeetupSeries({ userId: "me", userName: "Student", title: "Case prep", occurrences, memberIds: ["friend", "friend", "me"], templateId: "case" });
    expect(insert).toHaveBeenCalledTimes(1); expect(rows).toHaveLength(2);
    expect(rows[0].member_ids).toEqual(["friend"]); expect(rows[0].series_id).toBe(rows[1].series_id);
    expect(rows.map(row => row.series_index)).toEqual([0, 1]); expect(notify).toHaveBeenCalledTimes(2);
    expect(rows[0].ends_at).toBe(occurrences[0].endsAt);
  });
  it("reports a failed batch without sending invites or silently creating a shorter plan", async () => {
    const insert = vi.fn(() => ({ select: async () => ({ data: null, error: { message: "Database failure" } }) }));
    mocks.from.mockImplementation(table => { if (table !== "meetups") throw new Error("Should not send invites"); return { insert }; });
    await expect(createMeetupSeries({ userId: "me", title: "Case", occurrences, memberIds: ["friend"] })).rejects.toThrow("Could not create");
    expect(insert).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid durations and excessive series before writing", async () => {
    expect(validPlanInterval("bad", "bad")).toBe(false);
    expect(validPlanInterval(occurrences[0].startsAt, "2026-10-09T10:14:00Z")).toBe(false);
    await expect(createMeetupSeries({ userId: "me", title: "Case", occurrences: Array(9).fill(occurrences[0]), memberIds: ["friend"] })).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not report all caught up when the meetup fetch fails", async () => {
    const query = { select() { return this; }, or() { return this; }, eq() { return this; }, gte() { return this; }, order() { return this; }, range: async () => ({ data: null, error: { message: "Offline" } }) };
    mocks.from.mockReturnValue(query);
    await expect(fetchMyMeetups("me", { strict: true })).rejects.toThrow("Could not load");
    expect(await fetchMyMeetups("me")).toEqual({ meetups: [], rsvpsByMeetup: {} });
  });
  it("keeps long ongoing plans, excludes ended plans and preserves the legacy grace window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const now = Date.now(); const iso = hours => new Date(now + hours * 3600000).toISOString();
    const rows = [
      { id: "ongoing", starts_at: iso(-2), ends_at: iso(1) },
      { id: "ended", starts_at: iso(-2), ends_at: iso(-1) },
      { id: "old-legacy", starts_at: iso(-2) },
      { id: "recent-legacy", starts_at: iso(-0.5) },
      { id: "upcoming", starts_at: iso(1), ends_at: iso(2) },
    ];
    const gte = vi.fn();
    const query = { select() { return this; }, or() { return this; }, eq() { return this; }, gte(...args) { gte(...args); return this; }, order() { return this; }, range: async () => ({ data: rows, error: null }) };
    const inIds = vi.fn();
    const responses = { order() { return this; }, range: async () => ({ data: [{ meetup_id: "ongoing", user_id: "me", response: "going" }], error: null }) };
    inIds.mockReturnValue(responses);
    mocks.from.mockImplementation(table => table === "meetups" ? query : { select: () => ({ in: inIds }) });
    const result = await fetchMyMeetups("me", { strict: true });
    expect(result.meetups.map(row => row.id)).toEqual(["ongoing", "recent-legacy", "upcoming"]);
    expect(inIds).toHaveBeenCalledWith("meetup_id", ["ongoing", "recent-legacy", "upcoming"]);
    expect(new Date(gte.mock.calls[0][1]).getTime()).toBe(now - 4 * 3600000);
  });

});
describe("versioned meetup writes", () => {
  const meetup = { id: "plan", version: 4 };
  it("sends the observed version for RSVP and propagates stale refusal", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Plan changed. Review the new time before responding" } });
    await expect(rsvpMeetup(meetup, "me", "Me", "going")).rejects.toThrow("Plan changed");
    expect(mocks.rpc).toHaveBeenCalledWith("social_rsvp_meetup", expect.objectContaining({ p_expected_version: 4, p_response: "going" }));
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("writes future lifecycle changes with observed versions atomically through the RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: { saved: true, affected: 2 }, error: null });
    await updateMeetup("plan", { title: "Study", ...occurrences[0], memberIds: ["friend"], expectedVersion: 4, expectedVersions: { second: 2 }, scope: "future" }, "me");
    expect(mocks.rpc).toHaveBeenLastCalledWith("social_manage_meetup", expect.objectContaining({ p_expected_version: 4, p_scope: "future", p_versions: { second: 2 } }));
    await expect(cancelMeetup(meetup, "me", "Me", "future", { second: 2 })).resolves.toBe(true);
    expect(mocks.rpc).toHaveBeenLastCalledWith("social_manage_meetup", expect.objectContaining({ p_action: "cancel", p_scope: "future" }));
  });
});
