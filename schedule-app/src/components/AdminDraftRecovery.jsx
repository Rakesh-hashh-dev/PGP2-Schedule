import { useEffect, useRef, useState,useCallback } from 'react';
import { createDraftAutosaver, discardWorkspaceDraft, loadWorkspaceDraft, saveWorkspaceDraft } from '../lib/adminDraftRecovery.js';
import { domainPayload, loadPublication, PUBLICATION_DOMAINS } from '../lib/adminPublication.js';
import { hasAdminCapability } from '../lib/adminCapabilities.js';
import {mergeAdminDraft,sameAdminDraft} from '../lib/adminDraftMerge.js';
import {useAdminNavigationGuard} from '../hooks/useAdminNavigationGuard.js';
import { Cloud, CloudCheck, CircleCheck, Clock3, AlertCircle, LockKeyhole, RotateCcw, ChevronDown, ShieldCheck, FileClock } from 'lucide-react';
import { DRAFT_AREAS, draftPresentation } from '../lib/adminWorkspacePresentation.js';
import '../styles/admin-workspace.css';

function AreaDraft({ domain, role, flags, originalFlags, announcement, originalAnnouncement, onResume, baseOverrides,onAttention,onStatus }) {
  const [draft, setDraft] = useState(null);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const canEdit = hasAdminCapability(role, `${domain}.publish`);
  useEffect(()=>{onAttention?.(blocked||!!error);},[blocked,error,onAttention]);
  const saver = useRef(null);
  const published = useRef(null);
  const payload = domainPayload(domain, flags, announcement);
  const base = baseOverrides?.[domain] || domainPayload(domain, originalFlags, originalAnnouncement);
  const dirty = !sameAdminDraft(payload, base);
  const savedMatches = sameAdminDraft(draft?.payload, payload);
  useAdminNavigationGuard(canEdit && dirty && !savedMatches, `${domain} changes`);
  const encoded = JSON.stringify(payload), baseEncoded = JSON.stringify(base);
  useEffect(() => {
    if (!canEdit) return;
    let active = true;
    Promise.all([loadWorkspaceDraft(domain), loadPublication(domain)]).then(async ([existing, state]) => {
      if (!active) return;
      if(existing && hasAdminCapability(role,`${domain}.publish`)) {
        const included=mergeAdminDraft(existing.base_payload,existing.payload,state.payload);
        if(!included.conflicts.length && sameAdminDraft(included.value,state.payload)) {await discardWorkspaceDraft(domain,Number(existing.draft_revision));existing=null;}
      }
      if(!active)return;
      published.current = state;
      setDraft(existing); setBlocked(!!existing); setReady(true); setError(''); setSavedAt(existing?.updated_at || '');
      saver.current = createDraftAutosaver({ initialRevision: Number(existing?.draft_revision || 0),
        save: (item, revision) => saveWorkspaceDraft(domain, item.payload, item.base, item.baseRevision, revision),
        onSaved: result => { if (active) { setDraft(result); setSavedAt(result.updated_at); setError(''); } },
        onError: e => { if (active) setError(e.message); },
      });
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; saver.current?.stop(); };
  }, [domain, reloadKey, role, canEdit]);
  useEffect(() => {
    if (ready && !blocked && dirty && hasAdminCapability(role, `${domain}.publish`)) {
      saver.current?.update({ payload: JSON.parse(encoded), base: JSON.parse(baseEncoded), baseRevision: published.current.revision });
    }
  }, [ready, blocked, dirty, encoded, baseEncoded, role, domain]);
  const discard = async () => {
    if (!canEdit || !draft || busy) return;
    setBusy(true);
    try {
      await discardWorkspaceDraft(domain, Number(draft.draft_revision));
      saver.current?.stop();
      // A fresh instance is required after deletion so its next save starts at 0.
      saver.current = createDraftAutosaver({ save: (item, revision) => saveWorkspaceDraft(domain, item.payload, item.base, item.baseRevision, revision),
        onSaved: result => { setDraft(result); setSavedAt(result.updated_at); setError(''); }, onError: e => setError(e.message) });
      setDraft(null); setBlocked(false); setSavedAt(''); setError('');
      setConfirmation(null);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const state = draftPresentation({ canEdit, ready, blocked, error, dirty, savedMatches, savedAt });
  useEffect(() => { onStatus?.(domain, state.key); return () => onStatus?.(domain, 'loading'); }, [domain, state.key, onStatus]);
  const Icon = { clean: CircleCheck, saved: CloudCheck, pending: Clock3, loading: Cloud, recovery: FileClock, error: AlertCircle, readonly: LockKeyhole }[state.key];
  const resume = () => { if (!canEdit || !draft) return; onResume(domain, draft.payload, draft.base_payload); setBlocked(false); setConfirmation(null); };
  const saveNow = () => {
    if (!canEdit || !ready || blocked) return;
    saver.current?.update({ payload: JSON.parse(encoded), base: JSON.parse(baseEncoded), baseRevision: published.current.revision });
    void saver.current?.retry();
  };
  return <article className={`aw-draft-area aw-state-${state.key}`} aria-label={`${DRAFT_AREAS[domain].label} draft`}>
    <div className="aw-draft-title"><span className="aw-area-icon"><Icon size={16} aria-hidden="true" /></span><div><h3>{DRAFT_AREAS[domain].label}</h3><span>{DRAFT_AREAS[domain].description}</span></div><span className="aw-status">{state.label}</span></div>
    <p className="aw-draft-detail" role={error ? 'alert' : 'status'}>{state.detail}</p>
    {blocked && canEdit && <><div className="aw-saved-meta"><LockKeyhole size={12} /> Private saved copy{draft?.updated_at && <time dateTime={draft.updated_at}> · {new Date(draft.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>}</div><div className="aw-inline-actions"><button type="button" className="aw-button aw-primary" disabled={busy} onClick={() => dirty ? setConfirmation('resume') : resume()}><RotateCcw size={13} /> Resume saved draft</button><button type="button" className="aw-link aw-danger" disabled={busy} onClick={() => setConfirmation('discard')}>Discard saved copy…</button></div></>}
    {confirmation && <div className="aw-confirmation" role="group" aria-label={confirmation === 'discard' ? 'Confirm draft discard' : 'Confirm draft recovery'}><strong>{confirmation === 'discard' ? 'Discard this saved copy?' : 'Replace your current editor changes?'}</strong><p>{confirmation === 'discard' ? 'The private saved copy will be removed. Your current editor changes and published app settings stay unchanged.' : 'The saved draft will replace this area’s current edits. You can review it before publishing.'}</p><div className="aw-inline-actions"><button type="button" disabled={busy} className={`aw-button ${confirmation === 'discard' ? 'aw-danger' : 'aw-primary'}`} onClick={confirmation === 'discard' ? discard : resume}>{busy ? 'Discarding…' : confirmation === 'discard' ? 'Discard saved copy' : 'Replace and resume'}</button><button type="button" disabled={busy} className="aw-button" onClick={() => setConfirmation(null)}>Keep editing</button></div></div>}
    {state.key === 'pending' && <button type="button" className="aw-link" onClick={saveNow}>Save privately now</button>}
    {error && canEdit && <div className="aw-inline-actions">{ready && <button type="button" className="aw-button" onClick={() => void saver.current?.retry()}>Retry save</button>}<button type="button" className="aw-link" onClick={() => { setReady(false); setError(''); setReloadKey(key => key + 1); }}>Reload draft status</button></div>}
  </article>;
}
export default function AdminDraftRecovery(props) {
  const panel=useRef(null);
  const [statuses, setStatuses] = useState({});
  const onAttention=useCallback(needed=>{if(needed&&panel.current)panel.current.open=true;},[]);
  const onStatus = useCallback((domain, state) => setStatuses(current => current[domain] === state ? current : { ...current, [domain]: state }), []);
  const values = Object.values(statuses);
  const attention = values.filter(value => value === 'error' || value === 'recovery').length;
  const summary = attention ? `${attention} need${attention === 1 ? 's' : ''} attention` : values.length < PUBLICATION_DOMAINS.length || values.includes('loading') ? 'Checking drafts' : values.includes('pending') ? 'Save pending' : values.every(value => value === 'readonly') ? 'Read-only access' : 'Private autosave';
  return <details ref={panel} className="admin-card admin-draft-status aw-card aw-recovery" aria-label="Private draft recovery"><summary className="aw-recovery-summary"><span className="aw-heading-icon"><ShieldCheck size={17} /></span><span className="aw-recovery-label"><strong>Private drafts &amp; recovery</strong><small>Your work, kept separate from the live app.</small></span><span className={`aw-count${attention ? ' aw-attention' : ''}`}>{summary}</span><ChevronDown size={14} className="aw-chevron" aria-hidden="true" /></summary>
    <p className="aw-recovery-explainer">Settings autosave privately. Publishing is a separate step. Student notes use their own Save button.</p>
    <div className="aw-draft-list">{PUBLICATION_DOMAINS.map(domain => <AreaDraft key={`${domain}:${props.resetKeys?.[domain] || 0}`} domain={domain} onAttention={onAttention} onStatus={onStatus} {...props} />)}</div>
  </details>;
}
