// Build-time edition flag. The full app leaves VITE_EDITION unset ("full");
// the lite build (lite/vite.config.js) injects "lite" via `define`, which
// hard-excludes the heavier features regardless of server-driven sysConfig flags.
export const EDITION = import.meta.env.VITE_EDITION || "full";
export const IS_LITE = EDITION === "lite";

// Views reachable in the lite edition. Used to gate nav and to clamp the
// initial `view` state and `?view=` deep links so excluded pages fall back
// to Today instead of rendering a nav-less dead end.
export const LITE_VIEWS = [
  "today",
  "tomorrow",
  "week",
  "exams",
  "attendance",
  "leave",
  "fullSchedule",
  "friends", // "Compare" in lite — the minimal friends/groups picker
];
