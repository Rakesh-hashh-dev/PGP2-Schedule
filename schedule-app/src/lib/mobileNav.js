export function activeMobileV2Destination(view, moreOpen, attendanceEnabled) {
  if (moreOpen) return "more";
  if (view === "today" || view === "tomorrow") return "today";
  if (view === "week" || view === "fullSchedule") return "schedule";
  if (attendanceEnabled && view === "attendance") return "attendance";
  if (view === "assignments" || view === "exams") return "tasks";
  if (!attendanceEnabled && view === "notifications") return "updates";
  return "more";
}
