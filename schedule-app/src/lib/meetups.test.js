import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: { from: mocks.from } }));
import { createMeetupSeries, fetchMyMeetups, validPlanInterval } from "./meetups.js";
const occurrences = [{ startsAt: "2026-10-09T10:00:00Z", endsAt: "2026-10-09T11:00:00Z" }, { startsAt: "2026-10-16T10:00:00Z", endsAt: "2026-10-16T11:00:00Z" }];
beforeEach(() => vi.clearAllMocks());
describe("Meetup persistence", () => {
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
    const query = { select() { return this; }, or() { return this; }, eq() { return this; }, gte() { return this; }, order() { return this; }, limit: async () => ({ data: null, error: { message: "Offline" } }) };
    mocks.from.mockReturnValue(query);
    await expect(fetchMyMeetups("me", { strict: true })).rejects.toThrow("Could not load");
    expect(await fetchMyMeetups("me")).toEqual({ meetups: [], rsvpsByMeetup: {} });
  });
  it("keeps long ongoing plans, excludes ended plans and preserves the legacy grace window", async () => {
    const now = Date.now(); const iso = hours => new Date(now + hours * 3600000).toISOString();
    const rows = [
      { id: "ongoing", starts_at: iso(-2), ends_at: iso(1) },
      { id: "ended", starts_at: iso(-2), ends_at: iso(-1) },
      { id: "old-legacy", starts_at: iso(-2) },
      { id: "recent-legacy", starts_at: iso(-0.5) },
      { id: "upcoming", starts_at: iso(1), ends_at: iso(2) },
    ];
    const gte = vi.fn();
    const query = { select() { return this; }, or() { return this; }, eq() { return this; }, gte(...args) { gte(...args); return this; }, order() { return this; }, limit: async () => ({ data: rows, error: null }) };
    const inIds = vi.fn(async () => ({ data: [{ meetup_id: "ongoing", user_id: "me", response: "going" }], error: null }));
    mocks.from.mockImplementation(table => table === "meetups" ? query : { select: () => ({ in: inIds }) });
    const result = await fetchMyMeetups("me", { strict: true });
    expect(result.meetups.map(row => row.id)).toEqual(["ongoing", "recent-legacy", "upcoming"]);
    expect(inIds).toHaveBeenCalledWith("meetup_id", ["ongoing", "recent-legacy", "upcoming"]);
    expect(new Date(gte.mock.calls[0][1]).getTime()).toBeLessThanOrEqual(now - 4 * 3600000);
  });

});