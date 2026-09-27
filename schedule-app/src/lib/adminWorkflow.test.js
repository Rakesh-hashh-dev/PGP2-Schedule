import { describe, expect, it } from "vitest";
import { buildAdoptionTrend, buildBroadcastAudience, buildChangeTimeline, buildDataQualityIssues, buildScheduleImpact, buildSupportQueue, feedbackState, previewScheduleChange, previewStagedScheduleChanges } from "./adminWorkflow.js";

const users = [
  { user_id: "u1", name: "A", email: "a@example.com", courses: { DSC_A: true }, last_seen_at: "2026-09-26T10:00:00Z" },
  { user_id: "u2", name: "B", email: "b@example.com", courses: {}, last_seen_at: null },
  { user_id: "u3", name: "C", email: "c@example.com", courses: { DSC_B: true }, last_seen_at: "2026-09-01T10:00:00Z" },
];
const classes = [
  { date: "2026-09-28", section: "A", code: "DSC", name: "Supply Chain", type: "class", start: "10:00", end: "11:30", room: "A01", faculty: "Professor" },
  { date: "2026-09-28", section: "A", code: "MKT", name: "Marketing", type: "class", start: "12:00", end: "13:30", room: "A02", faculty: "Professor" },
];

describe("admin workflow signals", () => {
  it("prioritizes open feedback and flags incomplete or inactive profiles", () => {
    const feedback = [{ id: 1, user_id: "u1", status: "pending" }, { id: 2, user_id: "u2", status: "pending" }];
    const triage = { "1": { status: "resolved" } };
    expect(feedbackState(feedback[0], triage).status).toBe("resolved");
    const queue = buildSupportQueue(users, feedback, triage, Date.parse("2026-09-27T12:00:00Z"));
    expect(queue.map(row => row.user.user_id)).toEqual(["u2", "u3"]);
    expect(queue[0].reasons).toContain("1 open feedback item");
  });

  it("reports source failure, invalid class data and old overrides", () => {
    const issues = buildDataQualityIssues([...classes, { ...classes[0], code: "", room: "", end: "09:00" }], { "2026-09-01": { DSC_A: { room: "A03" } } }, { status: "failed", error: "HTTP 404", lastSuccessTs: "2026-09-20T00:00:00Z" }, Date.parse("2026-09-27T12:00:00Z"));
    expect(issues.some(issue => issue.key === "feed")).toBe(true);
    expect(issues.some(issue => issue.title === "Invalid class time")).toBe(true);
    expect(issues.some(issue => issue.key === "old:2026-09-01")).toBe(true);
  });

  it("counts the matching course audience and detects a proposed clash", () => {
    const preview = previewScheduleChange({ classes, users, date: "2026-09-28", code: "DSC", section: "A", original: { ...classes[0] }, proposed: { start: "12:15", end: "13:15", room: "A02" } });
    expect(preview.affected).toBe(1);
    expect(preview.conflicts).toContain("Room A02 overlaps MKT");
  });

  it("does not report an unchanged schedule overlap as a new clash", () => {
    const overlapping = { ...classes[1], start: "10:30", end: "11:30" };
    const preview = previewScheduleChange({ classes: [classes[0], overlapping], users, date: "2026-09-28", code: "DSC", section: "A", original: classes[0], proposed: { room: "A03" } });
    expect(preview.conflicts).toEqual([]);
  });

  it("includes newly staged changes and removed overrides in deploy preview", () => {
    const previous = { "2026-09-28": { MKT_A: { room: "A04" } } };
    const staged = { "2026-09-28": { DSC_A: { type: "cancelled" } } };
    const impact = previewStagedScheduleChanges(classes, staged, users, previous);
    expect(impact.changes).toHaveLength(2);
    expect(impact.changes.find(change => change.key === "MKT_A").restored).toBe(true);
    expect(impact.affected).toBe(1);
  });

  it("matches stored section values and combines audience filters", () => {
    const profiles = [
      { user_id: "u1", name: "A", courses: { DSC: "A" }, last_seen_at: "2026-09-26" },
      { user_id: "u2", name: "B", courses: { DSC: "B" }, last_seen_at: "2026-09-01" },
      { user_id: "u3", name: "C", courses: { DSC: "A", MKT: "B" }, last_seen_at: "2026-09-01" },
    ];
    expect(previewScheduleChange({ classes, users: profiles, date: "2026-09-28", code: "DSC", section: "A", original: classes[0], proposed: { room: "A03" } }).affected).toBe(2);
    expect(buildBroadcastAudience(profiles, { section: "B", course: "DSC", activity: "inactive" }, [], Date.parse("2026-09-27")).ids).toEqual(["u2"]);
  });

  it("summarizes a seven day schedule window and durable activity", () => {
    const impact = buildScheduleImpact(classes, { "2026-09-28": { DSC_A: { room: "B01" } } }, [{ start: "2026-09-28", end: "2026-09-29" }], "2026-09-27");
    expect(impact.days[1]).toMatchObject({ classes: 2, roomChanges: 1, announcements: 1 });
    const trend = buildAdoptionTrend([{ user_id: "u1", activity_date: "2026-09-27" }, { user_id: "u1", activity_date: "2026-09-26" }], users, Date.parse("2026-09-27T12:00:00Z"));
    expect(trend.current).toBe(1);
    expect(trend.completed).toBe(2);
    expect(buildChangeTimeline([{ id: 1, action: "push_broadcast", details: { title: "Update" } }])[0]).toMatchObject({ area: "broadcast", object: "Update" });
  });
});
