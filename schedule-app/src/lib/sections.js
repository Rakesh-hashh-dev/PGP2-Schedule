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

/**
 * Merge the admin roster's allocation into a student's saved enrollment.
 *
 * Two things the sheet is allowed to do, and one it isn't:
 *
 * - ADD a course the student doesn't hold (a late roster addition), unless they
 *   deliberately dropped it via edit-setup (`droppedCodes`).
 * - CORRECT the section of a course they do hold. A course tab's Section column
 *   starts out blank, and the roster parser skips blank sections entirely — so
 *   the course is missing from the roster until the admin allocates, and any
 *   student who added it by hand in the meantime had to guess A or B. Once the
 *   allocation lands it is authoritative and replaces the guess.
 * - It must NOT touch a section in `manualSections` — one the student set
 *   against an allocation the sheet was already publishing. That is a real
 *   choice (a swap by arrangement), not a guess.
 *
 * A sheet section the timetable teaches no rows for is ignored, so a stray or
 * mistyped cell can never blank out a working allocation.
 *
 * Returns { courses, added, changed } — `courses` is the input untouched when
 * nothing applies, so callers can skip the write.
 */
export function applyRosterAllocation(enrolled, allocation, opts = {}) {
  const { droppedCodes = [], manualSections = [], taught = {} } = opts;
  const next = { ...(enrolled || {}) };
  let added = false;
  let changed = false;

  for (const [code, rawSection] of Object.entries(allocation || {})) {
    // Normalise whatever value the sheet uses → A | B | Single
    const s = String(rawSection).trim();
    const section = s === "A" || s === "B" ? s : "Single";

    if (!(code in next)) {
      if (droppedCodes.includes(code)) continue;
      next[code] = section;
      added = true;
      changed = true;
      continue;
    }
    if (next[code] === section) continue;
    if (manualSections.includes(code)) continue;
    if (taught[code]?.length && !taught[code].includes(section)) continue;
    next[code] = section;
    changed = true;
  }

  return { courses: changed ? next : enrolled, added, changed };
}

/**
 * Codes whose section the student set against an allocation the sheet already
 * publishes — the picks the roster sync must not overwrite.
 *
 * Deviating from a published allocation is a decision; choosing a section for a
 * course the sheet has no allocation for is only a guess, and stays sheet-owned
 * so it gets corrected the moment the admin fills the Section column.
 */
export function manualSectionCodes(courses, sheetAllocation) {
  return Object.keys(courses || {}).filter(
    (c) => sheetAllocation?.[c] && sheetAllocation[c] !== courses[c]
  );
}

/**
 * Enrolled courses the timetable has no sessions for at all.
 *
 * A course can sit in the term's legend (so it is offered in the onboarding
 * picker) long before its sessions are published — and if it also has no roster
 * tab yet, nothing in the feed mentions it. The student is enrolled, the course
 * shows in their subject list, and their calendar stays empty with no
 * explanation. This is deliberately NOT a provisional-section case: there is no
 * section to fall back to and nothing to reveal, so it gets its own notice.
 */
export function unscheduledCodes(enrolled, sectionsByCode) {
  return Object.keys(enrolled || {}).filter((code) => !sectionsByCode?.[code]?.length);
}
