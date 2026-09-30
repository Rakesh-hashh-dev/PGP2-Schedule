const FEED_URL = "https://script.google.com/macros/s/AKfycbwOCmpZAbzN7hRkb-xx6-SDejt3c45E5NBZ0NHuJW8CBRYO4ROJfwE_MI_g4aODwo08Gg/exec";
const MAX_QUERY_LENGTH = 1200;
const MAX_COURSES = 32;
const MAX_FEED_BYTES = 2_000_000;

const esc = value => String(value || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const stamp = value => String(value || "").replace(/[-:]/g, "").slice(0, 8);
const time = value => String(value || "00:00").replace(":", "").padEnd(6, "0");
const safeToken = value => /^[A-Za-z0-9._ -]{1,32}$/.test(value);
const queryValue = value => String(Array.isArray(value) ? value[0] || "" : value || "");
const sectionMap = value => new Map(queryValue(value).split(",").slice(0, MAX_COURSES).map(pair => pair.split(":" )).filter(pair => pair.length === 2 && safeToken(pair[0]) && safeToken(pair[1])));

export function validCalendarQuery(query = {}) {
  const raw = ["courses", "sections", "classes", "exams", "reminder"].map(key => queryValue(query[key]));
  if (raw.join("&").length > MAX_QUERY_LENGTH) return false;
  const courses = queryValue(query.courses).split(",").filter(Boolean);
  if (!courses.length || courses.length > MAX_COURSES || courses.some(code => !safeToken(code))) return false;
  const reminder = queryValue(query.reminder);
  return !reminder || /^\d{1,4}$/.test(reminder);
}

export function calendarEvents(payload, query = {}) {
  const courses = new Set(queryValue(query.courses).split(",").slice(0, MAX_COURSES).filter(safeToken));
  const sections = sectionMap(query.sections);
  const includeClasses = query.classes !== "0";
  const includeExams = query.exams !== "0";
  return (Array.isArray(payload?.CLASSES) ? payload.CLASSES : []).filter(item => {
    const type = item.type || "class";
    if (type === "class" && !includeClasses) return false;
    if (type === "exam" && !includeExams) return false;
    if (!courses.has(item.code)) return false;
    const wanted = sections.get(item.code);
    return !wanted || !item.section || item.section === wanted || item.section === "Single" || item.section === "All";
  });
}

export function buildCalendar(events, query = {}) {
  const reminder = Math.max(0, Math.min(1440, Number(query.reminder) || 15));
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TermFlow//Live Schedule//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:TermFlow PGP2 Live"];
  for (const item of events) {
    const day = stamp(item.date);
    if (!day) continue;
    const start = `${day}T${time(item.start)}`;
    const end = `${day}T${time(item.end || item.start)}`;
    const uid = `${day}-${item.code || "event"}-${time(item.start)}-${item.section || "all"}@termflow.tech`;
    lines.push("BEGIN:VEVENT", `UID:${esc(uid)}`, `DTSTART;TZID=Asia/Kolkata:${start}`, `DTEND;TZID=Asia/Kolkata:${end}`, `SUMMARY:${esc(`${item.code ? `${item.code} · ` : ""}${item.name || item.session || "Scheduled session"}`)}`, `LOCATION:${esc(item.room || "")}`, `DESCRIPTION:${esc([item.section && `Section ${item.section}`, item.faculty].filter(Boolean).join(" · "))}`);
    if (reminder) lines.push("BEGIN:VALARM", `TRIGGER:-PT${reminder}M`, "ACTION:DISPLAY", `DESCRIPTION:${esc(item.code || "TermFlow class")}`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export default async function handler(request, response) {
  response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (!["GET", "HEAD"].includes(request.method || "GET")) {
    response.setHeader("Allow", "GET, HEAD");
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (!validCalendarQuery(request.query || {})) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(400).json({ error: "Invalid calendar options" });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let result;
    try {
      result = await fetch(FEED_URL, { redirect: "follow", headers: { accept: "application/json" }, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!result.ok) throw new Error(`Schedule feed returned ${result.status}`);
    const body = await result.text();
    if (body.length > MAX_FEED_BYTES) throw new Error("Schedule feed exceeded size limit");
    const payload = JSON.parse(body);
    const events = calendarEvents(payload, request.query || {});
    response.setHeader("Content-Type", "text/calendar; charset=utf-8");
    response.setHeader("Content-Disposition", 'inline; filename="termflow-live.ics"');
    response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=900");
    const calendar = buildCalendar(events, request.query || {});
    response.status(200).send(request.method === "HEAD" ? "" : calendar);
  } catch {
    response.setHeader("Cache-Control", "no-store");
    response.status(503).json({ error: "Calendar feed unavailable" });
  }
}
