export const TOOLKIT_KEYS = {
  careers: "pgp2.toolkit.careers",
  study: "pgp2.toolkit.study-sessions",
  calendar: "pgp2.toolkit.calendar-preferences",
};

export const DEFAULT_CALENDAR_PREFS = {
  reminderMinutes: 15,
  includeClasses: true,
  includeExams: true,
  notifyChanges: true,
  digestTime: "20:00",
};

export function readToolkitValue(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeToolkitValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("termflow:toolkit-change", { detail: { key } }));
    return true;
  } catch {
    return false;
  }
}

export function careerSummary(items = [], now = new Date()) {
  const active = items.filter(item => !["rejected", "withdrawn", "offered"].includes(item.stage));
  const offered = items.filter(item => item.stage === "offered").length;
  const upcoming = active.filter(item => item.deadline && new Date(`${item.deadline}T23:59:59`) >= now)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  return { total: items.length, active: active.length, offered, next: upcoming[0] || null };
}

function enrolledSection(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] || "";
  return value?.section || value?.sec || "";
}

export function calendarSubscriptionUrl(origin, enrolled = {}, prefs = DEFAULT_CALENDAR_PREFS) {
  const url = new URL("/api/calendar", origin || "https://pgp2.termflow.tech");
  const codes = Object.keys(enrolled).filter(code => prefs.selectedCodes?.length ? prefs.selectedCodes.includes(code) : true);
  url.searchParams.set("courses", codes.join(","));
  const sections = codes.map(code => `${code}:${enrolledSection(enrolled[code])}`).filter(value => !value.endsWith(":"));
  if (sections.length) url.searchParams.set("sections", sections.join(","));
  url.searchParams.set("classes", prefs.includeClasses === false ? "0" : "1");
  url.searchParams.set("exams", prefs.includeExams === false ? "0" : "1");
  url.searchParams.set("reminder", String(Number(prefs.reminderMinutes) || 15));
  return url.toString();
}

export function upcomingStudySessions(items = [], now = new Date()) {
  return [...items].filter(item => item.status !== "done")
    .sort((a, b) => `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`))
    .map(item => ({ ...item, past: Boolean(item.date && new Date(`${item.date}T${item.time || "23:59"}`) < now) }));
}

export const BACKUP_KEYS = [
  "pgp2.attendance", "pgp2.assignments", "pgp2.course-hub-items", "pgp2.split.queue",
  "pgp2.planner-misses", "pgp2.planner-effort", "pgp2.planner-daily-study-budget",
  "pgp2.today-goals",
  "pgp2.toolkit.grades",
  ...Object.values(TOOLKIT_KEYS),
];

export function offlineInventory(storage = localStorage) {
  return BACKUP_KEYS.map(key => {
    const raw = storage.getItem(key);
    let count = 0;
    if (raw) {
      try {
        const value = JSON.parse(raw);
        count = Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : 1;
      } catch { count = 1; }
    }
    return { key, present: raw != null, count, bytes: raw ? new Blob([raw]).size : 0 };
  });
}

export function buildLocalBackup(storage = localStorage) {
  const data = {};
  for (const key of BACKUP_KEYS) {
    const value = storage.getItem(key);
    if (value != null) data[key] = value;
  }
  return { format: "termflow-local-backup", version: 1, createdAt: new Date().toISOString(), data };
}
