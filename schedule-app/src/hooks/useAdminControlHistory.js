import { useCallback, useEffect, useRef, useState } from 'react';
import { loadControlDraft, listControlVersions } from '../lib/appControls.js';
import { watchControlHistory } from '../lib/adminControlHistory.js';

export function useAdminControlHistory(section) {
  const [metadata, setMetadata] = useState({ draft: null, versions: [], error: '' });
  const watcher = useRef(null);
  useEffect(() => {
    const instance = watchControlHistory({
      section,
      loadDraft: loadControlDraft,
      loadVersions: listControlVersions,
      onResult: result => setMetadata(previous => ({ ...previous, ...result })),
      onError: error => setMetadata(previous => ({ ...previous, error })),
    });
    watcher.current = instance;
    return () => { instance.stop(); if (watcher.current === instance) watcher.current = null; };
  }, [section]);
  const reload = useCallback(() => watcher.current?.refresh() || Promise.resolve(), []);
  const setDraft = useCallback(draft => setMetadata(previous => ({ ...previous, draft })), []);
  return { ...metadata, reload, setDraft };
}
