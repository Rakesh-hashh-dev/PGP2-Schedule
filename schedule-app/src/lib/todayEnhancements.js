import { isExamSession, sessionKey } from "./attendance.js";

export const TODAY_GOALS_KEY = "pgp2.today-goals";
export const TODAY_FOCUS_KEY = "pgp2.today-focus-mode";

const at = (session, field) => {
  const [year, month, day] = String(session?.date || "").split("-").map(Number);
  const [hour, minute] = String(session?.[field] || "00:00").split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
};

const isTeaching = session => session?.type === "class" || session?.type === "exam";
const isAttendanceClass = session => session?.type === "class" && !isExamSession(session);

export function flattenPendingAssignments(assignments = {}) {
  return Object.entries(assignments).flatMap(([code, items]) => (Array.isArray(items) ? items : [])
    .filter(item => !item.completed)
    .map(item => ({ ...item, code })))
    .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"));
}

export function findRoomTransition(list = [], now = new Date()) {
  const teaching = list.filter(isTeaching).slice().sort((a, b) => at(a, "start") - at(b, "start"));
  for (let index = 1; index < teaching.length; index += 1) {
    const previous = teaching[index - 1];
    const next = teaching[index];
    const gap = Math.round((at(next, "start") - at(previous, "end")) / 60000);
    const minutesToNext = Math.round((at(next, "start") - now) / 60000);
    if (minutesToNext >= 0 && minutesToNext <= 60 && gap >= 0 && gap <= 20 && previous.room && next.room && previous.room !== next.room) {
      return { previous, next, gap, minutesToNext };
    }
  }
  return null;
}

export function buildTodayCommandState({ todayList = [], tomorrowList = [], attendance = {}, assignments = {}, courseItems = [], now = new Date() } = {}) {
  const teaching = todayList.filter(isTeaching);
  const classes = todayList.filter(isAttendanceClass);
  const completed = classes.filter(session => at(session, "end") <= now);
  const marked = completed.filter(session => Boolean(attendance[sessionKey(session)]));
  const unmarked = completed.filter(session => !attendance[sessionKey(session)]);
  const current = teaching.find(session => at(session, "start") <= now && now < at(session, "end")) || null;
  const upcoming = teaching.filter(session => at(session, "start") > now).sort((a, b) => at(a, "start") - at(b, "start"));
  const next = upcoming[0] || null;
  const minutesToNext = next ? Math.round((at(next, "start") - now) / 60000) : null;
  const recent = [...completed].sort((a, b) => at(b, "end") - at(a, "end"))[0] || null;
  const recentAge = recent ? Math.round((now - at(recent, "end")) / 60000) : null;
  const hasRecentNote = recent ? courseItems.some(item => !item.deleted && item.kind === "note" && item.sessionKey === sessionKey(recent)) : false;
  const pendingTasks = flattenPendingAssignments(assignments);
  const tomorrowFirst = tomorrowList.filter(isTeaching).sort((a, b) => at(a, "start") - at(b, "start"))[0] || null;
  const endOfDay = teaching.length > 0 && !current && upcoming.length === 0;
  const progress = teaching.length ? Math.round((teaching.filter(session => at(session, "end") <= now).length / teaching.length) * 100) : 0;
  return {
    teaching,
    classes,
    completed,
    marked,
    unmarked,
    current,
    next,
    minutesToNext,
    recent: recentAge != null && recentAge >= 0 && recentAge <= 90 && !hasRecentNote ? recent : null,
    pendingTasks,
    nextTask: pendingTasks[0] || null,
    tomorrowFirst,
    endOfDay,
    freeDay: teaching.length === 0,
    transition: findRoomTransition(todayList, now),
    progress,
  };
}

export function readTodayGoals(date, storage = localStorage) {
  try {
    const all = JSON.parse(storage.getItem(TODAY_GOALS_KEY) || "{}");
    return Array.isArray(all?.[date]) ? all[date].slice(0, 3) : [];
  } catch { return []; }
}

export function writeTodayGoals(date, goals, storage = localStorage) {
  try {
    const all = JSON.parse(storage.getItem(TODAY_GOALS_KEY) || "{}");
    storage.setItem(TODAY_GOALS_KEY, JSON.stringify({ ...all, [date]: goals.slice(0, 3) }));
    return true;
  } catch { return false; }
}
