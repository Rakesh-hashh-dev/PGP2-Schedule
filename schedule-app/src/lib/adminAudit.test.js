import { expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock('./supabase', () => ({ supabase: { rpc } }));
import { logAdminAction } from './adminAudit.js';
it('never trusts a caller-supplied actor or directly inserts audit records', async () => {
  await logAdminAction('forged-admin', 'open_config', { area: 'schedule' });
  expect(rpc).toHaveBeenCalledWith('admin_record_event', { p_action: 'open_config', p_details: { area: 'schedule' } });
});
