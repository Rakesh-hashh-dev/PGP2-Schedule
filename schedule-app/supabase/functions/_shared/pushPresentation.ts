// Shared by dispatch and previews: Android renders one notification in two states.
type PushRow = {
  title: string; body?: string | null; type: string; url?: string | null;
  data?: Record<string, unknown> | null; dedup_key?: string; created_at?: string;
};

export function pushImage(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  try {
    const parsed = new URL(value, "https://termflow.invalid");
    if (parsed.protocol !== "https:") return undefined;
    return value.startsWith("https://") || /^\/(?![\/\\])/.test(value) ? value : undefined;
  } catch { return undefined; }
}

export function buildPushPayload(row: PushRow) {
  const detail = row.data || {};
  const fallback = row.type === "admin_broadcast" ? "/?view=notifications" : "/";
  let url = row.url && row.url !== "/" ? row.url : fallback;
  let actions = [{ action: "open", title: "Open TermFlow", url }];
  if (row.type === "class_reminder") {
    const date = String(detail.date || "");
    const code = String(detail.code || "");
    const start = String(detail.start || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && code && /^\d{2}:\d{2}$/.test(start)) {
      const query = new URLSearchParams({ view: "fullSchedule", date, code, start });
      url = `/?${query}`;
    }
    actions = [{ action: "open", title: "View class", url }, { action: "today", title: "Today's schedule", url: "/?view=today" }];
  } else if (row.type === "class_cancelled" || row.type === "schedule_change") {
    // Hidden cancelled classes may no longer have a timetable row.
    url = "/?view=notifications";
    actions = [{ action: "open", title: "View changes", url }, { action: "today", title: "Today's schedule", url: "/?view=today" }];
  } else if (row.type === "daily_summary") {
    url = "/?view=today";
    actions = [{ action: "open", title: "Today's schedule", url }, { action: "week", title: "This week", url: "/?view=week" }];
  } else if (row.type === "admin_broadcast") {
    actions = [{ action: "open", title: "Read update", url }, { action: "dismiss", title: "Dismiss", url: "" }];
  }
  return {
    title: row.title, body: row.body || "", type: row.type, url,
    tag: row.dedup_key, icon: "/icon-notification.png",
    image: pushImage(detail.image), actions,
    timestamp: row.created_at ? Date.parse(row.created_at) : undefined,
  };
}
