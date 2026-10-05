// Meals are timetable context, never teaching sessions or scheduled activities.
export function isScheduleBreak(item) {
  return item?.type === "break" || /^lunch(?:\s+break)?$/i.test(String(item?.name || item?.code || "").replace(/\s+/g, " ").trim());
}

export function normalizeScheduleBreak(item) {
  return isScheduleBreak(item) ? { ...item, type: "break", code: "", session: "", faculty: "", room: "" } : item;
}

export function timelineActivitySummary(list, nowMinutes) {
  const activities = list.filter(item => !isScheduleBreak(item));
  const classes = activities.filter(item => item.type === "class");
  const minutes = value => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
  return {
    activities,
    classCount: classes.length,
    completedClasses: classes.filter(item => minutes(item.end) <= nowMinutes).length,
    nextIndex: list.findIndex(item => !isScheduleBreak(item) && minutes(item.start) > nowMinutes),
    firstStart: activities.length ? activities.reduce((first, item) => minutes(item.start) < minutes(first) ? item.start : first, activities[0].start) : null,
    lastEnd: activities.length ? activities.reduce((last, item) => minutes(item.end) > minutes(last) ? item.end : last, activities[0].end) : null,
    allDone: activities.length > 0 && activities.every(item => nowMinutes >= minutes(item.end)),
  };
}
