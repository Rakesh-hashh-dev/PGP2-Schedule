import { describe, expect, it } from "vitest";
import { meetupVersions, reviewedMeetupRows } from "./meetupReview.js";

describe("reviewed lifecycle snapshot", () => {
  it("keeps reviewed future times, participants and versions after live data changes", () => {
    const anchor = { id: "anchor", created_by: "owner", series_id: "series", series_index: 0, starts_at: "2099-01-01T10:00:00Z", version: 1, member_ids: ["guest"] };
    const sibling = { ...anchor, id: "sibling", series_index: 1, starts_at: "2099-01-08T10:00:00Z" };
    const snapshot = reviewedMeetupRows(anchor, [anchor, sibling, { ...sibling, id: "unrelated", series_id: "other" }, { ...sibling, id: "cancelled", cancelled: true }]);
    sibling.version = 2; sibling.starts_at = "2099-01-09T10:00:00Z"; sibling.member_ids.push("new-guest");
    expect(meetupVersions(snapshot)).toEqual({ anchor: 1, sibling: 1 });
    expect(snapshot[1].starts_at).toBe("2099-01-08T10:00:00Z");
    expect(snapshot[1].member_ids).toEqual(["guest"]);
  });
});
