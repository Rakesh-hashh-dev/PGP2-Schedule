import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { DEFAULT_CONTROLS, normalizeControls, validateControls } from './controlsSchema.js';
import { loadWorkspaceDraft,saveWorkspaceDraft } from './adminDraftRecovery.js';

const listeners = new Set();
const CACHE = 'pgp2.app-controls-v2';
const LEGACY_CACHE = 'pgp2.app-controls-v1';
let state = { payload: structuredClone(DEFAULT_CONTROLS), revision: 0, loaded: false, error: null };
let pending;
let consumers = 0;
let stopRefresh;
try {
  const cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
  if (cached) {
    state = { ...state, payload: normalizeControls(cached.payload), revision: cached.revision || 0 };
  } else {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CACHE) || 'null');
    if (legacy) {
      const { mess, navigation, dashboard } = legacy.payload || {};
      state = { ...state, payload: normalizeControls({ mess, navigation, dashboard }), revision: legacy.revision || 0 };
    }
  }
} catch { /* offline first paint uses defaults */ }
export const getControls = () => state;
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
function emit(next) { state = next; listeners.forEach(fn => fn()); }
export async function refreshControls() {
  if (pending) return pending;
  pending = (async () => {
    try {
      const { data, error } = await supabase.from('app_controls').select('payload,revision,updated_at').eq('id', 'global').single().abortSignal(AbortSignal.timeout(12000));
      if (error) throw error;
      const normalized = normalizeControls(data.payload);
      const next = { ...data, payload: normalized, loaded: true, error: null };
      try { localStorage.setItem(CACHE, JSON.stringify(next)); } catch { /* optional cache */ }
      emit(next);
    } catch (error) { emit({ ...state, loaded: true, error: error.message || 'Controls unavailable' }); }
    return state;
  })().finally(() => { pending = null; });
  return pending;
}
export function useAppControls() {
  const snapshot = useSyncExternalStore(subscribe, getControls, getControls);
  useEffect(() => {
    if (!state.loaded) void refreshControls();
    if (consumers++ === 0) {
      const refresh = () => { if (document.visibilityState !== 'hidden') void refreshControls(); };
      const timer = setInterval(refresh, 60000);
      window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
      stopRefresh = () => { clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
    }
    return () => { if (--consumers === 0) stopRefresh?.(); };
  }, []);
  return snapshot;
}
export async function loadControlDraft(section) {
  return loadWorkspaceDraft(section);
}
export async function saveControlDraft(section, payload, revision, draftRevision=0) {
  validateControls(section, payload);
  return saveWorkspaceDraft(section,payload,state.payload[section],revision,draftRevision);
}
export async function listControlVersions() {
  const { data, error } = await supabase.from('app_controls_versions').select('*').order('revision', { ascending: false }).limit(30);
  if (error) throw error; return data || [];
}
export async function publishControls(section, payload, revision) {
  validateControls(section, payload);
  if (section === 'mess' && payload.feedUrl !== state.payload.mess.feedUrl) {
    const { fetchMessMenuResult, MESS_MENU_FEED_URL } = await import('./messFeed.js');
    const result = await fetchMessMenuResult({ url: payload.feedUrl || MESS_MENU_FEED_URL, fresh: true });
    if (result.source !== 'live') throw new Error(`Source validation failed: ${result.error}`);
  }
  const rpc = section === 'bidflow' ? 'admin_publish_bidflow' : 'admin_publish_controls';
  const args = { p_payload: payload, p_revision: revision };
  if (section !== 'bidflow') args.p_section = section;
  const { data, error } = await supabase.rpc(rpc, args);
  if (error) throw error;
  if (!Number.isFinite(Number(data)) || Number(data) <= revision) throw new Error('Publication was not confirmed. Reload settings.');
  await refreshControls();
  if (state.revision < Number(data)) await refreshControls();
  if (state.error || state.revision < Number(data)) throw new Error('Published, but refresh could not verify the new revision. Reload before editing.');
  return data;
}
