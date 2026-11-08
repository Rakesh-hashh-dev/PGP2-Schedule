import { describe, expect, it, vi } from "vitest";
import { buildPushPayload, pushImage } from "../../supabase/functions/_shared/pushPresentation.ts";
import { pushSessionFromParams } from "./pushDeepLink.js";

describe("PC and mobile push presentation", () => {
  it('offers This week for tomorrow’s change while retaining today for current changes', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-09T08:00:00Z'));
      const future = buildPushPayload({ type: 'class_cancelled', title: 'Cancelled', data: { date: '2026-11-10' } });
      expect(future.actions[1]).toMatchObject({ title: 'This week', url: '/?view=week' });
      const current = buildPushPayload({ type: 'schedule_change', title: 'Room changed', data: { date: '2026-11-09' } });
      expect(current.actions[1].url).toBe('/?view=today');
    } finally { vi.useRealTimers(); }
  });
  it.each([['friend_request', 'View request'], ['group_invite', 'View group'], ['group_poll', 'View poll'], ['meetup_reminder', 'View meetup'], ['free_nudge', 'Open Friends'], ['board_comment', 'View comment']])('gives %s a contextual action', (type, label) => {
    const payload = buildPushPayload({ type, title: 'Update', url: '/?view=friends' });
    expect(payload.actions).toEqual([{ action: 'open', title: label, url: payload.url }]);
  });
  it("opens the exact class from encoded identifiers and keeps Today as a separate action", () => {
    const payload = buildPushPayload({ type: "class_reminder", title: "SCA starts in 10 min", body: "02:30PM · Room 4\nSection A", data: { code: "SCA", date: "2026-10-13", start: "14:30" }, dedup_key: "class:123" });
    expect(pushSessionFromParams(new URL(payload.url, "https://termflow.test").searchParams)).toEqual({ code: "SCA", date: "2026-10-13", start: "14:30" });
    expect(payload.actions[0].url).toBe(payload.url);
    expect(payload.actions[1].url).toBe("/?view=today");
    expect(payload.tag).toBe("class:123");
    expect(payload.body).toContain("\nSection A");
  });
  it("falls back when legacy reminders lack session metadata", () => {
    expect(buildPushPayload({ type: "class_reminder", title: "Reminder", url: "/?view=today" }).url).toBe("/?view=today");
  });
  it.each(["class_cancelled", "schedule_change"])("opens updates for %s even if the timetable row is hidden", type => {
    const payload = buildPushPayload({ type, title: "Cancelled", url: "/?view=today" });
    expect(payload.url).toBe("/?view=notifications");
    expect(payload.actions[1].url).toBe("/?view=today");
  });
  it("offers distinct today and week destinations for a summary", () => {
    const { actions } = buildPushPayload({ type: "daily_summary", title: "Today: 3 classes" });
    expect(actions.map(a => a.url)).toEqual(["/?view=today", "/?view=week"]);
  });
  it("preserves an admin destination and passes an optional poster", () => {
    const payload = buildPushPayload({ type: "admin_broadcast", title: "Placement", url: "https://example.com/event", data: { image: "/poster.png" } });
    expect(payload.url).toBe("https://example.com/event");
    expect(payload.image).toBe("/poster.png");
    expect(payload.actions[1].action).toBe("dismiss");
    expect(payload.icon).toBe("/icon-notification.png");
  });
  it("opens Announcements for an unspecified admin destination", () => {
    expect(buildPushPayload({ type: "admin_broadcast", title: "Update", url: "/" }).url).toBe("/?view=notifications");
  });
  it.each(["javascript:alert(1)", "//example.com/poster.png", "http://example.com/image.png", "data:image/png;base64,xx", 123])("rejects unsupported poster URL %s", raw => {
    expect(pushImage(raw)).toBeUndefined();
  });
  it.each(["view=fullSchedule&date=2026-10-13&code=SCA&start=99:00", "view=today&date=2026-10-13&code=SCA&start=14:30", "view=fullSchedule&date=2026-10-13&code=%22%5D&start=14:30"])("ignores invalid focused links", query => {
    expect(pushSessionFromParams(new URLSearchParams(query))).toBeNull();
  });
});
