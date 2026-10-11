import { describe, expect, it, vi } from "vitest";
vi.mock("./supabase.js", () => ({ supabase: {} }));
import { buildResponseItems } from "./socialActivity.js";
const now = new Date("2026-10-08T10:00:00Z");
const base = { userId: "me", now, groups: [{ id: "g", name: "Circle" }] };
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