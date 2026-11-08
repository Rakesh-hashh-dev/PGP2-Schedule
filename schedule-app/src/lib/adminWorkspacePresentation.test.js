import { describe, expect, it } from 'vitest';
import { draftPresentation, toggleAdminPin } from './adminWorkspacePresentation.js';
describe('admin recovery state clarity', () => {
  const ready = { canEdit: true, ready: true, dirty: true, savedAt: '2026-11-08T10:00:00Z' };
  it('never calls newer unsaved edits saved because an older save succeeded', () => {
    expect(draftPresentation({ ...ready, savedMatches: false }).key).toBe('pending');
    expect(draftPresentation({ ...ready, savedMatches: true }).key).toBe('saved');
  });
  it('prioritizes errors and recovery over old save timestamps', () => {
    expect(draftPresentation({ ...ready, savedMatches: true, error: 'Revision changed' })).toMatchObject({ key: 'error', detail: 'Revision changed' });
    expect(draftPresentation({ ...ready, savedMatches: true, blocked: true }).key).toBe('recovery');
  });
  it('distinguishes no changes, checking, and view-only roles', () => {
    expect(draftPresentation({ ...ready, dirty: false }).key).toBe('clean');
    expect(draftPresentation({ ...ready, ready: false }).key).toBe('loading');
    expect(draftPresentation({ ...ready, canEdit: false, ready: false }).key).toBe('readonly');
  });
});
describe('shortcut selection safety', () => {
  it('preserves saved workspace filters when pinning and unpinning', () => {
    const current = { version: 1, pins: ['today'], filters: { dataset: 'audit', from: '2026-11-01' } };
    const allowed = new Set(['today', 'history']);
    const next = toggleAdminPin(current, 'history', allowed);
    expect(next.pins).toEqual(['today', 'history']);
    expect(next.filters).toEqual(current.filters);
    expect(toggleAdminPin(next, 'today', allowed).pins).toEqual(['history']);
    expect(current.pins).toEqual(['today']);
  });
  it('does not silently accept a ninth pin or an unauthorized command', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `tool-${i}`), allowed = new Set(ids);
    const current = { version: 1, pins: ids.slice(0, 8), filters: {} };
    expect(toggleAdminPin(current, ids[8], allowed)).toBe(current);
    expect(toggleAdminPin(current, 'restricted', allowed)).toBe(current);
    expect(toggleAdminPin(current, ids[0], allowed).pins).toHaveLength(7);
  });
  it('removes no-longer-authorized pins when updating the selection', () => {
    const next = toggleAdminPin({ version: 1, pins: ['old-role-tool'], filters: {} }, 'allowed', new Set(['allowed']));
    expect(next.pins).toEqual(['allowed']);
  });
});
