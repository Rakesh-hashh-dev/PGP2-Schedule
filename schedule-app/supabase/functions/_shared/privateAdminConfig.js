// Shared by the browser and scheduler. PostgreSQL independently enforces this.
const PRIVATE_KEYS = new Set(['adminNotes', 'adminRoles']);
export function stripPrivateAdminConfig(value) {
  if (Array.isArray(value)) return value.map(stripPrivateAdminConfig);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !PRIVATE_KEYS.has(key))
      .map(([key, child]) => [key, stripPrivateAdminConfig(child)]));
  }
  return value;
}
