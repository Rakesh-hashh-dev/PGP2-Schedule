import { useEffect, useState } from 'react';
import { diwaliCampaign, diwaliStorageKey, readDiwaliPrefs, saveDiwaliPrefs } from '../lib/diwali.js';
export function useDiwali(userId, now, flags) {
  const campaign = diwaliCampaign(now, flags);
  const key = diwaliStorageKey(userId, campaign?.key || 'inactive');
  const [snapshot, setSnapshot] = useState(() => ({ key, value: readDiwaliPrefs(key) }));
  const prefs = snapshot.key === key ? snapshot.value : readDiwaliPrefs(key);
  useEffect(() => {
    const sync = event => { if (event.key === key) setSnapshot({ key, value: readDiwaliPrefs(key) }); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);
  const update = patch => setSnapshot(current => {
    const value = { ...(current.key === key ? current.value : readDiwaliPrefs(key)), ...patch };
    saveDiwaliPrefs(key, value);
    return { key, value };
  });
  const enabled = !!campaign && prefs.enabled;
  return { campaign, prefs, enabled, outfit: enabled && prefs.outfit, update };
}
