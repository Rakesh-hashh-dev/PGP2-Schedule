import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { watchControlHistory } from './adminControlHistory.js';
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function start(overrides = {}) {
  const deps = { section: 'mess', loadDraft: vi.fn().mockResolvedValue(null), loadVersions: vi.fn().mockResolvedValue([]), onResult: vi.fn(), onError: vi.fn(), windowTarget: new EventTarget(), ...overrides };
  return { ...deps, watcher: watchControlHistory(deps) };
}
it('automatically recovers from the missing versions table after schema reload', async () => {
  const loadVersions = vi.fn().mockRejectedValueOnce(new Error("Could not find public.app_controls_versions")).mockResolvedValue([{ revision: 1 }]);
  const ctx = start({ loadVersions });
  await vi.advanceTimersByTimeAsync(0);
  expect(ctx.onError).toHaveBeenLastCalledWith('History unavailable: Could not find public.app_controls_versions');
  expect(ctx.onResult).toHaveBeenLastCalledWith({ draft: null });
  await vi.advanceTimersByTimeAsync(3000);
  expect(ctx.onResult).toHaveBeenLastCalledWith({ draft: null, versions: [{ revision: 1 }] });
  expect(ctx.onError).toHaveBeenLastCalledWith('');
  await vi.advanceTimersByTimeAsync(60000);
  expect(loadVersions).toHaveBeenCalledTimes(2);
  ctx.watcher.stop();
});
it('refreshes private metadata on focus and reconnect', async () => {
  const ctx = start(); await vi.advanceTimersByTimeAsync(0);
  ctx.windowTarget.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(0);
  ctx.windowTarget.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0);
  expect(ctx.loadDraft).toHaveBeenCalledTimes(3); expect(ctx.loadDraft).toHaveBeenLastCalledWith('mess');
  ctx.watcher.stop();
});
it('coalesces reload requests and supports manual retry', async () => {
  let resolve;
  const loadVersions = vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue([]);
  const ctx = start({ loadVersions }); await vi.advanceTimersByTimeAsync(0);
  const first = ctx.watcher.refresh(), second = ctx.watcher.refresh();
  expect(first).toBe(second); expect(loadVersions).toHaveBeenCalledOnce();
  resolve([]); await first; await ctx.watcher.refresh();
  expect(loadVersions).toHaveBeenCalledTimes(2); ctx.watcher.stop();
});
it('keeps successfully loaded history when only draft loading fails', async () => {
  const ctx = start({ loadDraft: vi.fn().mockRejectedValue(new Error('Offline')), loadVersions: vi.fn().mockResolvedValue([{ revision: 4 }]) });
  await vi.advanceTimersByTimeAsync(0);
  expect(ctx.onResult).toHaveBeenLastCalledWith({ versions: [{ revision: 4 }] });
  expect(ctx.onError).toHaveBeenLastCalledWith('Draft unavailable: Offline');
  ctx.watcher.stop();
});
it('bounds retries and cancels timers and listeners when the panel closes', async () => {
  const ctx = start({ loadVersions: vi.fn().mockRejectedValue(new Error('Offline')) });
  await vi.advanceTimersByTimeAsync(45000);
  expect(ctx.loadVersions).toHaveBeenCalledTimes(5);
  ctx.watcher.stop();
  const count = ctx.loadVersions.mock.calls.length;
  await vi.advanceTimersByTimeAsync(120000); ctx.windowTarget.dispatchEvent(new Event('online'));
  expect(ctx.loadVersions).toHaveBeenCalledTimes(count);
});
it('ignores an outstanding response after unmount', async () => {
  let resolve;
  const ctx = start({ loadVersions: () => new Promise(r => { resolve = r; }) });
  await vi.advanceTimersByTimeAsync(0); ctx.watcher.stop(); resolve([]);
  await vi.advanceTimersByTimeAsync(0);
  expect(ctx.onResult).not.toHaveBeenCalled(); expect(ctx.onError).not.toHaveBeenCalled();
});
