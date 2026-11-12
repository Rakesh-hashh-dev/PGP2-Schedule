import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: mocks }));
import { applyMeetupTime, fetchTimePoll, fetchTimeProposals, mapTimeProposals, proposeMeetupTimes, voteMeetupTime } from "./meetupProposals.js";

const meetup = { id: "m", created_by: "organizer", member_ids: ["invitee"], starts_at: "2099-01-01T10:00:00Z", ends_at: "2099-01-01T11:00:00Z" };
const option = (id, extra = {}) => ({ id, state: "open", starts_at: "2099-01-02T10:00:00Z", base_starts_at: meetup.starts_at, base_ends_at: meetup.ends_at, ...extra });
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("window", { dispatchEvent: vi.fn() }); });

describe("plan time proposals", () => {
  it("maps a 1:1 poll without requiring a group and ignores removed participants' votes", () => {
    const rows = mapTimeProposals([option("a"), option("b")], [{ proposal_id: "a", user_id: "invitee" }, { proposal_id: "b", user_id: "removed" }], meetup, "invitee");
    expect(rows.map(row => [row.count, row.mine, row.winning])).toEqual([[1, true, true], [0, false, false]]);
  });
  it("identifies tied winners explicitly and never declares a winner without votes", () => {
    const options = [option("a"), option("b")];
    expect(mapTimeProposals(options, [], meetup, "invitee").every(row => !row.winning && !row.tied)).toBe(true);
    const rows = mapTimeProposals(options, [{ proposal_id: "a", user_id: "invitee" }, { proposal_id: "b", user_id: "organizer" }], meetup, "invitee");
    expect(rows.every(row => row.winning && row.tied)).toBe(true);
  });
  it("excludes applied, expired, and stale options, matching equivalent timestamp formats", () => {
    const rows = mapTimeProposals([option("applied", { state: "applied" }), option("old", { base_ends_at: null }), option("expired", { starts_at: "2020-01-01T10:00:00Z" }), option("valid", { base_starts_at: "2099-01-01T10:00:00.000+00:00" })], [], meetup, "invitee");
    expect(rows.map(row => row.id)).toEqual(["valid"]);
  });
  it("writes a multi-time poll through the authenticated server RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: { saved: true }, error: null });
    await proposeMeetupTimes("m", ["2099-01-02T10:00:00Z", "2099-01-03T10:00:00Z"], "Student");
    expect(mocks.rpc).toHaveBeenCalledWith("propose_meetup_times", { p_meetup_id: "m", p_times: ["2099-01-02T10:00:00.000Z", "2099-01-03T10:00:00.000Z"], p_name: "Student" });
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });
  it("propagates denied writes without announcing success or changing shared client state", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Only the organizer can confirm a winning time" } });
    await expect(applyMeetupTime("m", "a")).rejects.toThrow("Only the organizer");
    expect(window.dispatchEvent).not.toHaveBeenCalled();
    mocks.rpc.mockRejectedValue(new Error("Offline"));
    await expect(voteMeetupTime("m", "a")).rejects.toThrow("Offline");
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
  it("requires explicit tie resolution and carries server stale/duplicate failures back to the UI", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Times are tied" } }).mockResolvedValueOnce({ data: { saved: true }, error: null }).mockResolvedValueOnce({ data: null, error: { message: "This suggestion was applied or is stale" } });
    await expect(applyMeetupTime("m", "a")).rejects.toThrow("tied");
    await applyMeetupTime("m", "a", true);
    expect(mocks.rpc.mock.calls[1][1].p_resolve_tie).toBe(true);
    await expect(applyMeetupTime("m", "a", true)).rejects.toThrow("stale");
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });
  it("rejects missing write acknowledgments and invalid times", async () => {
    await expect(proposeMeetupTimes("m", ["bad"], "Student")).rejects.toThrow("future times");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(voteMeetupTime("m", "a")).rejects.toThrow("not saved");
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
  it.each([{}, { saved: false }, { saved: "true" }])("rejects an unsuccessful acknowledgment %j without invalidating clients", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(voteMeetupTime("m", "a")).rejects.toThrow("not saved");
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
  it("explains duplicate-only proposals without sending a success event", async () => {
    mocks.rpc.mockResolvedValue({ data: { saved: false, reason: "duplicate" }, error: null });
    await expect(proposeMeetupTimes("m", ["2099-01-02T10:00:00Z"], "Guest")).rejects.toThrow("already in the poll");
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
  it("refreshes the canonical parent before mapping a changed plan's options", async () => {
    const fresh = { ...meetup, starts_at: "2099-01-04T10:00:00Z", ends_at: "2099-01-04T11:00:00Z" };
    const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: fresh }), order: async () => ({ data: [option("fresh", { base_starts_at: fresh.starts_at, base_ends_at: fresh.ends_at })] }) };
    mocks.from.mockImplementation(table => table === "meetup_time_votes" ? { select: () => ({ eq: async () => ({ data: [] }) }) } : query);
    const result = await fetchTimePoll("m", "invitee");
    expect(result.meetup).toEqual(fresh);
    expect(result.rows.map(row => row.id)).toEqual(["fresh"]);
  });
  it.each([null, { ...meetup, cancelled: true }, { ...meetup, member_ids: [] }, { ...meetup, starts_at: "2020-01-01T10:00:00Z" }])("closes scheduling for unavailable parent %j", async data => {
    mocks.from.mockReturnValue({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data }) });
    await expect(fetchTimePoll("m", "invitee")).rejects.toThrow(/no longer available|cancelled|has started/);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it("surfaces proposal or vote read failures rather than showing an empty poll", async () => {
    const chain = { select() { return this; }, eq() { return this; }, order() { return Promise.resolve(this); }, then(resolve) { resolve({ data: [], error: { message: "Denied" } }); } };
    mocks.from.mockReturnValue(chain);
    await expect(fetchTimeProposals(meetup, "invitee")).rejects.toThrow("Could not load");
  });
});
