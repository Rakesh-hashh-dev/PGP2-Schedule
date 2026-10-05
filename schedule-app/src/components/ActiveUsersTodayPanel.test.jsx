import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActiveUsersTodayPanel from "./ActiveUsersTodayPanel.jsx";

const props = {
  users: [{ user_id: "student-1", name: "Test Student", email: "test@example.com", courses: { FIN: "A", _meta: "B" }, last_seen_at: "2026-10-02T00:00:00Z" }],
  day: { date: "3 Oct", isoDate: "2026-10-03", hourBuckets: Array.from({ length: 24 }, (_, i) => i === 10 ? 1 : 0), users: [{ userId: "student-1", seenTs: Date.parse("2026-10-03T04:30:00Z"), firstSeenTs: Date.parse("2026-10-03T04:00:00Z"), hours: [10], heartbeatCount: 6 }] },
  historyAvailable: true, asOf: Date.parse("2026-10-03T04:35:00Z"), pushIds: ["student-1"], roster: [], bannedIds: [], loading: false, readOnly: false,
};
describe("Active Users Today panel", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(props.asOf); });
  afterEach(() => vi.useRealTimers());
  it("uses today's presence record and excludes enrollment metadata", () => {
    const html = renderToStaticMarkup(<ActiveUsersTodayPanel {...props} />);
    expect(html).toContain("10:00 am IST");
    expect(html).toContain("1 subject");
    expect(html).toContain("(5m ago)");
    expect(html).toContain("test@example.com");
  });
  it("does not present fallback heartbeat counts as history", () => {
    const html = renderToStaticMarkup(<ActiveUsersTodayPanel {...props} historyAvailable={false} />);
    expect(html).toContain("Latest-heartbeat snapshot");
    expect(html).not.toContain("6 heartbeats");
    expect(html).toContain("first activity and heartbeat totals are unavailable");
  });
  it("keeps account controls out of the compact row and identifies read-only admins", () => {
    const html = renderToStaticMarkup(<ActiveUsersTodayPanel {...props} readOnly />);
    expect(html).not.toContain('aria-label="View as Test Student"');
    expect(html).toContain("Your monitor role permits read-only access.");
  });
  it("restores the active count and original explanation in the header", () => {
    const html = renderToStaticMarkup(<ActiveUsersTodayPanel {...props} />);
    expect(html).toContain("1 / 1 Active");
    expect(html).toContain("Unique students who opened TermFlow from 12:00 AM to 11:59 PM IST. Last-seen values refresh about every five minutes while the app is visible.");
    expect(html).toContain("More filters");
    expect(html).not.toContain('id="aut-extra-filters"');
  });
});
