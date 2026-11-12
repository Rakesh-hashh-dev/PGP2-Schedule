import { describe, expect, it, vi } from "vitest";
import { filterSocialFriends, SOCIAL_VIEW_ITEMS, readSocialNavigation, groupActivitySummary, orderGroupsByActivity, groupWorkspaceRequest } from "./socialWorkspace.js";

const friends = [
  { id: "1", name: "Aarav", isFavourite: true, state: "free" },
  { id: "2", name: "Meera", isFavourite: false, state: "busy" },
  { id: "3", name: "Zoya", isFavourite: false, state: "free" },
];

const getStatus = friend => ({ state: friend.state });

describe("Social workspace", () => {
  it("restores valid account-specific navigation and rejects malformed or anonymous state", () => {
    const storage = new Map([["pgp2.social-navigation:me", JSON.stringify({ view: "groups", groupId: "g" })], ["pgp2.social-navigation:bad", JSON.stringify({ view: "unknown", groupId: {} })], ["pgp2.social-navigation:null", JSON.stringify({ view: "groups", groupId: "private" })]]);
    vi.stubGlobal("localStorage", { getItem: key => storage.get(key) ?? null });
    expect(readSocialNavigation("me")).toEqual({ userId: "me", view: "groups", groupId: "g" });
    expect(readSocialNavigation("other")).toEqual({ userId: "other", view: "overview", groupId: null });
    expect(readSocialNavigation("bad")).toEqual({ userId: "bad", view: "overview", groupId: null });
    expect(readSocialNavigation(null).groupId).toBeNull();
  });
  it("reopens Chat with a new workspace identity when Vote is invoked after Members", () => {
    const members = groupWorkspaceRequest(null, "g", "members");
    const vote = groupWorkspaceRequest(members, "g", "chat");
    expect(vote).toEqual({ groupId: "g", tab: "chat", nonce: members.nonce + 1 });
    expect(groupWorkspaceRequest(vote, "g", "chat").nonce).toBeGreaterThan(vote.nonce);
  });
  it("orders and counts visible group activity at database microsecond precision", () => {
    const groups = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
    const summary = groupActivitySummary(groups, { messages: [
      { id: "z", group_id: "a", from_id: "other", text: "Already read", created_at: "2026-11-11T10:00:00.000001Z" },
      { id: "z", group_id: "b", from_id: "other", text: "Earlier", created_at: "2026-11-11T10:00:00.000001Z" },
      { id: "a", group_id: "b", from_id: "other", text: "__poll:p", created_at: "2026-11-11T10:00:00.000002Z" },
      { id: "mine", group_id: "b", from_id: "me", text: "Own", created_at: "2026-11-11T09:00:00Z" },
      { id: "hidden", group_id: "a", from_id: "other", text: "Hidden", moderation_hidden: true, created_at: "2026-11-11T11:00:00Z" },
    ], reads: { a: "2026-11-11T10:00:00.000001Z", b: "2026-11-11T10:00:00.000001Z" } }, "me");
    expect(summary.a.unread).toBe(0); expect(summary.b.unread).toBe(1);
    expect(summary.b.preview).toBe("New group poll");
    expect(orderGroupsByActivity(groups, summary).map(group => group.id)).toEqual(["b", "a"]);
  });
  it("keeps the approved section order", () => {
    expect(SOCIAL_VIEW_ITEMS.map(item => item.id)).toEqual(["overview", "friends", "groups"]);
  });

  it("filters friends by a case-insensitive name query", () => {
    expect(filterSocialFriends(friends, { query: "MEE" })).toEqual([friends[1]]);
  });

  it("filters the availability views", () => {
    expect(filterSocialFriends(friends, { filter: "free", getStatus }).map(friend => friend.id)).toEqual(["1", "3"]);
    expect(filterSocialFriends(friends, { filter: "busy", getStatus })).toEqual([friends[1]]);
  });

  it("filters favourites independently of live status", () => {
    expect(filterSocialFriends(friends, { filter: "favourites", getStatus })).toEqual([friends[0]]);
  });
});
