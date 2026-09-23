import { describe, expect, it } from "vitest";
import { filterSocialFriends, SOCIAL_VIEW_ITEMS } from "./socialWorkspace.js";

const friends = [
  { id: "1", name: "Aarav", isFavourite: true, state: "free" },
  { id: "2", name: "Meera", isFavourite: false, state: "busy" },
  { id: "3", name: "Zoya", isFavourite: false, state: "free" },
];

const getStatus = friend => ({ state: friend.state });

describe("Social workspace", () => {
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
