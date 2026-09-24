import { describe, expect, it } from "vitest";
import { isPushCronStale, pushCronIssues } from "./pushCronHealth.js";

const now = Date.parse("2026-09-24T08:00:00Z");
const running = (jobname) => ({ jobname, active: true, status: "succeeded", last_run: "2026-09-24T07:59:00Z" });

describe("pushCronIssues", () => {
  it("flags a missing dispatcher even if other cron jobs are healthy", () => {
    expect(pushCronIssues([running("termflow-class-reminders")], now)).toEqual(["push dispatch cron not reported"]);
  });

  it("accepts both required push jobs when recent and successful", () => {
    expect(pushCronIssues([running("termflow-class-reminders"), running("termflow-dispatch")], now)).toEqual([]);
  });

  it("flags paused and failed jobs", () => {
    expect(pushCronIssues([
      { ...running("termflow-class-reminders"), active: false },
      { ...running("termflow-dispatch"), status: "failed", message: "HTTP 401" },
    ], now)).toEqual(["class reminders cron paused", "push dispatch cron failed: HTTP 401"]);
  });

  it("treats the class reminder overnight gap as scheduled downtime", () => {
    const overnight = Date.parse("2026-09-24T00:40:00Z");
    const job = { ...running("termflow-class-reminders"), schedule: "*/5 1-17 * * *", last_run: "2026-09-23T17:55:00Z" };
    expect(isPushCronStale(job, overnight)).toBe(false);
    expect(isPushCronStale({ ...job, last_run: "2026-09-23T17:25:00Z" }, overnight)).toBe(true);
    expect(isPushCronStale({ ...job, last_run: "2026-09-23T17:55:00Z" }, Date.parse("2026-09-24T01:25:00Z"))).toBe(true);
  });
});
