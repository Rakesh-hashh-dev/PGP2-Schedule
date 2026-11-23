import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: mocks }));
beforeEach(() => { vi.resetModules(); mocks.from.mockReset(); mocks.rpc.mockReset(); vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());
function readRow(row, error = null) { mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ single: () => ({ abortSignal: async () => ({ data: row, error }) }) }) }) }); }
it('does not report failed publication as success', async () => {
  const { publishControls } = await import('./appControls.js');
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Conflict' } });
  await expect(publishControls('dashboard', {}, 0)).rejects.toMatchObject({ message: 'Conflict' });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  await expect(publishControls('dashboard', {}, 0)).rejects.toThrow(/not confirmed/);
});
it('verifies published state by reading it back', async () => {
  const { publishControls, getControls } = await import('./appControls.js');
  mocks.rpc.mockResolvedValue({ data: 1, error: null });
  readRow({ revision: 1, payload: { dashboard: { density: 'compact' } } });
  await expect(publishControls('dashboard', { density: 'compact' }, 0)).resolves.toBe(1);
  expect(getControls().payload.dashboard.density).toBe('compact');
});
it('keeps the last known public configuration on a failed refresh', async () => {
  const { refreshControls, getControls } = await import('./appControls.js');
  readRow({ revision: 3, payload: { navigation: { items: { split: { visible: false } } } } });
  await refreshControls(); readRow(null, { message: 'Offline' }); await refreshControls();
  expect(getControls().revision).toBe(3); expect(getControls().payload.navigation.items.split.visible).toBe(false); expect(getControls().error).toBe('Offline');
});
it('retains saved dashboard choices and applies defaults only without a layout', async () => {
  const { readDashboardPrefs, DASHBOARD_KEY } = await import('./dashboardPrefs.js');
  const values = new Map(); vi.stubGlobal('localStorage', { getItem: key => values.get(key) || null });
  expect(readDashboardPrefs({ density: 'compact', visible: { mess: false } })).toMatchObject({ density: 'compact', visible: { mess: false } });
  values.set(DASHBOARD_KEY, JSON.stringify({ density: 'comfortable', visible: { mess: true } }));
  expect(readDashboardPrefs({ density: 'compact', visible: { mess: false } })).toMatchObject({ density: 'comfortable', visible: { mess: true } });
});

it('publishes BidFlow through the schedule-authorized RPC and ignores legacy browser catalog overrides', async () => {
  const course = { code: 'ABC', name: 'Course ABC', area: 'OPS', credits: 3, facultyType: 'Internal' };
  const config = { enabled: true, cohort: 'PGP2', term: 'Term V', courses: [course] };
  const legacy = JSON.stringify({ payload: { dashboard: { density: 'compact' }, bidflow: config }, revision: 2 });
  vi.stubGlobal('localStorage', { getItem: key => key === 'pgp2.app-controls-v1' ? legacy : key === 'pgp2.controls-bidflow' ? JSON.stringify({ enabled: false }) : null, setItem: vi.fn() });
  const { publishControls, getControls } = await import('./appControls.js');
  expect(getControls().payload.bidflow.enabled).toBe(false);
  mocks.rpc.mockResolvedValue({ data: 3, error: null });
  readRow({ revision: 3, payload: { bidflow: config } });
  await expect(publishControls('bidflow', config, 2)).resolves.toBe(3);
  expect(mocks.rpc).toHaveBeenCalledWith('admin_publish_bidflow', { p_payload: config, p_revision: 2 });
  expect(getControls().payload.bidflow).toMatchObject({ enabled: true, courses: [course] });
});
