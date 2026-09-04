// localStorage keys + their tiny read/write guards, extracted from App.jsx so
// the shell isn't carrying its own persistence layer inline. Every reader
// swallows corrupt/blocked-storage errors and returns a safe empty default —
// the app must boot even when storage is unavailable (private mode, quota).

// ── App-version silent auto-update clock ────────────────────────
// Once a new version has been *available* for 2–3 days we stop prompting and
// just apply it. A per-client random spread (2 days + up to 1 day) avoids every
// browser reloading at the same instant; the "first seen" timestamp is persisted
// so the clock survives reloads and "Maybe Later" dismissals across sessions.
export const SW_SEEN_KEY = "pgp2.sw-update-seen";
export function swSeenRecord() {
  const DAY = 86_400_000;
  try {
    const raw = localStorage.getItem(SW_SEEN_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.firstSeen && p.thresholdMs) return p;
    }
  } catch { /* corrupt/blocked storage — fall through to a fresh record */ }
  const rec = { firstSeen: Date.now(), thresholdMs: DAY * 2 + Math.random() * DAY };
  try { localStorage.setItem(SW_SEEN_KEY, JSON.stringify(rec)); } catch { /* ignore */ }
  return rec;
}
/** True once the pending update has been available past its per-client threshold. */
export function swUpdateIsStale() {
  const rec = swSeenRecord();
  return Date.now() - rec.firstSeen >= rec.thresholdMs;
}
export function clearSwSeen() {
  try { localStorage.removeItem(SW_SEEN_KEY); } catch { /* ignore */ }
}

// ── User / view / invite keys ───────────────────────────────────
export const LAST_USER_KEY = "pgp2.last-user-id";
export const VIEW_KEY = "pgp2.last-view";
// Deliberately not in USER_SCOPED_KEYS: an invite clicked before first sign-in
// must survive the user-switch wipe.
export const PENDING_INVITE_KEY = "pgp2.pending-invite";
export const USER_SCOPED_KEYS = [
  "pgp2.friends", "pgp2.groups", "pgp2.my_share_code",
  "pgp2.setup", "pgp2-notif-seen", "pgp2.read-ping-ids", "pgp2.read-change-keys",
  "pgp2.seen-recv-groups", "pgp2.recv-groups-count", "pgp2.sidebar", VIEW_KEY,
  // Without this, signing in as someone else on a shared laptop shows them the
  // previous student's companion until the cloud read lands.
  "pgp2.pet",
];

// ── Onboarding / course setup ───────────────────────────────────
export const SETUP_KEY = "pgp2.setup";
export function readSetup() {
  try {
    const s = JSON.parse(localStorage.getItem(SETUP_KEY));
    if (s && s.courses && !Array.isArray(s.courses) && typeof s.courses === "object") return s;
    return null;
  } catch { return null; }
}
export function saveSetup(s) { try { localStorage.setItem(SETUP_KEY, JSON.stringify(s)); } catch (e) { } }

// ── Notification / read-state markers ───────────────────────────
export const NOTIF_KEY = "pgp2-notif-seen";
export function loadLastSeen() { try { return parseInt(localStorage.getItem(NOTIF_KEY) || "0", 10); } catch { return 0; } }
export const READ_PINGS_KEY = "pgp2.read-ping-ids";
export function loadReadPingIds() { try { return new Set(JSON.parse(localStorage.getItem(READ_PINGS_KEY) || "[]")); } catch { return new Set(); } }
export const READ_CHANGES_KEY = "pgp2.read-change-keys";
export function loadReadChangeKeys() { try { return new Set(JSON.parse(localStorage.getItem(READ_CHANGES_KEY) || "[]")); } catch { return new Set(); } }
export const CLEARED_GROUPS_KEY = "pgp2.cleared-groups";
export function loadClearedGroups() { try { return new Set(JSON.parse(localStorage.getItem(CLEARED_GROUPS_KEY) || "[]")); } catch { return new Set(); } }
