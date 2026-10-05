const REQUIRED = [
  { label: "class reminders", names: ["termflow-class-reminders", "class-reminders"] },
  { label: "push dispatch", names: ["termflow-dispatch", "dispatch"] },
];

export function isPushCronStale(job, now = Date.now()) {
  if (!job?.last_run) return false;
  let latestExpected = now;
  // Class reminders run from 01:00 through 17:55 UTC. Overnight is idle.
  if (job.schedule === "*/5 1-17 * * *") {
    const slot = new Date(now);
    slot.setUTCSeconds(0, 0);
    const hour = slot.getUTCHours();
    if (hour === 0 || hour >= 18) {
      if (hour === 0) slot.setUTCDate(slot.getUTCDate() - 1);
      slot.setUTCHours(17, 55, 0, 0);
    } else {
      slot.setUTCMinutes(Math.floor(slot.getUTCMinutes() / 5) * 5);
    }
    latestExpected = slot.getTime();
  }
  return latestExpected - new Date(job.last_run).getTime() > 20 * 60_000;
}

export function pushCronIssues(jobs, now = Date.now()) {
  return pushCronIssueDetails(jobs, now).map(issue => issue.detail);
}

export function pushCronIssueDetails(jobs, now = Date.now()) {
  if (!Array.isArray(jobs)) return [{ detail: "Cron health unavailable", lastRun: null }];
  return REQUIRED.flatMap(({ label, names }) => {
    const job = jobs.find((item) => names.includes(item.jobname));
    const issue = detail => [{ detail, lastRun: job?.last_run || null }];
    if (!job) return issue(`${label} cron not reported`);
    if (!job.active) return issue(`${label} cron paused`);
    if (!job.last_run) return issue(`${label} cron has never run`);
    if ((job.status || "").toLowerCase() !== "succeeded") return issue(`${label} cron failed: ${job.message || job.status || "unknown error"}`);
    if (isPushCronStale(job, now)) return issue(`${label} cron is stale`);
    return [];
  });
}
