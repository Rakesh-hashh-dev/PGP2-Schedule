import { publicationDomain } from './adminPublication.js';

export const ADMIN_DEFAULT_FLAGS = {
  enableFriends: true,
  enableExams: true,
  enableAttendance: true,
  maintenanceMode: false,
  bannedUsers: [],
  classOverrides: {},
  abTests: {},
  dispatchEnabled: true,
  greetingPets: {
    enabled: true,
    petKey: 'cat',
    motion: true,
    companion: true,
    xpRate: 1,
    signatures: true,
    wardrobe: true,
    hatsOff: [],
  },
};

/**
 * Deterministic JSON serialization sorting object keys recursively so comparisons
 * are insensitive to key insertion order (e.g. database jsonb key order vs JS object literals).
 */
export function canonicalJson(val) {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(val).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(val[k])).join(',') + '}';
}

export function composePublicationFlags(flags, flashes, prompt, original = {}) {
  const result = { ...flags };
  delete result.feedbackFlash;
  for (const [key, value] of Object.entries(ADMIN_DEFAULT_FLAGS)) {
    if (!Object.hasOwn(original || {}, key) && canonicalJson(result[key]) === canonicalJson(value)) {
      delete result[key];
    }
  }
  if (flashes.length || Object.hasOwn(flags, 'feedbackFlashes') || Object.hasOwn(flags, 'feedbackFlash')) {
    result.feedbackFlashes = flashes;
  }
  if (prompt.title || prompt.desc || prompt.highlights.length || Object.hasOwn(flags, 'updatePrompt')) {
    result.updatePrompt = prompt;
  }
  return result;
}

export function pendingPublicationChanges(original, proposed, originalAnnouncement, announcement) {
  if (!original) return 0;
  return [...new Set([...Object.keys(original), ...Object.keys(proposed)])].filter(
    key => publicationDomain(key) && canonicalJson(original[key]) !== canonicalJson(proposed[key])
  ).length + (canonicalJson(originalAnnouncement) !== canonicalJson(announcement) ? 1 : 0);
}
