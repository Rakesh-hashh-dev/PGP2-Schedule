import { sharedTimeSuggestions } from "./socialPlanning.js";
import { getOrCreateShareCode, hasPendingFriendRequest, sendFriendPing } from "./friends.js";

export async function requestBuddyConnection({ userId, userName, candidate, isCurrent = () => true }) {
  if (!userId || !candidate?.user_id || candidate.user_id === userId) throw new Error("Choose another student to connect with.");
  const alreadySent = await hasPendingFriendRequest(userId, candidate.user_id);
  const code = await getOrCreateShareCode(userId, userName || "Student");
  if (!isCurrent()) return null;
  if (!code) throw new Error("Could not prepare your friend request. Try again.");
  const saved = await sendFriendPing(candidate.user_id, userId, userName, { type: "friend_request", fromCode: code }, { strict: true, legacyAlreadySaved: alreadySent });
  if (saved !== true) throw new Error("Could not confirm your friend request. Try again.");
  return isCurrent() ? { saved: true, alreadySent } : null;
}

export const studyIntentKey = userId => `pgp2.study-intents:${encodeURIComponent(userId || "")}`;
export function loadStudyIntents(userId, now) {
  if (!userId) return [];
  try {
    const rows = JSON.parse(localStorage.getItem(studyIntentKey(userId)));
    return (Array.isArray(rows) ? rows : []).filter(row => row.userId === userId && typeof row.candidateId === "string" && typeof row.name === "string" && Number.isFinite(row.expiresAt) && row.expiresAt > now.getTime()).slice(0, 20);
  } catch { return []; }
}
export function updateStudyIntent(userId, candidate, now, remove = false) {
  const rows = loadStudyIntents(userId, now).filter(row => row.candidateId !== candidate.user_id);
  if (!remove) rows.push({ userId, candidateId: candidate.user_id, name: candidate.name, expiresAt: now.getTime() + 7 * 86400000 });
  try { localStorage.setItem(studyIntentKey(userId), JSON.stringify(rows)); } catch { /* optional follow-up, no invitation is sent */ }
  return rows;
}
export function filterBuddyMatches(matches, { course = "all", purpose = "all" } = {}) {
  return (matches || []).filter(match => (course === "all" || match.sharedCourses?.includes(course)) && (purpose === "all" || match.sharedPurposes?.includes(purpose)));
}
export function buddySharedSlot({ candidate, userId, enrolled, allClasses, now, commitments = [] }) {
  return sharedTimeSuggestions({ userId, enrolled, allClasses, now, commitments, duration: 60, friends: [{ id: candidate.user_id, cloudId: candidate.user_id, name: candidate.name, courses: candidate.courses }], presence: { [candidate.user_id]: { away: candidate.courses?._away } } })[0] || null;
}
export function readyStudyIntents(intents, friends, userId, now) {
  return intents.filter(intent => intent.userId === userId && intent.expiresAt > now.getTime()).map(intent => ({ ...intent, friend: friends.find(friend => friend.cloudId === intent.candidateId) })).filter(intent => intent.friend);
}
export function loadDiscoveryOptOut(userId) {
  try { return !!userId && localStorage.getItem(`pgp2.opt-out-matchmaker:${encodeURIComponent(userId)}`) === "true"; } catch { return false; }
}
