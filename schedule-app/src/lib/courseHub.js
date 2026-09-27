import { courseSkipStats, isExamSession, sessionKey } from "./attendance.js";

const dayKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const minute = (time = "00:00") => {
  const [hour, part] = time.split(":").map(Number);
  return (hour || 0) * 60 + (part || 0);
};
const minutesIn = (session) => Math.max(0, minute(session.end) - minute(session.start));

export function examCourseCode(exam, codes) {
  if (exam.code && codes.includes(exam.code)) return exam.code;
  const name = `${exam.name || ""} ${exam.session || ""}`.toUpperCase();
  return [...codes].sort((a, b) => b.length - a.length).find((code) =>
    new RegExp(`(^|[^A-Z0-9])${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Z0-9]|$)`).test(name)
  ) || null;
}

export function buildCourseHub({ allClasses = [], enrolled = {}, legend = {}, attendance = {}, assignments = {}, now = new Date() }) {
  const codes = Object.keys(enrolled).filter((code) => legend[code]);
  const today = dayKey(now);
  const nowMinute = minute(`${now.getHours()}:${now.getMinutes()}`);
  const sessions = allClasses.filter((item) => item.type === "class" && !isExamSession(item) && codes.includes(item.code) &&
    (item.section === enrolled[item.code] || item.section === "Single" || item.section === "All"));
  const exams = allClasses.filter((item) => item.type === "exam" || isExamSession(item));

  return codes.map((code) => {
    const info = legend[code] || {};
    const courseSessions = sessions.filter((item) => item.code === code).sort((a, b) => a.date.localeCompare(b.date) || minute(a.start) - minute(b.start));
    const courseExams = exams.filter((item) => examCourseCode(item, codes) === code).sort((a, b) => a.date.localeCompare(b.date) || minute(a.start) - minute(b.start));
    const nextClass = courseSessions.find((item) => item.date > today || (item.date === today && minute(item.end) > nowMinute)) || null;
    const nextExam = courseExams.find((item) => item.date >= today) || null;
    const tasks = (assignments[code] || []).filter(Boolean).sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
    const openTasks = tasks.filter((task) => !task.completed);
    const stats = courseSkipStats(allClasses, code, enrolled[code], attendance, { credits: info.credits, zeroCredit: Number(info.credits) === 0 });
    const marked = stats.present + stats.absent;
    const past = courseSessions.filter((item) => item.date < today || (item.date === today && minute(item.end) <= nowMinute));
    const history = past.filter((item) => attendance[sessionKey(item)] === "present" || attendance[sessionKey(item)] === "absent");
    return {
      code, name: info.name || code, area: info.area || "", credits: info.credits,
      section: enrolled[code], sessions: courseSessions, exams: courseExams, tasks,
      nextClass, nextExam, openTasks, stats,
      marked, coverage: past.length ? Math.round(marked / past.length * 100) : 0,
      history: history.map((item) => ({ date: item.date, start: item.start, status: attendance[sessionKey(item)] })),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function courseJourney(course, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start); end.setDate(end.getDate() + 28);
  const within = (date) => date >= dayKey(start) && date < dayKey(end);
  return [
    ...course.sessions.filter((item) => within(item.date)).map((item) => ({ kind: "class", date: item.date, start: item.start, title: item.name || course.name, item })),
    ...course.exams.filter((item) => within(item.date)).map((item) => ({ kind: "exam", date: item.date, start: item.start, title: item.name || "Exam", item })),
    ...course.tasks.filter((item) => item.dueDate && within(item.dueDate)).map((item) => ({ kind: "task", date: item.dueDate, start: "23:59", title: item.title || "Assignment", item })),
  ].sort((a, b) => a.date.localeCompare(b.date) || minute(a.start) - minute(b.start));
}

export function courseWeeklyLoad(course, estimates = {}, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: 4 }, (_, index) => {
    const from = new Date(start); from.setDate(from.getDate() + index * 7);
    const to = new Date(from); to.setDate(to.getDate() + 7);
    const first = dayKey(from), last = dayKey(to);
    const between = (date) => date >= first && date < last;
    const classes = course.sessions.filter((item) => between(item.date));
    const due = course.tasks.filter((item) => !item.completed && item.dueDate && between(item.dueDate));
    const estimatedMinutes = due.reduce((sum, task) => sum + (Number(estimates[task.id]) || 0), 0);
    return { first, last, classMinutes: classes.reduce((sum, item) => sum + minutesIn(item), 0),
      estimatedMinutes, unestimated: due.filter((task) => !Number(estimates[task.id])).length,
      due, examCount: course.exams.filter((item) => between(item.date)).length };
  });
}

export function courseAttention(course, now = new Date()) {
  const today = dayKey(now);
  const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  soon.setDate(soon.getDate() + 3);
  const due = course.openTasks.find((task) => task.dueDate && task.dueDate <= dayKey(soon));
  if (due) return { kind: "task", label: due.dueDate < today ? "Overdue assignment" : "Assignment due soon", detail: due.title || "Untitled assignment", task: due };
  if (course.stats.penaltyHit) return { kind: "attendance", label: "Attendance needs attention", detail: "Skip allowance exceeded" };
  const unmarked = course.sessions.filter((session) =>
    (session.date < today || (session.date === today && minute(session.end) <= minute(`${now.getHours()}:${now.getMinutes()}`))) &&
    !course.history.some((mark) => mark.date === session.date && mark.start === session.start)
  ).length;
  if (unmarked) return { kind: "attendance", label: `${unmarked} class${unmarked === 1 ? "" : "es"} unmarked`, detail: "Update attendance" };
  if (course.stats.totalAllowedSkips > 0 && course.stats.skipsRemaining <= 1)
    return { kind: "attendance", label: "Low skip buffer", detail: `${course.stats.skipsRemaining} skips remaining` };
  if (course.nextExam && course.nextExam.date <= dayKey(soon))
    return { kind: "exam", label: "Exam coming up", detail: course.nextExam.name || "Review this course" };
  return null;
}

export function reviewQueue(topics, now = new Date()) {
  const today = dayKey(now);
  return topics.filter((topic) => topic.details?.flagged && !topic.deleted)
    .map((topic) => ({ ...topic, dueDate: topic.details.reviewAt || today }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
}

export function nextReviewDate(now, step, remembered) {
  const intervals = [1, 3, 7, 14];
  const nextStep = remembered ? Math.min(step + 1, intervals.length - 1) : 0;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  date.setDate(date.getDate() + intervals[nextStep]);
  return { reviewAt: dayKey(date), reviewStep: nextStep };
}
