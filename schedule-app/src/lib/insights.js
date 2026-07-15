// Client-side analytics + course-info derivations, shared by CoursesPanel,
// InsightsPanel and DeadlineStrip. Everything here is computed from the
// already-loaded schedule (CLASSES), the user's enrollment and their local
// attendance/assignment stores — no extra network calls.
import { courseSkipStats, isExamSession, sessionKey } from "./attendance.js";
import { loadAssignments } from "./assignments.js";

export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

// Duration of one session in hours (falls back to 1h when times are missing)
function durationHrs(c) {
  const d = (toMin(c.end) - toMin(c.start)) / 60;
  return d > 0 ? d : 1;
}

// Per-course summary card data for every enrolled course.
export function courseStats(allClasses, enrolled, legend, attendance, now) {
  if (!enrolled) return [];
  const todayISO = ymd(now);
  return Object.entries(enrolled)
    .map(([code, section]) => {
      const meta = legend?.[code] || {};
      const sessions = allClasses.filter(
        (c) =>
          c.type === "class" &&
          c.code === code &&
          (c.section === section || c.section === "Single" || c.section === "All")
      );
      const faculty = [...new Set(sessions.map((c) => c.faculty).filter(Boolean))];
      const rooms = [...new Set(sessions.map((c) => c.room).filter(Boolean))];
      const teaching = sessions.filter((c) => !isExamSession(c));
      const done = teaching.filter((c) => c.date < todayISO).length;
      const upcoming = teaching
        .filter((c) => c.date >= todayISO)
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      const next = upcoming.find((c) => c.date > todayISO || toMin(c.end) >= now.getHours() * 60 + now.getMinutes()) || null;
      const rawCredit = meta.credits;
      const skip = courseSkipStats(allClasses, code, section, attendance, {
        zeroCredit: rawCredit === "0" || rawCredit === 0,
      });
      return {
        code,
        section,
        name: meta.name || code,
        credits: meta.credits,
        area: meta.area,
        faculty,
        rooms,
        total: teaching.length,
        done,
        remaining: Math.max(0, teaching.length - done),
        next,
        skip,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Aggregate stats over a Mon–Sun window offset from `now` (0 = this week).
export function weeklyRecap(visible, now, attendance, weekOffset = 0) {
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const startISO = ymd(monday);
  const endISO = ymd(sunday);

  const teaching = visible.filter(
    (c) => c.type === "class" && !isExamSession(c) && c.date >= startISO && c.date <= endISO
  );

  const perDay = Array.from({ length: 7 }, () => ({ count: 0, hrs: 0 }));
  const perArea = {};
  const perCourse = {};
  let totalHrs = 0;
  let firstMin = Infinity;
  let lastMin = -Infinity;

  for (const c of teaching) {
    const d = new Date(c.date + "T00:00:00");
    const idx = (d.getDay() + 6) % 7; // Mon=0
    const hrs = durationHrs(c);
    perDay[idx].count++;
    perDay[idx].hrs += hrs;
    totalHrs += hrs;
    perArea[c.area || "Other"] = (perArea[c.area || "Other"] || 0) + hrs;
    perCourse[c.code] = (perCourse[c.code] || 0) + 1;
    firstMin = Math.min(firstMin, toMin(c.start));
    lastMin = Math.max(lastMin, toMin(c.end));
  }

  const busiestIdx = perDay.reduce((best, d, i) => (d.hrs > perDay[best].hrs ? i : best), 0);
  const areaList = Object.entries(perArea).sort((a, b) => b[1] - a[1]);

  // Attendance marked within the window
  let present = 0, absent = 0;
  for (const c of teaching) {
    const st = attendance[sessionKey(c)];
    if (st === "present") present++;
    else if (st === "absent") absent++;
  }

  return {
    startISO,
    endISO,
    monday,
    sunday,
    totalSessions: teaching.length,
    totalHrs: Math.round(totalHrs * 10) / 10,
    perDay,
    busiest: teaching.length ? { day: WEEKDAY[(busiestIdx + 1) % 7], ...perDay[busiestIdx] } : null,
    areaList,
    topCourse: Object.entries(perCourse).sort((a, b) => b[1] - a[1])[0] || null,
    firstMin: firstMin === Infinity ? null : firstMin,
    lastMin: lastMin === -Infinity ? null : lastMin,
    marked: present + absent,
    present,
    absent,
    attendancePct: present + absent ? Math.round((present / (present + absent)) * 100) : null,
  };
}

// Merged, date-sorted exams + assignments due within `days` days from now.
export function upcomingDeadlines(visible, legend, now, days = 7) {
  const todayISO = ymd(now);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + days);
  const horizonISO = ymd(horizon);

  const items = [];

  // Exams / graded sessions from the user's own schedule
  for (const c of visible) {
    const isExam = c.type === "exam" || isExamSession(c);
    if (!isExam) continue;
    if (!c.code) continue; // skip generic entries like "Term Registration"
    // exam-type rows in `visible` aren't enrollment-filtered — keep enrolled only
    if (legend && !legend[c.code]) continue;
    if (c.date < todayISO || c.date > horizonISO) continue;
    items.push({
      key: `exam-${c.date}-${c.code}-${c.start}`,
      kind: "exam",
      code: c.code,
      courseName: legend?.[c.code]?.name || c.code,
      title: c.session || c.name || "Exam",
      date: c.date,
      time: c.start,
      room: c.room,
    });
  }

  // Assignments from the local store
  const store = loadAssignments();
  for (const [code, tasks] of Object.entries(store || {})) {
    if (code.startsWith("_")) continue; // internal keys like _assignments
    if (!Array.isArray(tasks)) continue;
    for (const t of tasks) {
      if (t.completed || !t.dueDate) continue;
      if (t.dueDate < todayISO || t.dueDate > horizonISO) continue;
      items.push({
        key: `assign-${t.id}`,
        kind: "assignment",
        code,
        courseName: legend?.[code]?.name || code,
        title: t.title || "Untitled task",
        date: t.dueDate,
        time: null,
      });
    }
  }

  return items.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
}

// Enrolled classes that were cancelled or moved within the next `days` days —
// drives the in-app cancellation/reschedule alert banner.
export function scheduleDisruptions(allClasses, enrolled, mine, legend, now, days = 2) {
  if (!enrolled || !mine) return [];
  const todayISO = ymd(now);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + days);
  const horizonISO = ymd(horizon);

  const out = [];
  for (const c of allClasses) {
    if (!c.code || !mine.has(c.code)) continue;
    const sec = enrolled[c.code];
    const mineSection = c.section === sec || c.section === "Single" || c.section === "All";
    if (!mineSection) continue;
    if (c.date < todayISO || c.date > horizonISO) continue;
    if (c.type === "cancelled") {
      out.push({
        key: `cx-${c.date}-${c.code}-${c.start}`,
        kind: "cancelled",
        code: c.code,
        courseName: legend?.[c.code]?.name || c.code,
        date: c.date,
        time: c.start,
      });
    }
  }
  return out.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
}
