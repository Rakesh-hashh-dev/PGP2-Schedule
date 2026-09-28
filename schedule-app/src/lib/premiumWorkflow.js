export function sessionItems(session, items = [], termNumber) {
  if (!session?.code) return { prep: [], notes: [], links: [] };
  const term = String(termNumber || "current");
  const key = `${session.date}_${session.start}_${session.code}_${session.section}`;
  const course = items.filter((item) => !item.deleted && item.term === term && item.code === session.code);
  return {
    prep: course.filter((item) => item.kind === "prep" && item.sessionKey === key),
    notes: course.filter((item) => item.kind === "note" && item.sessionKey === key),
    links: course.filter((item) => item.kind === "link"),
  };
}
