import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchAdminRole } from './adminRoleWatcher.js';

describe('admin role discovery for open sessions', () => {
  let windowTarget, documentTarget, watchers;
  beforeEach(() => {
    vi.useFakeTimers();
    windowTarget = new EventTarget();
    documentTarget = new EventTarget();
    documentTarget.hidden = false;
    watchers = [];
  });
  afterEach(() => { watchers.forEach(watcher => watcher.stop()); vi.useRealTimers(); });
  const flush = () => vi.advanceTimersByTimeAsync(0);
  function watch(loadRole) {
    const onRole = vi.fn();
    const onError = vi.fn();
    const watcher = watchAdminRole({ loadRole, onRole, onError, windowTarget, documentTarget });
    watchers.push(watcher);
    return { watcher, onRole, onError };
  }

  it('discovers an already granted Monitor on initial load', async () => {
    const { onRole } = watch(vi.fn().mockResolvedValue('monitor'));
    await flush();
    expect(onRole).toHaveBeenCalledWith('monitor');
  });

  it('finds a new grant without signing out or reloading', async () => {
    const loadRole = vi.fn().mockResolvedValueOnce(null).mockResolvedValue('monitor');
    const { onRole } = watch(loadRole);
    await flush();
    expect(onRole).toHaveBeenLastCalledWith(null);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onRole).toHaveBeenLastCalledWith('monitor');
  });

  it('retries an initial auth/token failure instead of permanently hiding access', async () => {
    const loadRole = vi.fn().mockRejectedValueOnce(new Error('JWT not ready')).mockResolvedValue('monitor');
    const { onRole, onError } = watch(loadRole);
    await flush();
    expect(onRole).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRole).toHaveBeenLastCalledWith('monitor');
  });

  for (const event of ['focus', 'online']) {
    it(`refreshes a grant immediately on ${event}`, async () => {
      const loadRole = vi.fn().mockResolvedValueOnce(null).mockResolvedValue('monitor');
      const { onRole } = watch(loadRole);
      await flush();
      windowTarget.dispatchEvent(new Event(event));
      await flush();
      expect(onRole).toHaveBeenLastCalledWith('monitor');
    });
  }

  it('pauses background polling and refreshes on returning to the mobile app', async () => {
    const loadRole = vi.fn().mockResolvedValueOnce(null).mockResolvedValue('monitor');
    const { onRole } = watch(loadRole);
    await flush();
    documentTarget.hidden = true;
    await vi.advanceTimersByTimeAsync(180_000);
    expect(loadRole).toHaveBeenCalledTimes(1);
    documentTarget.hidden = false;
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(onRole).toHaveBeenLastCalledWith('monitor');
  });

  it('applies an authoritative revocation and does not treat a network error as one', async () => {
    const loadRole = vi.fn().mockResolvedValueOnce('monitor').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(null);
    const { onRole } = watch(loadRole);
    await flush();
    windowTarget.dispatchEvent(new Event('focus'));
    await flush();
    expect(onRole).toHaveBeenCalledTimes(1);
    expect(onRole).toHaveBeenLastCalledWith('monitor');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onRole).toHaveBeenLastCalledWith(null);
  });

  it('serializes concurrent refreshes and follows up after an in-flight lookup', async () => {
    let resolve;
    const loadRole = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue('monitor');
    const { onRole } = watch(loadRole);
    await flush();
    windowTarget.dispatchEvent(new Event('focus'));
    windowTarget.dispatchEvent(new Event('online'));
    expect(loadRole).toHaveBeenCalledTimes(1);
    resolve(null);
    await flush();
    expect(loadRole).toHaveBeenCalledTimes(2);
    expect(onRole.mock.calls).toEqual([[null], ['monitor']]);
  });

  it('ignores an old account response and removes timers/listeners on stop', async () => {
    let resolve;
    const loadRole = vi.fn(() => new Promise(done => { resolve = done; }));
    const { watcher, onRole } = watch(loadRole);
    await flush();
    watcher.stop();
    resolve('superadmin');
    windowTarget.dispatchEvent(new Event('focus'));
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(onRole).not.toHaveBeenCalled();
    expect(loadRole).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects unexpected role values without granting navigation access', async () => {
    const { onRole, onError } = watch(vi.fn().mockResolvedValue('student'));
    await flush();
    expect(onRole).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });
});
