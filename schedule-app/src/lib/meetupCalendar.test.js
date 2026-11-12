import { describe, it, expect } from "vitest";
import { buildMeetupICS } from "./meetupCalendar.js";
describe("meetup calendar export", () => {
 const plan = { id: "immutable-id", title: "Study, prep\nNew line", starts_at: "2026-11-12T10:00:00Z", ends_at: "2026-11-12T11:00:00Z", version: 2, member_ids: ["private-user"], created_by: "owner" };
 it("keeps the UID after rescheduling with new sequence and UTC times", () => {
  const before = buildMeetupICS(plan); const after = buildMeetupICS({ ...plan, starts_at: "2026-11-13T10:00:00Z", ends_at: "2026-11-13T11:00:00Z", version: 3 });
  expect(before.match(/UID:.*/)[0]).toBe(after.match(/UID:.*/)[0]); expect(after).toContain("SEQUENCE:3"); expect(after).toContain("DTSTART:20261113T100000Z");
  expect(before).not.toContain("private-user"); expect(before).not.toContain("owner"); expect(before).toContain("Study\\, prep\\nNew line");
 });
 it("folds UTF8 lines within 75 octets without cutting characters", () => {
  const ics = buildMeetupICS({ ...plan, title: "\u2615".repeat(80) });
  expect(ics.split("\r\n").every(line => new TextEncoder().encode(line).length <= 75)).toBe(true);
  expect(ics.replace(/\r\n /g, "")).toContain("\u2615".repeat(80));
 });
});
