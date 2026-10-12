import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), meetups: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("./meetups.js", () => ({ fetchMyMeetups: mocks.meetups }));
import { buildResponseItems, fetchSocialResponses, markGroupRead, retryPendingGroupReads } from "./socialActivity.js";
const now = new Date("2026-10-08T10:00:00Z");
const base = { userId: "me", now, groups: [{ id: "g", name: "Circle" }] };
beforeEach(() => {
  vi.clearAllMocks();
  const storage = new Map();
  vi.stubGlobal("localStorage", { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
});
describe("Needs your response", () => {
  it("shows only future unanswered meetup invitations", () => {
    const meetup = { id: "m", title: "Coffee", member_ids: ["me"], created_by: "other", starts_at: "2026-10-08T11:00:00Z" };
    expect(buildResponseItems({ ...base, meetups: [meetup] })).toHaveLength(1);
    expect(buildResponseItems({ ...base, meetups: [meetup], rsvpsByMeetup: { m: [{ user_id: "me", response: "declined" }] } })).toEqual([]);
    expect(buildResponseItems({ ...base, meetups: [{ ...meetup, starts_at: "2026-10-08T09:00:00Z" }, { ...meetup, id: "own", created_by: "me" }, { ...meetup, id: "cancelled", cancelled: true }] })).toEqual([]);
  });
  it("excludes closed, expired, voted, own and unrelated group polls", () => {
    const poll = { id: "p", scope: "group", group_id: "g", created_by: "other", question: "When?", created_at: now.toISOString() };
    const polls = [poll, { ...poll, id: "closed", closed: true }, { ...poll, id: "expired", closes_at: "2026-10-08T09:00:00Z" }, { ...poll, id: "own", created_by: "me" }, { ...poll, id: "foreign", group_id: "other" }];
    expect(buildResponseItems({ ...base, polls }).map(item => item.pollId)).toEqual(["p"]);
    expect(buildResponseItems({ ...base, polls, votes: [{ poll_id: "p", user_id: "me", choice: [0] }] })).toEqual([]);
    expect(buildResponseItems({ ...base, polls: [poll], votes: [{ poll_id: "p", user_id: "me", choice: [] }] })).toHaveLength(1);
  });
  it("counts unread text once per group and ignores poll markers and own messages", () => {
    const message = { group_id: "g", from_id: "other", text: "Hi", created_at: "2026-10-08T09:59:00Z" };
    const messages = [message, { ...message, text: "__poll:p" }, { ...message, from_id: "me" }, { ...message, group_id: "other" }, { ...message, created_at: "2026-10-08T09:00:00Z" }];
    const items = buildResponseItems({ ...base, messages, reads: { g: "2026-10-08T09:30:00Z" } });
    expect(items).toHaveLength(1); expect(items[0].count).toBe(1);
    expect(buildResponseItems({ ...base, messages, reads: { g: "2026-10-08T10:00:00Z" } })).toEqual([]);
  });
});

describe("independent Social loading", () => {
  it("keeps meetup invitations when group activity fails", async () => {
    const meetup = { id: "invitation" };
    mocks.meetups.mockResolvedValue({ meetups: [meetup], rsvpsByMeetup: {} });
    const failedQuery = { eq: vi.fn(), in: vi.fn(), gte: vi.fn(), order: vi.fn(), limit: vi.fn() };
    for (const key of Object.keys(failedQuery)) failedQuery[key].mockReturnValue(failedQuery);
    failedQuery.then = resolve => resolve({ error: { message: "missing table" } });
    mocks.from.mockReturnValue({ select: () => failedQuery });
    const snapshot = await fetchSocialResponses("partial-groups", [{ id: "g", isReceived: true }]);
    expect(snapshot.meetups).toEqual([meetup]);
    expect(snapshot.errors).toEqual({ plans: null, groups: "Could not load group activity." });
  });
  it("keeps the group result when meetup invitations fail", async () => {
    mocks.meetups.mockRejectedValue(new Error("offline"));
    const snapshot = await fetchSocialResponses("partial-plans", []);
    expect(snapshot.polls).toEqual([]);
    expect(snapshot.errors).toEqual({ plans: "Could not load meetup invitations.", groups: null });
  });
  it("does not load disabled meetup features", async () => {
    expect((await fetchSocialResponses("disabled-plans", [], { meetupsEnabled: false })).errors).toEqual({ plans: null, groups: null });
    expect(mocks.meetups).not.toHaveBeenCalled();
  });
});

describe("read receipt recovery", () => {
  const seenAt = "2026-10-12T08:00:00Z";
  it("retries the same timestamp after a failed cloud save", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "offline" } }).mockResolvedValueOnce({ error: null });
    expect(await markGroupRead("retry-user", "g", seenAt)).toBe(false);
    expect(JSON.parse(localStorage.getItem("pgp2.group-reads-pending:retry-user"))).toEqual({ g: seenAt });
    expect(await markGroupRead("retry-user", "g", seenAt)).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem("pgp2.group-reads-pending:retry-user"))).toEqual({});
  });
  it("retries persisted pending receipts only for current groups", async () => {
    localStorage.setItem("pgp2.group-reads-pending:restored-user", JSON.stringify({ g: seenAt, leftGroup: seenAt }));
    mocks.rpc.mockResolvedValue({ error: null });
    await retryPendingGroupReads("restored-user", ["g"]);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("pgp2.group-reads-pending:restored-user"))).toEqual({ leftGroup: seenAt });
  });
  it("does not resend an already confirmed receipt", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await markGroupRead("confirmed-user", "g", seenAt);
    await markGroupRead("confirmed-user", "g", seenAt);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("saves a newer receipt that arrives during an in-flight request", async () => {
    let resolveFirst;
    mocks.rpc.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValue({ error: null });
    const first = markGroupRead("concurrent-user", "g", seenAt);
    await Promise.resolve();
    const next = markGroupRead("concurrent-user", "g", "2026-10-12T08:01:00Z");
    resolveFirst({ error: null });
    await Promise.all([first, next]);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[1][1].p_seen_at).toBe("2026-10-12T08:01:00Z");
  });
  it("keeps thrown network failures pending for retry", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ error: null });
    expect(await markGroupRead("throw-user", "g", seenAt)).toBe(false);
    expect(await markGroupRead("throw-user", "g", seenAt)).toBe(true);
  });
});
