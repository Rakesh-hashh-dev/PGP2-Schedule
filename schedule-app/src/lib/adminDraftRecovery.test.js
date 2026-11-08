import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: {} }));
import { createDraftAutosaver } from './adminDraftRecovery.js';
afterEach(() => vi.useRealTimers());
it('coalesces edits and serialises saves using their returned revision', async () => {
  vi.useFakeTimers();
  let resolve;
  const save = vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue({ draft_revision: 2 });
  const autosaver = createDraftAutosaver({ save, onSaved: vi.fn(), onError: vi.fn(), delay: 10 });
  autosaver.update('first'); autosaver.update('second'); await vi.advanceTimersByTimeAsync(10);
  expect(save).toHaveBeenCalledWith('second', 0);
  autosaver.update('third'); await vi.advanceTimersByTimeAsync(10); expect(save).toHaveBeenCalledTimes(1);
  resolve({ draft_revision: 1 }); await vi.advanceTimersByTimeAsync(20);
  expect(save).toHaveBeenLastCalledWith('third', 1); autosaver.stop();
});
it('reports conflicts and retains failed edits for explicit retry', async () => {
  vi.useFakeTimers();
  const onError = vi.fn(), save = vi.fn().mockRejectedValueOnce(new Error('stale')).mockResolvedValue({ draft_revision: 1 });
  const autosaver = createDraftAutosaver({ save, onSaved: vi.fn(), onError, delay: 10 });
  autosaver.update('edits'); await vi.advanceTimersByTimeAsync(100);
  expect(onError).toHaveBeenCalledOnce(); expect(save).toHaveBeenCalledTimes(1);
  await autosaver.retry(); expect(save).toHaveBeenLastCalledWith('edits', 0); autosaver.stop();
});
