import { hasAdminCapability } from './adminCapabilities.js';
export const ADMIN_COMMANDS = [
  { id:'classes-today', label:'Review today’s classes', aliases:'schedule today timetable overrides', capability:'admin.read', tab:'schedule', section:'class', day:0 },
  { id:'classes-tomorrow', label:'Review tomorrow’s classes', aliases:'tomorrow classes schedule overrides', capability:'admin.read', tab:'schedule', section:'class', day:1 },
  { id:'menu-tomorrow', label:'Edit tomorrow’s menu', aliases:'mess lunch dinner breakfast tomorrow', capability:'system.publish', tab:'schedule', section:'menu', day:1 },
  { id:'notification-diagnostics', label:'Investigate notification delivery', aliases:'failed push notifications diagnostics', capability:'diagnostics.read', tab:'insights' },
  { id:'reports', label:'Review reported content', aliases:'moderation reports board poll message', capability:'moderation.write', tab:'moderation' },
  { id:'student-support', label:'Open student support', aliases:'users directory student support feedback', capability:'support.read', tab:'users' },
  { id:'publication-history', label:'Search publication history', aliases:'history changes revisions records', capability:'admin.read', tab:'database' },
  { id:'system-controls', label:'Open system controls', aliases:'settings flags dashboard navigation', capability:'system.publish', tab:'system' },
];
export function availableAdminCommands(role, query = '') {
  const q = query.toLowerCase().trim();
  return ADMIN_COMMANDS.filter(command => hasAdminCapability(role,command.capability) && (!q || q.split(/\s+/).every(word=>`${command.label} ${command.aliases}`.toLowerCase().includes(word))));
}
export function adminCommandDate(day, now = new Date()) {
  return new Date(now.getTime() + day * 86400000).toLocaleDateString('en-CA',{ timeZone:'Asia/Kolkata' });
}
