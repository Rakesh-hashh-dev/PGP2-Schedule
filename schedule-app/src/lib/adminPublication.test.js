import { expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: {} }));
import { domainPayload, mergePublishedDomain,scheduleDomain } from './adminPublication.js';
it('partitions legacy settings and excludes private data and bookkeeping', () => {
  const flags = { classOverrides: { date: {} }, enableFriends: true, quickLinks: [], configHistory: [], adminNotes: { s: 'private' } };
  expect(domainPayload('schedule', flags)).toEqual({ flags: { classOverrides: { date: {} } } });
  expect(domainPayload('communications', flags, null)).toEqual({ flags: { quickLinks: [] }, announcement: null });
  expect(domainPayload('system', flags)).toEqual({ flags: { enableFriends: true } });
});
it('merges only the published area while retaining other staged changes', () => {
  expect(mergePublishedDomain({ classOverrides: { old: {} }, enableFriends: false, quickLinks: ['pending'] }, 'schedule', { flags: { classOverrides: { next: {} } } }))
    .toEqual({ classOverrides: { next: {} }, enableFriends: false, quickLinks: ['pending'] });
});
it('rejects impossible dates and ambiguous local timestamps before any RPC',async()=>{
  await expect(scheduleDomain('schedule',{flags:{}},0,'2026-02-30T10:00')).rejects.toThrow('valid IST');
  await expect(scheduleDomain('schedule',{flags:{}},0,'2026-11-05T25:00')).rejects.toThrow('valid IST');
});
