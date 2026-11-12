export const STUDY_PURPOSES = Object.freeze(["Revision", "Interview practice", "Case preparation", "Project work"]);
export function normalizeBuddyPreferences(value) {
  const unique = (items, max, length) => [...new Set((Array.isArray(items) ? items : []).filter(x => typeof x === "string").map(x => x.trim().slice(0, length)).filter(Boolean))].slice(0, max);
  return { subjects: unique(value?.subjects, 12, 30), interests: unique(value?.interests, 8, 40), purposes: unique(value?.purposes, 4, 40).filter(x => STUDY_PURPOSES.includes(x)), discoverable: value?.discoverable === true };
}
export function matchBuddy(myCourses, theirCourses, mine, theirs) {
  const codes = courses => Object.keys(courses || {}).filter(code => !code.startsWith("_"));
  const myCodes = codes(myCourses); const theirCodes = codes(theirCourses);
  const shared = myCodes.filter(code => theirCodes.includes(code));
  const union = new Set([...myCodes, ...theirCodes]).size;
  const courseScore = union ? Math.round(shared.length / union * 100) : 0;
  const me = normalizeBuddyPreferences(mine); const them = normalizeBuddyPreferences(theirs);
  const overlap = (a, b) => a.filter(item => b.some(other => item.toLocaleLowerCase() === other.toLocaleLowerCase()));
  const interests = them.discoverable && me.discoverable ? overlap(me.interests, them.interests) : [];
  const purposes = them.discoverable && me.discoverable ? overlap(me.purposes, them.purposes) : [];
  const subjects = them.discoverable && me.discoverable ? overlap(me.subjects, them.subjects) : [];
  const reasons = [shared.length ? `${shared.length} shared course${shared.length === 1 ? "" : "s"}` : null, subjects.length ? `Study focus: ${subjects.join(", ")}` : null, purposes.length ? purposes.join(" · ") : null, interests.length ? `Interests: ${interests.join(", ")}` : null].filter(Boolean);
  return { score: courseScore, rank: courseScore + subjects.length * 8 + purposes.length * 12 + interests.length * 5,
    eligible: courseScore >= 40 || purposes.length > 0 || subjects.length > 0 || interests.length > 0, reasons, sharedCourses: shared, sharedPurposes: purposes };
}
export function loadBuddyPreferences(userId) {
  if (!userId) return normalizeBuddyPreferences(null);
  try { return normalizeBuddyPreferences(JSON.parse(localStorage.getItem(`pgp2.buddy-preferences:${userId}`))); } catch { return normalizeBuddyPreferences(null); }
}
export async function fetchBuddyPreferences(userId) {
  if (!userId) return normalizeBuddyPreferences(null);
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase.from("profiles").select("courses").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Could not load study preferences.");
  return normalizeBuddyPreferences(data?.courses?._buddy_preferences);
}
export async function hydrateBuddyPreferenceSession(session, { load = fetchBuddyPreferences, isCurrent, onHydrated }) {
  const revision = session.revision;
  try {
    const value = await load(session.userId);
    if (session.revision !== revision || !isCurrent()) return false;
    onHydrated(normalizeBuddyPreferences(value));
    return true;
  } catch (error) {
    if (session.revision !== revision || !isCurrent()) return false;
    throw error;
  }
}
export async function saveDiscoveryOptOut(hidden, { isCurrent = () => true } = {}) {
  if (typeof hidden !== "boolean") throw new Error("Choose a valid discovery setting.");
  const { supabase } = await import("./supabase.js");
  if (!isCurrent()) return null;
  const { data, error } = await supabase.rpc("social_set_discovery_opt_out", { p_hidden: hidden });
  if (error || data?.saved !== true || data.hidden !== hidden) throw new Error("Could not confirm discovery visibility. Please try again.");
  return data.hidden;
}
export async function saveBuddyPreferences(userId, value) {
  if (!userId) throw new Error("Sign in to save preferences.");
  const next = normalizeBuddyPreferences(value);
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase.rpc("social_set_buddy_preferences", { p_preferences: next });
  if (error) throw new Error("Could not save study preferences. Please try again.");
  const saved = normalizeBuddyPreferences(data);
  try { localStorage.setItem(`pgp2.buddy-preferences:${userId}`, JSON.stringify(saved)); } catch { /* cloud save succeeded */ }
  return saved;
}
