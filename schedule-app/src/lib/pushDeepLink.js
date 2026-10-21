// Only validated session identifiers reach the timetable's focus selector.
export function pushSessionFromParams(params) {
  const date = params.get("date") || "";
  const code = params.get("code") || "";
  const start = params.get("start") || "";
  if (params.get("view") !== "fullSchedule" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[\w -]{1,80}$/.test(code) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)) return null;
  return { date, code, start };
}
