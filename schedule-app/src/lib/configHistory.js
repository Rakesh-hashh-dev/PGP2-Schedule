import { stripPrivateAdminConfig } from './privateAdminConfig.js';

// Snapshots live inside public system_config.flags. Keep bookkeeping and the
// retired admin-role roster out of both comparisons and restored payloads.
export const CONFIG_HISTORY_EXCLUDED_KEYS = new Set([
  "configHistory", "scheduledConfigDeploys", "adminRoles", "adminNotes",
]);

export function configForHistory(flags) {
  return stripPrivateAdminConfig(Object.fromEntries(Object.entries(flags || {}).filter(([key]) => !CONFIG_HISTORY_EXCLUDED_KEYS.has(key))));
}

const LABELS = {
  abTests: "A/B tests", bannedUsers: "Banned users", classOverrides: "Class overrides",
  dispatchEnabled: "Push dispatch", enableAttendance: "Attendance view",
  enableRegistroSync: "Registro attendance sync", enableRegistroFeedbackAlerts: "Registro feedback alerts",
  registroAttendanceUrl: "Registro attendance URL", registroFeedbackUrl: "Registro feedback URL",
  enableExams: "Exams view", enableFriends: "Social / Friends",
  enableMeetups: "Meetup plans", enableStatus: "Friend statuses",
  feedbackFlashes: "Feedback flashes", greetingPets: "Greeting companions",
  heroBackdrop: "Hero backdrop", maintenanceMode: "Maintenance mode",
  quickLinks: "Quick links", scheduledAnnouncements: "Scheduled announcements",
  updatePrompt: "Update prompt", whatsNew: "What's New",
};

export function describeConfigValue(value) {
  if (value === undefined || value === null) return "Not set";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value === "" ? "Empty" : value.length > 70 ? `${value.slice(0, 67)}…` : value;
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return `${Object.keys(value).length} entr${Object.keys(value).length === 1 ? "y" : "ies"}`;
  return String(value);
}

export function getConfigHistoryDiff(currentFlags, snapshotFlags) {
  const current = configForHistory(currentFlags);
  const snapshot = configForHistory(snapshotFlags);
  return [...new Set([...Object.keys(current), ...Object.keys(snapshot)])]
    .filter(key => JSON.stringify(current[key]) !== JSON.stringify(snapshot[key]))
    .sort((a, b) => (LABELS[a] || a).localeCompare(LABELS[b] || b))
    .map(key => {
      const before = current[key], after = snapshot[key];
      const beforeObject = before && typeof before === "object" && !Array.isArray(before);
      const afterObject = after && typeof after === "object" && !Array.isArray(after);
      const changedEntries = beforeObject && afterObject
        ? [...new Set([...Object.keys(before), ...Object.keys(after)])]
          .filter(subkey => JSON.stringify(before[subkey]) !== JSON.stringify(after[subkey]))
        : [];
      return {
        key,
        label: LABELS[key] || key,
        before: describeConfigValue(before),
        after: describeConfigValue(after),
        beforeRaw: JSON.stringify(before, null, 2) ?? "Not set",
        afterRaw: JSON.stringify(after, null, 2) ?? "Not set",
        details: changedEntries.length ? `${changedEntries.slice(0, 6).join(", ")}${changedEntries.length > 6 ? ` and ${changedEntries.length - 6} more` : ""} changed` : "",
      };
    });
}

export function stageConfigSnapshot(snapshotFlags, currentFlags) {
  if (!snapshotFlags || typeof snapshotFlags !== "object" || Array.isArray(snapshotFlags)) {
    throw new Error("This history entry has no usable configuration.");
  }
  const current = currentFlags || {};
  return {
    ...configForHistory(snapshotFlags),
    configHistory: Array.isArray(current.configHistory) ? current.configHistory : [],
    scheduledConfigDeploys: Array.isArray(current.scheduledConfigDeploys) ? current.scheduledConfigDeploys : [],
  };
}
