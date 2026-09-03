// Pure date/time helpers shared by the app shell and views. No React, no DOM
// state — safe to unit-test. Dates are built in *local* time on purpose: the
// schedule feed carries IST wall-clock strings and the app runs on-campus, so
// local == IST for the intended audience.

/** "HH:MM" → minutes since midnight. */
export function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

/** A future gap in ms → a short "in 5m" / "in 2h 10m" / "in 3d" label. */
export function fmtWait(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return r ? `in ${h}h ${r}m` : `in ${h}h`;
  return `in ${Math.round(m / 1440)}d`;
}

/** Date → local "YYYY-MM-DD". */
export function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

/** A class row + "start"/"end" field → a local Date at that day and time. */
export function clsDate(c, which) { const [Y, Mo, D] = c.date.split("-").map(Number); const [h, m] = c[which].split(":").map(Number); return new Date(Y, Mo - 1, D, h, m); }

/** "YYYY-MM-DD" → "Monday, 5 Aug" (locale-formatted, no time zone shift). */
export function prettyDate(iso) { const [Y, M, D] = iso.split("-").map(Number); return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" }); }

/** An ISO timestamp → a coarse "just now" / "5m ago" / "3h ago" / "2d ago". */
export function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** A Date → national-holiday info on 15 Aug / 26 Jan (local calendar date), else null. */
export function getSpecialDay(d) {
  const month = d.getMonth(), date = d.getDate();
  if (month === 7 && date === 15) return { key: "independence", label: "Independence Day", short: "15 Aug" };
  if (month === 0 && date === 26) return { key: "republic", label: "Republic Day", short: "26 Jan" };
  return null;
}

// Time-bucketed greeting templates ("{name}" is substituted with the first name).
// Add/remove lines freely — one is picked at random per page load within the
// matching bucket. Keep each bucket non-empty.
export const GREETINGS = {
  lateNight: [ // 12am–4am
    "Up late, {name}?",
    "Burning the midnight oil, {name}?",
    "Still awake before tomorrow's classes, {name}?",
    "Mess is closed, {name} - hope you ate.",
  ],
  earlyMorning: [ // 4am–6am
    "Early start, {name}?",
    "Up before the mess even opens, {name}?",
    "Beating the wake-up bell, {name}?",
  ],
  morning: [ // 6am–12pm
    "Good morning, {name}",
    "Breakfast before class, {name}?",
    "Ready for today's classes, {name}?",
    "Morning, {name} - first class awaits.",
  ],
  afternoon: [ // 12pm–5pm
    "Good afternoon, {name}",
    "Lunch break, {name}?",
    "Halfway through the day, {name}.",
    "Back from mess, {name}?",
  ],
  evening: [ // 5pm–9pm
    "Good evening, {name}",
    "Dinner o'clock soon, {name}?",
    "Wrapping up classes, {name}?",
    "Evening, {name} - assignments calling?",
  ],
  night: [ // 9pm–12am
    "Winding down, {name}?",
    "Prepping for tomorrow's classes, {name}?",
    "Late-night library run, {name}?",
    "Mess is shut, {name} - snack time?",
  ],
};

/**
 * Which greeting band an hour falls in. Exported so callers can tell when the
 * greeting has actually gone stale (the band changed) rather than re-rolling a
 * new random line on every clock tick.
 */
export function getGreetingBucket(h) {
  if (h < 4) return "lateNight";
  if (h < 6) return "earlyMorning";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

/** A Date + first name → a random time-aware greeting from GREETINGS, e.g. "Up late, Rakesh?". */
export function getTimeGreeting(d, name) {
  const options = GREETINGS[getGreetingBucket(d.getHours())];
  const pick = options[Math.floor(Math.random() * options.length)];
  return pick.replace("{name}", name);
}
