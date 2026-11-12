export const ADMIN_SEARCH_DATASETS = {
  audit: { label: 'Audit log', capability: 'diagnostics.read', hint: 'Administrative actions and the people who performed them.', placeholder: 'Search actions or administrator IDs…' },
  feedback: { label: 'Feedback', capability: 'support.read', hint: 'Student feedback, ownership and triage status.', placeholder: 'Search feedback messages or student IDs…' },
  versions: { label: 'Publication versions', capability: 'admin.read', hint: 'Published configuration revisions, grouped by area.', placeholder: 'Search areas, revision numbers or publisher IDs…' },
  students: { label: 'Student directory', capability: 'support.read', hint: 'Dates filter last activity. Students without recorded activity are included.', placeholder: 'Search names, emails or student IDs…' },
  notifications: { label: 'Notification metadata', capability: 'diagnostics.read', hint: 'Notification records and delivery metadata.', placeholder: 'Search notification titles, types or student IDs…' },
};
const DAY = 86400000;
export function adminSearchRange(days = 30, now = new Date()) {
  const to = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const from = new Date(new Date(`${to}T00:00:00Z`).getTime() - (days - 1) * DAY).toISOString().slice(0,10);
  return { from, to };
}
export function buildAdminSearchFilter({ dataset, query = '', from, to, status = '', actor = '' }, maxDays = 366) {
  if (!ADMIN_SEARCH_DATASETS[dataset]) throw new Error('Choose an available record type.');
  for (const value of [from, to]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) !== value) throw new Error('Choose valid start and end dates.');
  }
  const start = new Date(`${from}T00:00:00+05:30`), end = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + DAY);
  if (end <= start) throw new Error('End date must be on or after the start date.');
  if (end - start > maxDays * DAY) throw new Error(`Choose a date range of ${maxDays} days or fewer.`);
  return { dataset, query: query.trim(), from: start.toISOString(), to: end.toISOString(), status: dataset === 'feedback' ? status.trim() : '', actor: ['audit','versions'].includes(dataset) ? actor.trim() : '' };
}
export function adminRecordTime(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime()) || date.getTime() === 0) return 'No recorded activity';
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' IST';
}
export function buildNotificationDiagnosticFilter({ from, to, type = '' }) {
  const range = buildAdminSearchFilter({ dataset: 'notifications', from, to }, 90);
  return { from, to, type: type.trim(), start: range.from, end: range.to };
}
