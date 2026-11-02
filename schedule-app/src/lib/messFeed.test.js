import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { fetchMessMenuResult, validateMessPayload, MESS_MENU_FEED_URL } from './messFeed.js';
let cache;
beforeEach(() => { cache = new Map(); vi.stubGlobal('localStorage', { getItem: k => cache.get(k) || null, setItem: (k, v) => cache.set(k, v) }); });
afterEach(() => vi.unstubAllGlobals());
it('validates payloads rather than treating HTTP success as health', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ menu: {} }) }));
  const result = await fetchMessMenuResult(); expect(result.source).toBe('bundled'); expect(result.error).toMatch(/Empty/);
  expect(() => validateMessPayload({ menu: { 1: { lunch: 'rice' } } })).toThrow();
});
it('distinguishes cached fallback from a fresh response and isolates source caches', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ menu: { 1: { lunch: ['RICE'] } }, buildTs: 'v1' }) }).mockRejectedValue(new Error('Offline')));
  const first = await fetchMessMenuResult({ fresh: true }); expect(first.source).toBe('live'); expect(first.menu[1].lunch).toEqual(['Rice']);
  const second = await fetchMessMenuResult(); expect(second.source).toBe('cache'); expect(second.error).toBe('Offline'); expect(second.fetchedAt).toBe(first.fetchedAt);
  const third = await fetchMessMenuResult({ url: MESS_MENU_FEED_URL.replace('/s/', '/s/other') }); expect(third.source).toBe('bundled'); expect(third.menu).toBeNull();
});
