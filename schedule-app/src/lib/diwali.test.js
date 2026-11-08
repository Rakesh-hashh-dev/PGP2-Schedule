import { afterEach, describe, expect, it, vi } from 'vitest';
import { diwaliCampaign, diwaliGreetingRows, validFestivalDate, diwaliDecorEnabled } from '../../supabase/functions/_shared/diwali.js';
import { diwaliStorageKey, readDiwaliPrefs, saveDiwaliPrefs, DIWALI_DEFAULTS } from './diwali.js';
afterEach(() => vi.unstubAllGlobals());
describe('Diwali campaign and personal choices', () => {
  it('uses the IST calendar at midnight and only the verified year', () => {
    expect(diwaliCampaign(new Date('2026-11-06T18:29:59Z'))).toBeNull();
    expect(diwaliCampaign(new Date('2026-11-06T18:30:00Z'))?.today).toBe('2026-11-07');
    expect(diwaliCampaign(new Date('2026-11-09T18:30:00Z'))).toBeNull();
    expect(diwaliCampaign(new Date('2027-11-08T12:00:00Z'))).toBeNull();
  });
  it('supports an explicit admin date and kill switches', () => {
    const now = new Date('2027-10-29T10:00:00Z');
    expect(diwaliCampaign(now, { diwali: { date: '2027-10-29' } })?.date).toBe('2027-10-29');
    expect(diwaliCampaign(now, { diwali: { date: '2027-10-29', enabled: false } })).toBeNull();
    expect(diwaliCampaign(new Date('2026-11-08T10:00:00Z'), { features: { diwaliDecor: false } })).toBeNull();
  });
  it('controls Diwali independently of national-day decor and preserves legacy choices', () => {
    const now = new Date('2026-11-08T10:00:00Z');
    expect(diwaliCampaign(now, { features: { specialDayTheme: false } })).not.toBeNull();
    expect(diwaliCampaign(now, { features: { specialDayTheme: true, diwaliDecor: false } })).toBeNull();
    expect(diwaliDecorEnabled({ diwali: { enabled: false } })).toBe(false);
    expect(diwaliDecorEnabled({ diwali: { enabled: false }, features: { diwaliDecor: true } })).toBe(true);
    expect(diwaliDecorEnabled({ features: { diwaliDecor: false } })).toBe(false);
  });
  it.each(['2026-02-30', '2026-11-8', '2026-13-01', 'invalid'])('rejects invalid campaign dates: %s', date => expect(validFestivalDate(date)).toBe(false));
  it('isolates users, events, and malformed local storage', () => {
    const data = new Map(); vi.stubGlobal('localStorage', { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) });
    const alice = diwaliStorageKey('alice', 'diwali:2026-11-08');
    const bob = diwaliStorageKey('bob', 'diwali:2026-11-08');
    saveDiwaliPrefs(alice, { enabled: false, lit: true, outfit: false });
    expect(readDiwaliPrefs(alice)).toEqual({ enabled: false, lit: true, outfit: false, fireworks: true });
    expect(readDiwaliPrefs(bob)).toEqual(DIWALI_DEFAULTS);
    expect(readDiwaliPrefs(diwaliStorageKey('alice', 'diwali:2027-10-29'))).toEqual(DIWALI_DEFAULTS);
    data.set(bob, '{bad'); expect(readDiwaliPrefs(bob)).toEqual(DIWALI_DEFAULTS);
    data.set(bob, JSON.stringify({ enabled: 'false', lit: true })); expect(readDiwaliPrefs(bob).enabled).toBe(true);
  });
  it('works in-session if local storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
    expect(readDiwaliPrefs('key')).toEqual(DIWALI_DEFAULTS);
    expect(() => saveDiwaliPrefs('key', DIWALI_DEFAULTS)).not.toThrow();
  });
  it('produces one stable festive event per subscribed student and respects opt-out', () => {
    const input = { now: new Date('2026-11-08T06:00:00Z'), profiles: [{ user_id: 'yes' }, { user_id: 'no' }, { user_id: 'none' }], subscriptions: [{ user_id: 'yes' }, { user_id: 'yes' }, { user_id: 'no' }], prefs: [{ user_id: 'no', prefs: { festive_greeting: { push: false } } }] };
    const rows = diwaliGreetingRows(input);
    expect(rows).toHaveLength(1); expect(rows[0].user_id).toBe('yes');
    expect(rows[0].data.urgency).toBe('normal');
    expect(rows[0].data.expires_at).toBe('2026-11-08T23:59:00+05:30');
    expect(diwaliGreetingRows({ ...input, now: new Date('2026-11-08T07:00:00Z') })[0].dedup_key).toBe(rows[0].dedup_key);
    expect(diwaliGreetingRows({ ...input, flags: { diwali: { greetingPush: false } } })).toEqual([]);
  });
  it('does not send before 9 AM, after 10 PM, or on adjacent theme days', () => {
    const input = { profiles: [{ user_id: 'yes' }], subscriptions: [{ user_id: 'yes' }] };
    for (const date of ['2026-11-08T02:00:00Z', '2026-11-08T17:00:00Z', '2026-11-07T06:00:00Z', '2026-11-09T06:00:00Z']) expect(diwaliGreetingRows({ ...input, now: new Date(date) })).toEqual([]);
  });
});
