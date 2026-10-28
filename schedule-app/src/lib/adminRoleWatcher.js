// Refreshes navigation eligibility only. The database remains the authority for
// admin reads and Monitor write restrictions; no role is stored in localStorage.
export function watchAdminRole({
  loadRole,
  onRole,
  onError = () => {},
  windowTarget = globalThis.window,
  documentTarget = globalThis.document,
  refreshMs = 60_000,
}) {
  let active = true;
  let pending = null;
  let queued = false;
  let retry = null;
  let failures = 0;

  const clearRetry = () => { clearTimeout(retry); retry = null; };
  const refresh = () => {
    if (!active || documentTarget?.hidden) return Promise.resolve();
    // A focus/online event during a request must not let an older result win.
    if (pending) { queued = true; return pending; }
    clearRetry();
    pending = Promise.resolve().then(loadRole).then(role => {
      if (!active) return;
      if (role !== null && role !== 'monitor' && role !== 'superadmin') {
        throw new Error('Unrecognised admin role response');
      }
      failures = 0;
      onRole(role);
    }).catch(error => {
      if (!active) return;
      // An auth/token or network failure is not an authoritative revocation.
      // Keep the last resolved UI value and retry instead of hiding access.
      const delay = [1_000, 3_000, 10_000, 30_000][Math.min(failures++, 3)];
      retry = setTimeout(refresh, delay);
      onError(error);
    }).finally(() => {
      pending = null;
      if (active && queued) { queued = false; refresh(); }
    });
    return pending;
  };

  const visible = () => { if (!documentTarget?.hidden) refresh(); };
  windowTarget?.addEventListener('focus', visible);
  windowTarget?.addEventListener('online', visible);
  documentTarget?.addEventListener('visibilitychange', visible);
  const interval = setInterval(visible, refreshMs);
  refresh();

  return {
    refresh,
    stop() {
      active = false;
      queued = false;
      clearRetry();
      clearInterval(interval);
      windowTarget?.removeEventListener('focus', visible);
      windowTarget?.removeEventListener('online', visible);
      documentTarget?.removeEventListener('visibilitychange', visible);
    },
  };
}
