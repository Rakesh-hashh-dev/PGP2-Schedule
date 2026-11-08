import { expect, it } from 'vitest';
import { stripPrivateAdminConfig } from './privateAdminConfig.js';
import { configForHistory, stageConfigSnapshot } from './configHistory.js';

it('removes private fields at every depth without changing settings or its input', () => {
  const input = { adminNotes: { s: 'private' }, classOverrides: { d: { room: 'A' } },
    configHistory: [{ flags: { adminNotes: { s: 'old' }, enabled: false } }],
    scheduledConfigDeploys: [{ flags: { adminRoles: { a: 'superadmin' }, theme: null } }], empty: [], value: 4 };
  const before = JSON.stringify(input);
  expect(stripPrivateAdminConfig(input)).toEqual({ classOverrides: { d: { room: 'A' } },
    configHistory: [{ flags: { enabled: false } }], scheduledConfigDeploys: [{ flags: { theme: null } }], empty: [], value: 4 });
  expect(JSON.stringify(input)).toBe(before);
});
it('excludes notes from restore and history comparisons', () => {
  expect(configForHistory({ adminNotes: { s: 'private' }, enabled: true })).toEqual({ enabled: true });
  expect(stageConfigSnapshot({ adminNotes: { s: 'old' }, enabled: false }, {})).toEqual({ enabled: false, configHistory: [], scheduledConfigDeploys: [] });
});
