// How often each mood is actually seen.
//
// The context moods (focused, restless, relaxed, rooting) were designed from
// reasoning about the timetable, not from evidence. This tally is what turns
// "restless should fire before class" into "restless fired 4 times this week" —
// or into "restless has never once fired, delete it".
//
// Deliberately local-only. It is diagnostic, not analytics: no user id, no
// network, no cloud row, nothing that needs a consent conversation. The cost is
// that it answers the question for one browser at a time — enough to check your
// own build, or to ask a couple of students to read a number off `?moodsheet`,
// but not a cohort-wide answer. That would need a column and a migration.

const KEY = "pgp2.pet-moods";
/** A mood held for less than this is a flicker, not a sighting. */
const MIN_HOLD_MS = 4000;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}

/**
 * Record that `mood` was on screen. Call it when the mood CHANGES, not every
 * render — `pending` holds the incoming mood until it has survived
 * `MIN_HOLD_MS`, so a mood the app passes through on the way to another one
 * (a moment latch expiring mid-tick, say) never inflates the count.
 */
let pending = null;
let pendingAt = 0;

export function recordMood(mood) {
  const now = Date.now();
  if (pending && pending !== mood && now - pendingAt >= MIN_HOLD_MS) commit(pending, now);
  if (pending !== mood) { pending = mood; pendingAt = now; }
}

/** Flush whatever is on screen right now — for a page leaving, or a read. */
export function flushMood() {
  if (pending && Date.now() - pendingAt >= MIN_HOLD_MS) { commit(pending, Date.now()); pendingAt = Date.now(); }
}

function commit(mood, now) {
  try {
    const data = read();
    const counts = data.counts || {};
    counts[mood] = (counts[mood] || 0) + 1;
    localStorage.setItem(KEY, JSON.stringify({
      counts,
      since: data.since || now,
      last: now,
    }));
  } catch { /* private mode / quota — a diagnostic is never worth a throw */ }
}

/** `{ counts, total, since, last }`. Empty-safe. */
export function readMoodStats() {
  flushMood();
  const data = read();
  const counts = data.counts || {};
  return {
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    since: data.since || null,
    last: data.last || null,
  };
}

export function clearMoodStats() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  pending = null;
}
