// Private metadata is independent of the editor's unsaved configuration.
// Recover after schema-cache refreshes, transient failures and late auth readiness.
export function watchControlHistory({ section, loadDraft, loadVersions, onResult, onError, windowTarget = globalThis.window }) {
  let stopped = false;
  let pending = null;
  let retry = null;
  let failures = 0;
  const clearRetry = () => { if (retry !== null) clearTimeout(retry); retry = null; };
  function refresh() {
    if (stopped) return Promise.resolve();
    if (pending) return pending;
    clearRetry();
    pending = Promise.allSettled([
      Promise.resolve().then(() => loadDraft(section)),
      Promise.resolve().then(() => loadVersions()),
    ]).then(([draft, versions]) => {
      if (stopped) return;
      const result = {};
      const errors = [];
      if (draft.status === 'fulfilled') result.draft = draft.value;
      else errors.push(`Draft unavailable: ${draft.reason?.message || 'Request failed'}`);
      if (versions.status === 'fulfilled') result.versions = versions.value;
      else errors.push(`History unavailable: ${versions.reason?.message || 'Request failed'}`);
      onResult(result);
      const error = errors.join(' · ');
      onError(error);
      if (error) {
        failures += 1;
        retry = setTimeout(() => { retry = null; void refresh(); }, Math.min(30000, 3000 * 2 ** Math.min(failures - 1, 4)));
      } else failures = 0;
      return { ...result, error };
    }).finally(() => { pending = null; });
    return pending;
  }
  const onResume = () => { void refresh(); };
  windowTarget?.addEventListener?.('online', onResume);
  windowTarget?.addEventListener?.('focus', onResume);
  void refresh();
  return {
    refresh,
    stop() {
      stopped = true;
      clearRetry();
      windowTarget?.removeEventListener?.('online', onResume);
      windowTarget?.removeEventListener?.('focus', onResume);
    },
  };
}
