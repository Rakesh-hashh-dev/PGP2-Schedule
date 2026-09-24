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
  if (!Array.isArray(jobs)) return ["Cron health unavailable"];
  return REQUIRED.flatMap(({ label, names }) => {
    const job = jobs.find((item) => names.includes(item.jobname));
    if (!job) return [`${label} cron not reported`];
    if (!job.active) return [`${label} cron paused`];
    if (!job.last_run) return [`${label} cron has never run`];
    if ((job.status || "").toLowerCase() !== "succeeded") return [`${label} cron failed: ${job.message || job.status || "unknown error"}`];
    if (isPushCronStale(job, now)) return [`${label} cron is stale`];
    return [];
  });
}
