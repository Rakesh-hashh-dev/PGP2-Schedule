// TermFlow Wrapped — end-of-term recap stats. Pure derivations over data the
// app already holds locally (schedule, attendance store, assignments store,
// mess likes/favourites) — no network calls, testable without UI.
import { isExamSession, sessionKey } from "./attendance.js";
import { loadAssignments } from "./assignments.js";
import { loadMessLikes, loadMessFavourites } from "../data/messMenu.js";

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function fmt12(t) {
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

function durationHrs(c) {
  const s = toMin(c.start), e = toMin(c.end);
  const d = s !== null && e !== null ? (e - s) / 60 : 0;
  return d > 0 ? d : 1;
}

// Monday-anchored ISO of the week containing dateISO
function weekKey(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}

/**
 * Build the recap. `visible` = the user's enrollment-filtered class list,
 * `legend` = enrolled legend, `attendance` = local attendance store.
 * Returns null when there's too little term behind us to be fun (<10 sessions).
 */
export function buildWrapped(visible, legend, attendance, now) {
  const todayISO = ymd(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Sessions already held (past days, or today's classes that have ended)
  const held = visible.filter(c => {
    if (c.type !== "class" || isExamSession(c)) return false;
    if (c.date < todayISO) return true;
    if (c.date === todayISO) { const e = toMin(c.end); return e !== null && e <= nowMin; }
    return false;
  });
  if (held.length < 10) return null;

  let totalHrs = 0;
  const perCourse = {}; // code -> { held, hrs, present, absent }
  const perDay = {};    // dateISO -> count
  const perWeek = {};   // mondayISO -> hrs
  let earliest = null;  // "HH:MM"
  let present = 0, absent = 0;

  for (const c of held) {
    const hrs = durationHrs(c);
    totalHrs += hrs;
    const pc = (perCourse[c.code] ??= { held: 0, hrs: 0, present: 0, absent: 0 });
    pc.held++; pc.hrs += hrs;
    perDay[c.date] = (perDay[c.date] || 0) + 1;
    const wk = weekKey(c.date);
    perWeek[wk] = (perWeek[wk] || 0) + hrs;
    if (c.start && (!earliest || c.start < earliest)) earliest = c.start;

    const st = attendance?.[sessionKey(c)];
    if (st === "present") { present++; pc.present++; }
    else if (st === "absent") { absent++; pc.absent++; }
  }

  const marked = present + absent;
  const attendancePct = marked ? Math.round((present / marked) * 100) : null;

  const courseName = (code) => legend?.[code]?.name || code;
  const courses = Object.entries(perCourse);

  const mostSkippedEntry = courses.filter(([, v]) => v.absent > 0).sort((a, b) => b[1].absent - a[1].absent)[0] || null;
  const bestAttendedEntry = courses
    .filter(([, v]) => v.present + v.absent >= 3)
    .map(([code, v]) => [code, Math.round((v.present / (v.present + v.absent)) * 100)])
    .sort((a, b) => b[1] - a[1])[0] || null;
  const topCourseEntry = courses.sort((a, b) => b[1].hrs - a[1].hrs)[0] || null;

  const busiestWeekEntry = Object.entries(perWeek).sort((a, b) => b[1] - a[1])[0] || null;
  const busiestDayEntry = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0] || null;

  const earliestCount = earliest ? held.filter(c => c.start === earliest).length : 0;

  // Exams survived so far (from the user's visible schedule)
  const examsTaken = visible.filter(c => (c.type === "exam" || isExamSession(c)) && c.date < todayISO).length;

  // Assignments: completed count from the local store
  let assignmentsDone = 0, assignmentsTotal = 0;
  const store = loadAssignments();
  for (const [code, tasks] of Object.entries(store || {})) {
    if (code.startsWith("_") || !Array.isArray(tasks)) continue;
    for (const t of tasks) { assignmentsTotal++; if (t.completed) assignmentsDone++; }
  }

  // Mess taste profile (local likes/favourites)
  const likes = loadMessLikes();
  const likedDishes = Object.entries(likes).filter(([, v]) => v === 1).map(([dish]) => dish);
  const dislikedDishes = Object.entries(likes).filter(([, v]) => v === -1).map(([dish]) => dish);
  const favouriteCount = loadMessFavourites().size;

  const prettyDate = (iso) => {
    const [Y, M, D] = iso.split("-").map(Number);
    return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  };

  return {
    heldSessions: held.length,
    totalHrs: Math.round(totalHrs),
    courseCount: courses.length,
    marked, present, absent, attendancePct,
    mostSkipped: mostSkippedEntry ? { code: mostSkippedEntry[0], name: courseName(mostSkippedEntry[0]), absent: mostSkippedEntry[1].absent } : null,
    bestAttended: bestAttendedEntry ? { code: bestAttendedEntry[0], name: courseName(bestAttendedEntry[0]), pct: bestAttendedEntry[1] } : null,
    topCourse: topCourseEntry ? { code: topCourseEntry[0], name: courseName(topCourseEntry[0]), hrs: Math.round(topCourseEntry[1].hrs) } : null,
    busiestWeek: busiestWeekEntry ? { startISO: busiestWeekEntry[0], label: `Week of ${prettyDate(busiestWeekEntry[0])}`, hrs: Math.round(busiestWeekEntry[1]) } : null,
    busiestDay: busiestDayEntry ? { date: busiestDayEntry[0], label: prettyDate(busiestDayEntry[0]), count: busiestDayEntry[1] } : null,
    earliest: earliest ? { time: fmt12(earliest), count: earliestCount } : null,
    examsTaken,
    assignmentsDone, assignmentsTotal,
    likedDishes, dislikedDishes, favouriteCount,
  };
}
