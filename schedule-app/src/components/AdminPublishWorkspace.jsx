import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { domainPayload, loadPublication, PUBLICATION_DOMAINS, publishDomain, scheduleDomain, previewScheduleNotices, publishScheduleWithNotice } from '../lib/adminPublication.js';
import { hasAdminCapability } from '../lib/adminCapabilities.js';
import { mergeAdminDraft, resolveDraftField } from '../lib/adminDraftMerge.js';
import { supabase } from '../lib/supabase';
import PushPreview from './PushPreview.jsx';
import { scheduleNoticeCopy } from '../../supabase/functions/_shared/notificationCopy.js';
import '../styles/admin-publishing.css';

export default function AdminPublishWorkspace({ role, flags, originalFlags, announcement, originalAnnouncement, onPublished, scheduleAt = '', baseOverrides, onClose }) {
  const [domain, setDomain] = useState('schedule');
  const [snapshot, setSnapshot] = useState(null);
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState(scheduleAt);
  const [versions, setVersions] = useState([]);
  const [restore, setRestore] = useState(null);
  const [notify, setNotify] = useState(false), [noticeMessage, setNoticeMessage] = useState(''), [audience, setAudience] = useState(null);
  const local = domainPayload(domain, flags, announcement);
  const base = baseOverrides?.[domain] || domainPayload(domain, originalFlags, originalAnnouncement);
  useEffect(() => {
    let active = true;
    loadPublication(domain).then(data => { if (active) { setSnapshot(data); setReview(null); setRestore(null); setError(''); } })
      .catch(e => { if (active) setError(e.message); });
    supabase.from('admin_publication_versions').select('revision,payload,created_at,created_by').eq('domain', domain).order('revision', { ascending: false }).limit(20)
      .then(({ data, error: failure }) => { if (active) { if (failure) setError(failure.message); else setVersions(data || []); } });
    return () => { active = false; };
  }, [domain]);
  const run = async action => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const prepare = () => run(async () => {
    const fresh = await loadPublication(domain);
    setSnapshot(fresh);
    setAudience(null);
    const merged = restore ? { value: restore, conflicts: [] } : mergeAdminDraft(base, local, fresh.payload);
    setReview({ ...merged, before: fresh.payload, revision: fresh.revision });
  });
  const publish = () => run(async () => {
    if (!review || review.conflicts.length) throw new Error('Review and resolve conflicts first.');
    if (notify && domain === 'schedule' && !audience) throw new Error('Preview the affected audience before confirming.');
    if (at) {
      await scheduleDomain(domain, review.value, review.revision, at, domain === 'schedule' && notify ? audience.id : null);
      setMessage('This area is scheduled. Its revision and your permission will be checked again at execution.');
    } else {
      const result = domain === 'schedule' && notify ? await publishScheduleWithNotice(review.value, review.revision, audience.id) : await publishDomain(domain, review.value, review.revision);
      await onPublished(domain, result.payload, result.revision);
      setSnapshot(result); setRestore(null);
      setMessage(`Published ${domain} revision ${result.revision}. Other staged areas are preserved.${result.notice_count !== undefined ? ` ${result.notice_count} notifications queued; delivery is tracked in diagnostics.` : ''}`);
    }
    setReview(null);
  });
  const allowed = hasAdminCapability(role, `${domain}.publish`);
  return <section className="admin-publish-workspace" aria-label="Scoped publishing">
    <p>Review and publish one area at a time. Mess, navigation and dashboard defaults use their own review controls.</p>
    <nav className="apw-tabs" aria-label="Publication areas">{PUBLICATION_DOMAINS.map(area => <button type="button" key={area} aria-pressed={area === domain} onClick={() => { setDomain(area); setSnapshot(null); setReview(null); setMessage(''); }}>
      {area}{JSON.stringify(domainPayload(area, flags, announcement)) !== JSON.stringify(domainPayload(area, originalFlags, originalAnnouncement)) ? ' · pending' : ''}
    </button>)}</nav>
    {error && (
      <div className="apw-error-card" role="alert">
        <AlertTriangle size={18} />
        <div><strong>Action failed</strong><p>{error}</p></div>
      </div>
    )}
    {message && (
      <div className="apw-success-card" role="status">
        <div className="apw-success-icon-wrap">
          <CheckCircle2 size={24} color="#10b981" />
        </div>
        <div className="apw-success-body">
          <div className="apw-success-title-row">
            <strong>Deployed successfully</strong>
            <span className="apw-live-badge"><i /> Live</span>
          </div>
          <p>{message}</p>
        </div>
        {onClose && (
          <button type="button" className="admin-btn primary apw-done-btn" onClick={onClose}>
            Done <Check size={14} />
          </button>
        )}
      </div>
    )}
    {!snapshot && !error && <p role="status">Loading publication state…</p>}
    {!allowed && <p>Read-only access to this area.</p>}
    <button type="button" className="admin-btn" disabled={busy || !snapshot || !allowed} onClick={prepare}>Review {domain} changes</button>
    {review && <div>
      {review.conflicts.map(conflict => <fieldset key={conflict.path}><legend>Conflict: {conflict.path}</legend>
        <p>Choose the value to include in this publication.</p>
        <button type="button" onClick={() => setReview(current => ({ ...current, value: resolveDraftField(current.value, conflict.keys, conflict.local), conflicts: current.conflicts.filter(c => c.path !== conflict.path) }))}>Use my draft: {JSON.stringify(conflict.local) ?? 'Deleted'}</button>
        <button type="button" onClick={() => setReview(current => ({ ...current, value: resolveDraftField(current.value, conflict.keys, conflict.remote), conflicts: current.conflicts.filter(c => c.path !== conflict.path) }))}>Use published: {JSON.stringify(conflict.remote) ?? 'Deleted'}</button>
      </fieldset>)}
      <div className="apw-comparison"><div><h4>Published</h4><pre>{JSON.stringify(review.before, null, 2)}</pre></div><div><h4>Proposed</h4><pre>{JSON.stringify(review.value, null, 2)}</pre></div></div>
      <label>Publish later (IST, optional)<input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} /></label>
      {domain === 'schedule' && <fieldset><legend>Notify affected students</legend>
        <label><input type="checkbox" checked={notify} onChange={e => { setNotify(e.target.checked); setAudience(null); }} />Queue an optional timetable update with this publication</label>
        <p>Existing automatic cancellation alerts remain active. Only verified enrollment matches in the server timetable are included. Scheduled publications resolve the eligible cohort at execution and record the final count.</p>
        {notify && <><label>Additional note (optional; session details are always included)<textarea maxLength={500} value={noticeMessage} onChange={e => { setNoticeMessage(e.target.value); setAudience(null); }} /></label>
          <button type="button" disabled={busy || review.conflicts.length > 0} onClick={() => run(async () => setAudience(await previewScheduleNotices(review.value, review.revision, noticeMessage)))}>Preview affected audience</button>
          {audience && <div><p role="status">{audience.students} students · {audience.push_subscribers} with a push subscription · {audience.notifications} potential inbox entries. Preferences and expiry can reduce push delivery.</p>{audience.classes.map((item,index) => {
            const copy = item.copy || scheduleNoticeCopy({ code: item.effective.code || item.key, date: item.date, before: item.before, effective: item.effective, note: noticeMessage });
            return <details key={index}><summary>{item.date} · {item.key} · Preview message</summary><PushPreview {...copy} type={item.effective.type === 'cancelled' ? 'class_cancelled' : 'schedule_change'} data={{ date: item.date }} /></details>;
          })}</div>}
        </>}
      </fieldset>}
      <button type="button" className="admin-btn" disabled={busy || review.conflicts.length > 0 || !allowed} onClick={publish}>{busy ? 'Working…' : at ? 'Schedule reviewed area' : 'Publish reviewed area'}</button>
      <button type="button" className="admin-btn outline" onClick={() => setReview(null)}>Keep editing</button>
    </div>}
    <details><summary>Publication history and restore</summary>{versions.length === 0 && <p>No versions available.</p>}{versions.map(version => <p key={version.revision}>v{version.revision} · {new Date(version.created_at).toLocaleString()} · {version.created_by} <button type="button" disabled={!allowed || busy} onClick={() => { setRestore(version.payload); setReview(null); setMessage(`Version ${version.revision} staged. Review before publishing as a new revision.`); }}>Stage restore</button></p>)}</details>
  </section>;
}

