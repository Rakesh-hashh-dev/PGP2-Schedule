import { clsDate, fmtTime12, toMin, ymd } from "./datetime.js";
import { isExamSession, sessionKey } from "./attendance.js";

export const ATTENDANCE_TARGET = 80;

function localDay(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dayDiff(iso, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((localDay(iso) - today) / 86400000);
}

export function flattenAssignments(assignments = {}, legend = {}, now = new Date()) {
  return Object.entries(assignments || {}).flatMap(([code, tasks]) =>
    (Array.isArray(tasks) ? tasks : []).map((task) => {
      const days = task.dueDate ? dayDiff(task.dueDate, now) : null;
      const urgency = task.completed ? "done"
        : days == null ? "undated"
          : days < 0 ? "overdue"
            : days === 0 ? "today"
              : days <= 3 ? "soon" : "later";
      return {
        ...task,
        code,
        courseName: legend[code]?.name || code,
        days,
        urgency,
      };
    })
  );
}

export function buildAttendanceForecast({ allClasses = [], enrolled = {}, attendance = {}, legend = {}, now = new Date(), plannedMisses = {} }) {
  return Object.entries(enrolled || {}).map(([code, section]) => {
    const sessions = allClasses
      .filter((item) => item.type === "class" && !isExamSession(item) && item.code === code && (item.section === section || item.section === "Single" || item.section === "All"))
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    const past = sessions.filter((item) => clsDate(item, "end") <= now);
    const upcoming = sessions.filter((item) => clsDate(item, "start") > now);
    let present = 0;
    let absent = 0;
    past.forEach((item) => {
      const mark = attendance[sessionKey(item)];
      if (mark === "present") present += 1;
      if (mark === "absent") absent += 1;
    });
    const marked = present + absent;
    const misses = Math.max(0, Math.min(Number(plannedMisses[code]) || 0, upcoming.length));
    const projectedMarked = marked + misses;
    const currentPct = marked ? Math.round((present / marked) * 100) : null;
    const projectedPct = projectedMarked ? Math.round((present / projectedMarked) * 100) : null;
    const recoveryNeeded = projectedMarked && projectedPct < ATTENDANCE_TARGET
      ? Math.max(0, Math.ceil((ATTENDANCE_TARGET * projectedMarked - 100 * present) / (100 - ATTENDANCE_TARGET)))
      : 0;
    const safeMisses = marked
      ? Math.max(0, Math.floor(present / (ATTENDANCE_TARGET / 100) - marked))
      : 0;
    return {
      code,
      name: legend[code]?.name || code,
      present,
      absent,
      marked,
      currentPct,
      projectedPct,
      plannedMisses: misses,
      upcoming: upcoming.length,
      safeMisses,
      recoveryNeeded,
      risk: projectedPct == null ? "unknown" : projectedPct < ATTENDANCE_TARGET ? "risk" : projectedPct < 85 ? "watch" : "safe",
    };
  }).sort((a, b) => (a.projectedPct ?? 101) - (b.projectedPct ?? 101));
}

export function findFreeWindows(classes = [], now = new Date(), days = 7, minMinutes = 60) {
  const windows = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const iso = ymd(date);
    const dayStart = offset === 0 ? Math.max(8 * 60, now.getHours() * 60 + now.getMinutes()) : 8 * 60;
    const dayEnd = 22 * 60;
    const busy = classes
      .filter((item) => item.date === iso && (item.type === "class" || item.type === "exam") && item.start && item.end)
      .map((item) => [toMin(item.start), toMin(item.end)])
      .sort((a, b) => a[0] - b[0]);
    let cursor = dayStart;
    busy.forEach(([start, end]) => {
      if (start - cursor >= minMinutes) windows.push({ date: iso, start: cursor, end: start, minutes: start - cursor });
      cursor = Math.max(cursor, end);
    });
    if (dayEnd - cursor >= minMinutes) windows.push({ date: iso, start: cursor, end: dayEnd, minutes: dayEnd - cursor });
  }
  return windows;
}

export function buildWeeklyPlanner({ visible = [], assignments = {}, effort = {}, now = new Date() }) {
  const windows = findFreeWindows(visible, now);
  const tasks = flattenAssignments(assignments, {}, now).filter((task) => !task.completed);
  const estimateOf = (task) => {
    const minutes = Number(effort[task.id]);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  };
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
    const dueTasks = tasks.filter((task) => task.dueDate === date);
    const classMinutes = visible
      .filter((item) => item.date === date && (item.type === "class" || item.type === "exam") && item.start && item.end)
      .reduce((sum, item) => sum + Math.max(0, toMin(item.end) - toMin(item.start)), 0);
    const potentialMinutes = windows.filter((slot) => slot.date === date).reduce((sum, slot) => sum + slot.minutes, 0);
    const estimatedMinutes = dueTasks.reduce((sum, task) => sum + estimateOf(task), 0);
    return { date, classMinutes, potentialMinutes, estimatedMinutes, dueCount: dueTasks.length };
  });
  const dueTasks = tasks.filter((task) => days.some((day) => day.date === task.dueDate));
  const unestimatedCount = dueTasks.filter((task) => !estimateOf(task)).length;
  return {
    days,
    estimatedMinutes: days.reduce((sum, day) => sum + day.estimatedMinutes, 0),
    potentialMinutes: days.reduce((sum, day) => sum + day.potentialMinutes, 0),
    dueCount: dueTasks.length,
    unestimatedCount,
  };
}

export function buildAttendanceScenario(course) {
  const count = Math.min(course.plannedMisses, course.upcoming);
  if (!count) return { count: 0, attendPct: course.currentPct, missPct: course.currentPct };
  const denominator = course.marked + count;
  return {
    count,
    attendPct: Math.round(((course.present + count) / denominator) * 100),
    missPct: Math.round((course.present / denominator) * 100),
  };
}

export function buildDailyBrief({ today = [], tomorrow = [], assignments = {}, changes = [], attendanceForecast = [], legend = {}, now = new Date() }) {
  const tasks = flattenAssignments(assignments, legend, now)
    .filter((task) => !task.completed && task.days != null && task.days <= 3)
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);
  const isClass = (item) => item.type === "class" && !isExamSession(item);
  const upcomingClasses = today
    .filter((item) => isClass(item) && item.start && clsDate(item, "start") > now)
    .sort((a, b) => a.start.localeCompare(b.start));
  const nextClass = upcomingClasses[0] || null;
  const risks = attendanceForecast.filter((item) => item.risk === "risk" || item.risk === "watch").slice(0, 3);
  const relevantChanges = changes.filter((item) => !item.date || item.date >= ymd(now)).slice(0, 4);
  return {
    nextClass,
    classesLeft: upcomingClasses.length,
    tomorrowCount: tomorrow.filter(isClass).length,
    tasks,
    risks,
    changes: relevantChanges,
  };
}

export function buildPlannerInsights({ visible = [], assignments = {}, attendanceForecast = [], now = new Date() }) {
  const tasks = flattenAssignments(assignments, {}, now);
  const completed = tasks.filter((task) => task.completed).length;
  const datedOpen = tasks.filter((task) => !task.completed && task.dueDate);
  const weekdayCounts = new Map();
  visible.filter((item) => item.type === "class").forEach((item) => {
    const label = localDay(item.date).toLocaleDateString([], { weekday: "short" });
    weekdayCounts.set(label, (weekdayCounts.get(label) || 0) + 1);
  });
  const busiest = [...weekdayCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const withAttendance = attendanceForecast.filter((item) => item.currentPct != null);
  const averageAttendance = withAttendance.length
    ? Math.round(withAttendance.reduce((sum, item) => sum + item.currentPct, 0) / withAttendance.length)
    : null;
  return {
    completed,
    open: tasks.length - completed,
    dueThisWeek: datedOpen.filter((task) => task.days >= 0 && task.days <= 7).length,
    overdue: tasks.filter((task) => task.urgency === "overdue").length,
    completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : null,
    averageAttendance,
    attendanceRisks: attendanceForecast.filter((item) => item.risk === "risk").length,
    busiestDay: busiest?.[0] || "—",
    busiestDayCount: busiest?.[1] || 0,
  };
}

export function minutesLabel(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return fmtTime12(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
}
