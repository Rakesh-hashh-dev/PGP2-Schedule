import { RefreshCw, Save, FolderOpen, ArrowUpRight, History, RotateCcw, CheckCircle2, AlertCircle, ShieldCheck, Loader2, GitCompareArrows } from 'lucide-react';
import { ControlHero } from './AdminControlVisuals.jsx';
import { useState } from 'react';
import { useAppControls, refreshControls, saveControlDraft, publishControls } from '../lib/appControls.js';
import { useAdminControlHistory } from '../hooks/useAdminControlHistory.js';
import { DEFAULT_CONTROLS, validateControls } from '../lib/controlsSchema.js';
import '../styles/admin-mess-controls.css';

function changes(before, after, prefix = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(k => changes(before[k], after[k], prefix ? `${prefix} / ${k}` : k));
  }
  const display = value => value === undefined ? 'Source/default' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return [{ field: prefix, before: display(before), after: display(after) }];
}
export default function AdminControlsPublish({ section, title, readOnly, children }) {
  const controls = useAppControls();
  const [value, setValue] = useState(() => structuredClone(controls.payload[section]));
  const [base, setBase] = useState(controls.revision);
  const [original, setOriginal] = useState(() => structuredClone(controls.payload[section]));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [review, setReview] = useState(false);
  const { versions, draft, setDraft, error: historyError, reload: reloadHistory } = useAdminControlHistory(section);
  if (controls.loaded && !ready) {
    setValue(structuredClone(controls.payload[section])); setOriginal(structuredClone(controls.payload[section])); setBase(controls.revision); setReady(true);
  }
  const changed = JSON.stringify(original) !== JSON.stringify(value);
  const stale = base !== controls.revision;
  const run = async action => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e.message || 'Action failed.'); } finally { setBusy(false); }
  };
  const reload = () => run(async () => {
    const current = await refreshControls(); if (current.error) throw new Error(current.error);
    setValue(structuredClone(current.payload[section])); setOriginal(structuredClone(current.payload[section])); setBase(current.revision); setReview(false);
    const metadata = await reloadHistory();
    setMessage(metadata?.error ? 'Published settings loaded. Draft/history will retry automatically.' : 'Published settings and draft/history refreshed.');
  });
  const publish = () => run(async () => {
    const revision = await publishControls(section, value, base);
    setBase(revision); setOriginal(structuredClone(value)); setReview(false); setDraft(null); setMessage(`Published revision ${revision}.`);
    await reloadHistory();
  });
  return <section className={`admin-controls-panel ac-panel--${section}`}>
    <ControlHero section={section} title={title} changed={changed} revision={base} />
    {!ready && <p role="status">Loading published settings…</p>}
    {controls.error && <p className="admin-controls-error" role="alert"><AlertCircle size={17} aria-hidden="true" />Published settings unavailable: {controls.error}. Apply the app controls migration before using these controls.</p>}
    {stale && <p className="admin-controls-error" role="alert"><AlertCircle size={17} aria-hidden="true" />A newer revision is available. Reload published settings before publishing. Save your draft first if needed.</p>}
    {error && <p className="admin-controls-error" role="alert"><AlertCircle size={17} aria-hidden="true" />{error}</p>}
    {historyError && <div className="admin-controls-error" role="alert"><AlertCircle size={17} aria-hidden="true" /><span>{historyError}<br /><small>Retrying automatically. Your unsaved changes are preserved.</small></span><button type="button" className="admin-btn outline" disabled={busy} onClick={() => run(() => reloadHistory())}><RefreshCw size={14} />Retry</button></div>}
    {message && <p role="status" className="admin-controls-success"><CheckCircle2 size={17} aria-hidden="true" />{message}</p>}
    {readOnly && <p className="ac-monitor-note"><ShieldCheck size={16} />You have read-only Monitor access.</p>}
    <fieldset disabled={!ready || readOnly || busy || !!controls.error} className="admin-controls-fields">
      {children({ value, setValue: next => { setValue(next); setReview(false); }, busy, run, setMessage })}
    </fieldset>
    <div className="admin-controls-actions ac-publish-toolbar"><span className="ac-toolbar-caption"><ShieldCheck size={15} />{changed ? "Your changes stay private until published" : "All changes reviewed before publishing"}</span>
      <button type="button" className="admin-btn outline" disabled={busy} onClick={reload}><RefreshCw size={15} className={busy ? "ac-spin" : ""} />Reload</button>
      <button type="button" className="admin-btn outline" disabled={readOnly || busy || !ready || !!controls.error} onClick={() => run(async () => { await saveControlDraft(section, value, base); setDraft({ payload: structuredClone(value), base_revision: base }); setMessage('Private draft saved. Students still see the published settings.'); })}><Save size={15} />Save draft</button>
      {draft && <button type="button" className="admin-btn outline" disabled={readOnly || busy} onClick={() => { setValue(structuredClone(validateControls(section, draft.payload))); setBase(draft.base_revision); setReview(false); setMessage('Draft loaded. Review against the published settings.'); }}><FolderOpen size={15} />Load saved draft</button>}
      <button type="button" className="admin-btn" disabled={readOnly || busy || !ready || !!controls.error || stale || !changed} onClick={() => run(async () => { validateControls(section, value); setReview(true); })}><GitCompareArrows size={16} />Review changes<ArrowUpRight size={14} /></button>
    </div>
    {review && <div className="admin-controls-review"><h3><GitCompareArrows size={19} />Review your changes</h3><p>Compare the published settings with your proposal before making it live.</p><div className="admin-controls-table"><table><thead><tr><th>Setting</th><th>Published</th><th>Proposed</th></tr></thead><tbody>{changes(original, value).map(c => <tr key={c.field}><th>{c.field}</th><td>{c.before}</td><td>{c.after}</td></tr>)}</tbody></table></div><button type="button" className="admin-btn" disabled={readOnly || busy || stale || !!controls.error} onClick={publish}>{busy ? <Loader2 size={15} className="ac-spin" /> : <CheckCircle2 size={15} />}{busy ? 'Publishing…' : 'Publish reviewed changes'}</button><button type="button" className="admin-btn outline" onClick={() => setReview(false)}>Keep editing</button></div>}
    <details className="admin-controls-history"><summary><History size={17} /><span>Revision history & restore<small>Return to a previous configuration</small></span><RotateCcw size={15} /></summary><p>Restoring stages a previous section. Review and publish it as a new revision.</p><button type="button" className="admin-btn outline" disabled={readOnly || busy} onClick={() => { setValue(structuredClone(DEFAULT_CONTROLS[section])); setReview(false); }}><RotateCcw size={14} />Stage original defaults</button>{versions.length === 0 && <div className="ac-history-empty"><History size={25} /><p>Your publication history will appear here.<small>Each published update creates a restorable revision.</small></p></div>}{versions.map(v => <div className="admin-controls-version" key={v.revision}><span>v{v.revision} · {new Date(v.created_at).toLocaleString()} · {v.created_by}</span><button type="button" className="admin-btn outline" disabled={readOnly || busy} onClick={() => { setValue(structuredClone(validateControls(section, v.payload[section] || {}))); setReview(false); setMessage(`Revision ${v.revision} staged for review.`); }}><RotateCcw size={13} />Stage this version</button></div>)}</details>
  </section>;
}
