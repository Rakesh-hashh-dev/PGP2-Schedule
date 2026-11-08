export const DRAFT_AREAS = {
  schedule: { label: 'Schedule', description: 'Class timings, rooms and cancellations' },
  communications: { label: 'Communications', description: 'Announcements and student updates' },
  system: { label: 'System', description: 'Feature switches and app settings' },
};
export function draftPresentation({ canEdit, ready, blocked, error, dirty, savedMatches, savedAt }) {
  if (!canEdit) return { key: 'readonly', label: 'Read only', detail: 'Your role can view this area. Changes are not autosaved.' };
  if (error) return { key: 'error', label: 'Needs attention', detail: error };
  if (!ready) return { key: 'loading', label: 'Checking draft', detail: 'Looking for a private draft from your earlier session.' };
  if (blocked) return { key: 'recovery', label: 'Saved draft available', detail: 'Choose whether to resume the saved copy before new edits can autosave.' };
  if (dirty && !savedMatches) return { key: 'pending', label: 'Not saved yet', detail: 'Autosave is pending. Keep this page open until the saved status appears.' };
  if (dirty && savedMatches) return { key: 'saved', label: 'Saved privately', detail: savedAt ? `Last saved ${new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Your current edits are saved in your private draft.' };
  return { key: 'clean', label: 'No pending edits', detail: 'This area matches its current editor baseline.' };
}
export const SHORTCUT_LIMIT = 8;
export function toggleAdminPin(preferences, id, allowedIds) {
  const pins = preferences.pins.filter(pin => allowedIds.has(pin));
  if (!allowedIds.has(id)) return preferences;
  if (!pins.includes(id) && pins.length >= SHORTCUT_LIMIT) return preferences;
  return { ...preferences, pins: pins.includes(id) ? pins.filter(pin => pin !== id) : [...pins, id] };
}
