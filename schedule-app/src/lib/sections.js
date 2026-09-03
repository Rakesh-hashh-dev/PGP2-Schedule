// Section bookkeeping shared by the schedule filters and the onboarding picker.

/**
 * Which sections each course actually teaches.
 *
 * "Single"/"All" rows are combined sessions every section attends (mid-terms,
 * guest lectures), so for a course that also runs A and B they are not an
 * enrollment choice — only the real sections are. A course with nothing but
 * Single rows genuinely is one combined section, and keeps it.
 */
export function taughtSectionsByCode(classes) {
  const seen = {};
  for (const c of classes || []) {
    if (c.type === "class" && c.code) (seen[c.code] ||= new Set()).add(c.section);
  }
  const out = {};
  for (const code of Object.keys(seen)) {
    const secs = [...seen[code]];
    const real = secs.filter((s) => s !== "Single" && s !== "All");
    out[code] = (real.length ? real : secs).sort();
  }
  return out;
}

/**
 * Courses whose allocated section isn't one the course teaches.
 *
 * The roster script defaults a student to "Single" whenever it can't find a
 * section column, which is exactly what a not-yet-allocated course looks like.
 * Against an A/B timetable that section matches no row, so the schedule filter
 * would hide the whole course. Flagging it lets the filter fall back to showing
 * every section instead of nothing.
 *
 * A course with no classes yet is never flagged — there is nothing to reveal,
 * and an empty timetable is not evidence of a bad allocation.
 */
export function provisionalSectionCodes(enrolled, sectionsByCode) {
  const out = new Set();
  if (!enrolled) return out;
  for (const [code, section] of Object.entries(enrolled)) {
    const taught = sectionsByCode?.[code];
    if (!taught?.length) continue;
    if (!taught.includes(section)) out.add(code);
  }
  return out;
}
