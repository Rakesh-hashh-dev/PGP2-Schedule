import { expect, it } from 'vitest';
import { hasAdminCapability, isKnownAdminRole } from './adminCapabilities.js';
it('fails closed for unknown, inherited, null and missing roles', () => {
  for (const role of [null, undefined, '', 'owner', '__proto__', 'toString']) {
    expect(isKnownAdminRole(role)).toBe(false);
    expect(hasAdminCapability(role, 'system.publish')).toBe(false);
  }
});
it('gives scoped editors only their explicit write capabilities', () => {
  expect(hasAdminCapability('schedule_editor', 'schedule.publish')).toBe(true);
  expect(hasAdminCapability('schedule_editor', 'communications.send')).toBe(false);
  expect(hasAdminCapability('communications_editor', 'communications.send')).toBe(true);
  for (const role of ['monitor','schedule_editor','communications_editor','moderator']) {
    expect(hasAdminCapability(role, 'system.publish')).toBe(false);
    expect(hasAdminCapability(role, 'roles.manage')).toBe(false);
  }
  expect(hasAdminCapability('superadmin', 'roles.manage')).toBe(true);
  expect(hasAdminCapability('superadmin', 'unknown.capability')).toBe(false);
});
