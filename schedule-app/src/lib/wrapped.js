// TermFlow Wrapped — pure, local-first recap analytics over the schedule and
// attendance data already available in the app. Optional assignments and mess
// preferences are intentionally excluded for archived terms because those
// stores are not term-scoped.
import { isExamSession, sessionKey } from "./attendance.js";
import { loadAssignments } from "./assignments.js";
import { loadMessLikes, loadMessFavourites } from "../data/messMenu.js";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_BANDS = [
  { id: "morning", label: "Morning", shortLabel: "AM", from: 0, to: 12 * 60 },
  { id: "afternoon", label: "Afternoon", shortLabel: "PM", from: 12 * 60, to: 17 * 60 },
  { id: "evening", label: "Evening", shortLabel: "Eve", from: 17 * 60, to: 24 * 60 },
];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDate(dateISO) {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function fmt12(t) {
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

function durationHrs(c) {
  const start = toMin(c.start);
  const end = toMin(c.end);
  const duration = start !== null && end !== null ? (end - start) / 60 : 0;
  return duration > 0 ? duration : 1;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

// Monday-anchored ISO date of the week containing dateISO.
function weekKey(dateISO) {
  const d = localDate(dateISO);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}

function prettyDate(iso, options = { weekday: "long", day: "numeric", month: "short" }) {
  return localDate(iso).toLocaleDateString([], options);
}

function weekRangeLabel(startISO) {
  const start = localDate(startISO);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const startLabel = start.toLocaleDateString([], { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString([], { day: "numeric", month: "short" });
  return `${startLabel} – ${endLabel}`;
}

function isHeld(c, todayISO, nowMin) {
  if (c.type !== "class" || isExamSession(c)) return false;
  if (c.date < todayISO) return true;
  if (c.date !== todayISO) return false;
  const end = toMin(c.end);
  return end !== null && end <= nowMin;
}

function attendanceStatus(attendance, c) {
  const status = attendance?.[sessionKey(c)];
  return status === "present" || status === "absent" ? status : "unmarked";
}

function buildWeeklyLoad(perWeek) {
  const populated = Object.keys(perWeek).sort();
  if (!populated.length) return [];

  const rows = [];
  const cursor = localDate(populated[0]);
  const last = localDate(populated[populated.length - 1]);
  let index = 1;
  while (cursor <= last) {
    const startISO = ymd(cursor);
    const value = perWeek[startISO] || { hours: 0, sessions: 0 };
    rows.push({
      index,
      startISO,
      label: `Week ${index}`,
      rangeLabel: weekRangeLabel(startISO),
      hours: round1(value.hours),
      sessions: value.sessions,
      classes: value.classes || [],
    });
    cursor.setDate(cursor.getDate() + 7);
    index++;
  }
  return rows;
}

function sessionSummary(c, status = "unmarked") {
  return {
    type: c.type,
    date: c.date,
    code: c.code || "",
    name: c.name || c.code || "Session",
    session: c.session || "",
    start: c.start || "",
    end: c.end || "",
    room: c.room || "",
    status,
    hours: round1(durationHrs(c)),
  };
}

function eventHasFinished(c, todayISO, nowMin) {
  if (c.date < todayISO) return true;
  if (c.date !== todayISO) return false;
  const end = toMin(c.end);
  return end !== null && end <= nowMin;
}

function buildCourseWeeks(sessions) {
  const weeks = {};
  for (const session of sessions) {
    const startISO = weekKey(session.date);
    const week = (weeks[startISO] ??= { startISO, hours: 0, sessions: 0, present: 0, absent: 0, unmarked: 0 });
    week.hours += session.hours;
    week.sessions++;
    week[session.status]++;
  }
  return Object.values(weeks)
    .sort((a, b) => a.startISO.localeCompare(b.startISO))
    .map((week, index) => ({
      ...week,
      index: index + 1,
      label: `Week ${index + 1}`,
      rangeLabel: weekRangeLabel(week.startISO),
      hours: round1(week.hours),
    }));
}

function buildConfidence(coveragePct, marked) {
  if (!marked) return { level: "none", label: "No attendance evidence", message: "Attendance conclusions are hidden until you mark some completed sessions." };
  if (coveragePct >= 80) return { level: "high", label: "High confidence", message: `Based on marks for ${coveragePct}% of completed sessions.` };
  if (coveragePct >= 50) return { level: "medium", label: "Moderate confidence", message: `Attendance insights use ${coveragePct}% marking coverage; unmarked sessions remain unknown.` };
  return { level: "low", label: "Limited confidence", message: `Only ${coveragePct}% of completed sessions were marked, so attendance patterns may be incomplete.` };
}

function buildArchetype({ attendancePct, coveragePct, rhythm, busiestWeek, averageWeeklyHours, topCourse, totalHours }) {
  if (coveragePct >= 70 && attendancePct !== null && attendancePct >= 90) {
    return { id: "consistent", title: "Consistency Champion", description: `${attendancePct}% attendance with ${coveragePct}% of completed sessions marked.` };
  }
  if (rhythm.busiest?.bandId === "morning") {
    return { id: "morning", title: "Morning Sprinter", description: `${rhythm.busiest.day} mornings were your most class-heavy recurring window.` };
  }
  if (rhythm.busiest?.bandId === "evening") {
    return { id: "evening", title: "After-Hours Operator", description: `${rhythm.busiest.day} evenings carried your densest recurring workload.` };
  }
  if (busiestWeek && averageWeeklyHours && busiestWeek.hours >= averageWeeklyHours * 1.35) {
    return { id: "peak", title: "Peak-Week Survivor", description: `${busiestWeek.label} ran ${Math.round(((busiestWeek.hours / averageWeeklyHours) - 1) * 100)}% above your weekly average.` };
  }
  if (topCourse && totalHours && topCourse.hours / totalHours >= .22) {
    return { id: "specialist", title: "Deep-Dive Specialist", description: `${topCourse.code} accounted for ${Math.round((topCourse.hours / totalHours) * 100)}% of your classroom time.` };
  }
  return { id: "steady", title: "Steady Navigator", description: "Your workload stayed relatively balanced across weeks and courses." };
}

function buildInsights({ rhythm, busiestWeek, averageWeeklyHours, bestAttended, topCourse, totalHours, attendance }) {
  const insights = [];
  if (rhythm.busiest) {
    insights.push({ id: "rhythm", text: `${rhythm.busiest.day} ${rhythm.busiest.bandLabel.toLowerCase()} carried your highest recurring class load.` });
  }
  if (busiestWeek && averageWeeklyHours) {
    const delta = Math.round(((busiestWeek.hours / averageWeeklyHours) - 1) * 100);
    insights.push({ id: "peak", text: `${busiestWeek.label} was ${Math.abs(delta)}% ${delta >= 0 ? "heavier" : "lighter"} than your weekly average.` });
  }
  if (bestAttended && attendance.coveragePct >= 50) {
    insights.push({ id: "attendance", text: `Your strongest marked attendance was in ${bestAttended.code} at ${bestAttended.pct}%.` });
  } else if (topCourse && totalHours) {
    insights.push({ id: "course", text: `${topCourse.code} took ${Math.round((topCourse.hours / totalHours) * 100)}% of your total classroom time.` });
  }
  return insights.slice(0, 3);
}

function buildRhythm(held) {
  const rows = TIME_BANDS.map((band) => ({
    ...band,
    cells: DAY_LABELS.map((day, dayIndex) => ({ day, dayIndex, hours: 0, sessions: 0, intensity: 0 })),
  }));

  for (const c of held) {
    const start = toMin(c.start) ?? 0;
    const bandIndex = TIME_BANDS.findIndex((band) => start >= band.from && start < band.to);
    const dayIndex = (localDate(c.date).getDay() + 6) % 7;
    const cell = rows[Math.max(0, bandIndex)].cells[dayIndex];
    cell.hours += durationHrs(c);
    cell.sessions++;
  }

  const maxHours = Math.max(0, ...rows.flatMap((row) => row.cells.map((cell) => cell.hours)));
  for (const row of rows) {
    row.cells = row.cells.map((cell) => ({
      ...cell,
      hours: round1(cell.hours),
      intensity: maxHours ? cell.hours / maxHours : 0,
    }));
  }

  const busiest = rows
    .flatMap((row) => row.cells.map((cell) => ({ ...cell, bandId: row.id, bandLabel: row.label })))
    .sort((a, b) => b.hours - a.hours || b.sessions - a.sessions)[0] || null;

  return {
    dayLabels: DAY_LABELS,
    rows,
    maxHours: round1(maxHours),
    busiest: busiest?.hours > 0 ? busiest : null,
  };
}

function longestPresentStreak(held, attendance) {
  let current = 0;
  let currentStart = null;
  let best = 0;
  let bestStart = null;
  let bestEnd = null;

  for (const c of held) {
    if (attendanceStatus(attendance, c) === "present") {
      if (current === 0) currentStart = c.date;
      current++;
      if (current > best) {
        best = current;
        bestStart = currentStart;
        bestEnd = c.date;
      }
    } else {
      current = 0;
      currentStart = null;
    }
  }

  return best ? { count: best, startISO: bestStart, endISO: bestEnd } : null;
}

function loadLocalExtras(enabled) {
  if (!enabled) {
    return { assignmentsDone: 0, assignmentsTotal: 0, likedDishes: [], dislikedDishes: [], favouriteCount: 0 };
  }

  let assignmentsDone = 0;
  let assignmentsTotal = 0;
  const assignments = loadAssignments();
  for (const [code, tasks] of Object.entries(assignments || {})) {
    if (code.startsWith("_") || !Array.isArray(tasks)) continue;
    for (const task of tasks) {
      assignmentsTotal++;
      if (task.completed) assignmentsDone++;
    }
  }

  const likes = loadMessLikes();
  const likedDishes = Object.entries(likes).filter(([, value]) => value === 1).map(([dish]) => dish);
  const dislikedDishes = Object.entries(likes).filter(([, value]) => value === -1).map(([dish]) => dish);

  return {
    assignmentsDone,
    assignmentsTotal,
    likedDishes,
    dislikedDishes,
    favouriteCount: loadMessFavourites().size,
  };
}

/**
 * Build the recap for enrollment-filtered schedule rows.
 * Returns null when fewer than ten regular class sessions have finished.
 */
export function buildWrapped(visible = [], legend = {}, attendance = {}, now = new Date(), options = {}) {
  const todayISO = ymd(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const held = visible
    .filter((c) => isHeld(c, todayISO, nowMin))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || "") || (a.code || "").localeCompare(b.code || ""));

  if (held.length < 10) return null;

  let totalHours = 0;
  let present = 0;
  let absent = 0;
  let earliest = null;
  const perCourse = {};
  const perDay = {};
  const perWeek = {};

  for (const c of held) {
    const hours = durationHrs(c);
    const code = c.code || "Other";
    const status = attendanceStatus(attendance, c);
    totalHours += hours;

    const summary = sessionSummary(c, status);
    const course = (perCourse[code] ??= { code, held: 0, hours: 0, present: 0, absent: 0, unmarked: 0, sessions: [] });
    course.held++;
    course.hours += hours;
    course[status]++;
    course.sessions.push(summary);

    const day = (perDay[c.date] ??= { date: c.date, sessions: 0, hours: 0, classes: [] });
    day.sessions++;
    day.hours += hours;
    day.classes.push(summary);

    const monday = weekKey(c.date);
    const week = (perWeek[monday] ??= { sessions: 0, hours: 0, classes: [] });
    week.sessions++;
    week.hours += hours;
    week.classes.push(summary);

    if (c.start && (!earliest || c.start < earliest)) earliest = c.start;
    if (status === "present") present++;
    if (status === "absent") absent++;
  }

  const marked = present + absent;
  const unmarked = held.length - marked;
  const attendancePct = marked ? Math.round((present / marked) * 100) : null;
  const coveragePct = Math.round((marked / held.length) * 100);
  const courseName = (code) => legend?.[code]?.name || code;

  const courses = Object.values(perCourse)
    .map((course) => {
      const courseMarked = course.present + course.absent;
      const weeks = buildCourseWeeks(course.sessions);
      return {
        ...course,
        name: courseName(course.code),
        hours: round1(course.hours),
        attendancePct: courseMarked ? Math.round((course.present / courseMarked) * 100) : null,
        coveragePct: Math.round((courseMarked / course.held) * 100),
        weeks,
        peakWeek: [...weeks].sort((a, b) => b.hours - a.hours || b.sessions - a.sessions)[0] || null,
      };
    })
    .sort((a, b) => b.hours - a.hours || b.held - a.held || a.code.localeCompare(b.code));

  const pastExams = visible
    .filter((c) => (c.type === "exam" || isExamSession(c)) && eventHasFinished(c, todayISO, nowMin))
    .map((c) => sessionSummary({ ...c, type: "exam" }));
  const weeklyLoad = buildWeeklyLoad(perWeek).map((week) => {
    const exams = pastExams.filter((exam) => weekKey(exam.date) === week.startISO);
    const dayTotals = {};
    for (const item of week.classes) {
      const day = (dayTotals[item.date] ??= { date: item.date, sessions: 0, hours: 0 });
      day.sessions++;
      day.hours += item.hours;
    }
    const busiestDay = Object.values(dayTotals).sort((a, b) => b.hours - a.hours || b.sessions - a.sessions)[0] || null;
    return {
      ...week,
      exams,
      events: [...week.classes, ...exams].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
      busiestDay: busiestDay ? { ...busiestDay, hours: round1(busiestDay.hours), label: prettyDate(busiestDay.date) } : null,
    };
  });
  const busiestWeekRow = weeklyLoad.filter((week) => week.sessions > 0).sort((a, b) => b.hours - a.hours || b.sessions - a.sessions)[0] || null;
  const busiestDayRow = Object.values(perDay).sort((a, b) => b.hours - a.hours || b.sessions - a.sessions || a.date.localeCompare(b.date))[0] || null;
  const mostSkippedCourse = courses.filter((course) => course.absent > 0).sort((a, b) => b.absent - a.absent || b.held - a.held)[0] || null;
  const bestAttendedCourse = courses
    .filter((course) => course.present + course.absent >= 3)
    .sort((a, b) => b.attendancePct - a.attendancePct || b.coveragePct - a.coveragePct || b.held - a.held)[0] || null;
  const earliestCount = earliest ? held.filter((c) => c.start === earliest).length : 0;
  const examsTaken = pastExams.length;
  const rhythm = buildRhythm(held);
  const streak = longestPresentStreak(held, attendance);
  const extras = loadLocalExtras(options.includeLocalExtras !== false);

  const topCourse = courses[0] || null;
  const averageWeeklyHours = weeklyLoad.length ? round1(totalHours / weeklyLoad.length) : 0;
  const busiestWeek = busiestWeekRow ? {
    ...busiestWeekRow,
    label: `Week of ${prettyDate(busiestWeekRow.startISO)}`,
  } : null;
  const busiestDay = busiestDayRow ? {
    ...busiestDayRow,
    hours: round1(busiestDayRow.hours),
    count: busiestDayRow.sessions,
    label: prettyDate(busiestDayRow.date),
  } : null;

  const base = {
    heldSessions: held.length,
    totalHrs: Math.round(totalHours),
    totalHours: round1(totalHours),
    courseCount: courses.length,
    marked,
    present,
    absent,
    unmarked,
    attendancePct,
    attendance: { present, absent, unmarked, marked, pct: attendancePct, coveragePct },
    courses,
    weeklyLoad,
    averageWeeklyHours,
    maxWeeklyHours: Math.max(0, ...weeklyLoad.map((week) => week.hours)),
    rhythm,
    longestPresentStreak: streak,
    mostSkipped: mostSkippedCourse ? { code: mostSkippedCourse.code, name: mostSkippedCourse.name, absent: mostSkippedCourse.absent } : null,
    bestAttended: bestAttendedCourse ? { code: bestAttendedCourse.code, name: bestAttendedCourse.name, pct: bestAttendedCourse.attendancePct } : null,
    topCourse: topCourse ? { code: topCourse.code, name: topCourse.name, hrs: Math.round(topCourse.hours) } : null,
    busiestWeek,
    busiestDay,
    earliest: earliest ? { time: fmt12(earliest), count: earliestCount } : null,
    earlyStarts: held.filter((c) => (toMin(c.start) ?? Infinity) < 9 * 60).length,
    examsTaken,
    ...extras,
  };
  base.confidence = buildConfidence(base.attendance.coveragePct, base.marked);
  base.archetype = buildArchetype({
    attendancePct: base.attendancePct,
    coveragePct: base.attendance.coveragePct,
    rhythm: base.rhythm,
    busiestWeek: base.busiestWeek,
    averageWeeklyHours: base.averageWeeklyHours,
    topCourse: courses[0] || null,
    totalHours: base.totalHours,
  });
  base.insights = buildInsights({
    rhythm: base.rhythm,
    busiestWeek: base.busiestWeek,
    averageWeeklyHours: base.averageWeeklyHours,
    bestAttended: base.bestAttended,
    topCourse: courses[0] || null,
    totalHours: base.totalHours,
    attendance: base.attendance,
  });
  return base;
}

export function buildWrappedComparison(current, previous, currentLabel = "This term", previousLabel = "Previous term") {
  if (!current || !previous) return null;
  const metric = (id, label, currentValue, previousValue, unit = "", lowerIsBetter = false, deltaUnit = unit) => {
    if (currentValue == null || previousValue == null) return null;
    const delta = round1(currentValue - previousValue);
    return { id, label, current: currentValue, previous: previousValue, delta, unit, deltaUnit, lowerIsBetter };
  };
  const metrics = [
    metric("hours", "Classroom hours", current.totalHours, previous.totalHours, "h"),
    current.marked && previous.marked ? metric("attendance", "Attendance", current.attendancePct, previous.attendancePct, "%", false, "pp") : null,
    current.marked && previous.marked ? metric("skips", "Skipped sessions", current.absent, previous.absent, "", true) : null,
    metric("peak", "Peak-week hours", current.busiestWeek?.hours, previous.busiestWeek?.hours, "h", true),
    metric("early", "Starts before 9 AM", current.earlyStarts, previous.earlyStarts, "", true),
  ].filter(Boolean);
  return metrics.length ? { currentLabel, previousLabel, metrics } : null;
}
