export const ADMIN_ROLE_CAPABILITIES = Object.freeze({
  monitor: ['admin.read', 'support.read', 'notes.read', 'diagnostics.read'],
  schedule_editor: ['admin.read', 'schedule.publish'],
  communications_editor: ['admin.read', 'communications.publish', 'communications.send', 'diagnostics.read'],
  moderator: ['admin.read', 'moderation.write', 'support.read'],
  superadmin: ['admin.read', 'schedule.publish', 'communications.publish', 'communications.send', 'moderation.write', 'support.read', 'notes.read', 'notes.write', 'diagnostics.read', 'data.read', 'system.publish', 'roles.manage'],
});
export function hasAdminCapability(role, capability) {
  return Object.hasOwn(ADMIN_ROLE_CAPABILITIES, role) && ADMIN_ROLE_CAPABILITIES[role].includes(capability);
}
export function isKnownAdminRole(role) {
  return typeof role === 'string' && Object.hasOwn(ADMIN_ROLE_CAPABILITIES, role);
}
