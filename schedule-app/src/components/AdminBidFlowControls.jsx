
import { useRef, useState } from 'react';
import { Layers, FileSpreadsheet, Eye, Save, RefreshCw, Trash2, CheckCircle2, CircleAlert, Loader2 } from 'lucide-react';
import { publishControls, refreshControls, useAppControls } from '../lib/appControls.js';
import { validateControls } from '../lib/controlsSchema.js';
import { fetchLiveSheetCourses, parseExcelBuffer, parseCSVText } from '../lib/bidflowFeed.js';
import { bidflowCourseKey, officialCourseCode, termKey } from '../lib/bidflowPlan.js';
import { hasAdminCapability, isKnownAdminRole } from '../lib/adminCapabilities.js';
import { ROLE_LABELS } from '../lib/adminRoles.js';
import BidFlowModal from './BidFlowModal.jsx';
import '../styles/bidflow.css';

export default function AdminBidFlowControls({ role, onReloadAccess }) {
  const controls = useAppControls();
  const [draft, setDraft] = useState(null);
  const [draftBase, setDraftBase] = useState(null);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const catalogRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const live = controls.payload.bidflow;
  const value = draft || live;
  const { courses, termCreditRanges } = value;
  const rangeTerms = [...new Set([...courses.map(course => termKey(course.term || value.term)), ...Object.keys(termCreditRanges)])].sort();
  const roleKnown = isKnownAdminRole(role);
  const canPublish = hasAdminCapability(role, 'schedule.publish');
  const locked = (roleKnown && !canPublish) || Boolean(busy);
  const publishReady = controls.loaded && !controls.error;
  const stale = Boolean(draftBase && (draftBase.updatedAt !== live.updatedAt ||
    (draftBase.revision !== null && draftBase.revision !== controls.revision)));
  const query = search.trim().toLowerCase();
  const visible = courses.filter(course => [course.code, course.name, course.area].some(item => item.toLowerCase().includes(query)));

  function edit(changes) {
    if (!draft) setDraftBase({
      updatedAt: live.updatedAt,
      revision: publishReady ? controls.revision : null,
    });
    setDraft(current => ({ ...(current || live), ...changes }));
    setFeedback(null);
  }

  function setTermRange(term, key, amount) {
    const range = { min: value.minCredits, max: value.maxCredits, ...termCreditRanges[term], [key]: amount };
    edit({ termCreditRanges: { ...termCreditRanges, [term]: range } });
  }

  async function importCourses(read, source) {
    if (locked) return;
    setBusy('import');
    setImportStatus({ state: 'reading', source });
    try {
      const imported = await read();
      const { courses: normalized } = validateControls('bidflow', { term: value.term.trim() || live.term, courses: imported });
      edit({ courses: normalized });
      setSearch('');
      setImportStatus({ state: 'success', source, count: normalized.length, usesCatalogIds: normalized.some(course => !officialCourseCode(course.code)) });
    } catch (error) {
      setImportStatus({ state: 'error', source, detail: error.message || 'Check the file format and try again.' });
    } finally {
      setBusy('');
    }
  }

  async function publish() {
    if (!canPublish || locked || !publishReady || stale || !draft) return;
    setBusy('publish');
    setFeedback(null);
    try {
      const payload = { ...value, sheetUrl: '', updatedAt: new Date().toISOString() };
      await publishControls('bidflow', payload, draftBase?.revision ?? controls.revision);
      setDraft(null);
      setDraftBase(null);
      setImportStatus(null);
      setFeedback({ text: payload.enabled ? 'Catalog is now visible to students.' : 'BidFlow is now hidden from students.' });
    } catch (error) {
      const message = error.code === 'PGRST202'
        ? 'This server does not have the BidFlow publishing endpoint yet.'
        : error.message || 'Publishing failed.';
      setFeedback({ error: true, text: message });
    } finally {
      setBusy('');
    }
  }

  async function reload() {
    if (draft && !window.confirm('Discard this BidFlow draft and load published settings?')) return;
    setBusy('reload');
    const current = await refreshControls();
    if (!current.error) {
      setDraft(null);
      setDraftBase(null);
      setImportStatus(null);
    }
    setFeedback(current.error ? { error: true, text: current.error } : null);
    setBusy('');
  }

  function openPreview() {
    try {
      setPreview(validateControls('bidflow', { ...value, enabled: false }));
    } catch (error) {
      setFeedback({ error: true, text: error.message });
    }
  }

  function restoreBrowserCatalog() {
    try {
      const previous = JSON.parse(localStorage.getItem('pgp2.controls-bidflow') || 'null');
      const restored = validateControls('bidflow', { ...previous, enabled: false });
      edit(restored);
      setImportStatus(null);
      setSourceUrl(restored.sheetUrl);
      setFeedback({ text: 'Previous browser settings loaded as a draft. Review the catalog before making it visible.' });
    } catch (error) {
      setFeedback({ error: true, text: error.message });
    }
  }

  let hasLegacyCatalog = false;
  try { hasLegacyCatalog = Boolean(localStorage.getItem('pgp2.controls-bidflow')); } catch { /* Storage is optional. */ }

  return (
    <section className="admin-controls-panel admin-span-all bf-admin" aria-label="BidFlow catalog">
      <header className="bf-admin-head">
        <div className="bf-brand"><Layers size={22} aria-hidden="true" /></div>
        <div className="bf-admin-heading">
          <h2>BidFlow catalog</h2>
          <p><span className="bf-admin-status" data-live={live.enabled}>{live.enabled ? 'Visible to students' : 'Hidden from students'}</span>{live.courses.length} published electives</p>
          <p>Database role: {roleKnown ? ROLE_LABELS[role] : role === null ? 'No admin role assigned' : 'Unverified'}</p>
        </div>
        <div className="bf-admin-actions">
          <button className="admin-btn outline" type="button" disabled={Boolean(busy)} onClick={openPreview}><Eye size={16} /> Student preview</button>
          <button className="admin-btn" type="button" disabled={!canPublish || locked || !publishReady || stale || !draft} onClick={publish}><Save size={16} /> {busy === 'publish' ? 'Publishing…' : 'Publish catalog'}</button>
        </div>
      </header>

      {!canPublish && <div className="bf-notice" role="status">
        <span>{roleKnown ? 'Publishing and editing require the Schedule Editor or Superadmin role.' : 'You can prepare a draft here. Publishing requires a verified Schedule Editor or Superadmin role.'}</span>
        {!roleKnown && onReloadAccess && <button className="bf-quiet" type="button" onClick={onReloadAccess}>Check access again</button>}
      </div>}
      {!controls.loaded && <p className="bf-notice" role="status">Checking the published catalog…</p>}
      {controls.error && <p className="bf-notice" data-status="error">Published settings could not be refreshed. {controls.error}</p>}
      {stale && <p className="bf-notice">Published settings changed while you were editing. Copy any edits you need before reloading.</p>}
      {feedback && <p className="bf-notice" data-status={feedback.error ? "error" : "success"} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
      <div className="bf-admin-toolbar">
        {draft && <span className="bf-admin-status" data-draft="true">Unpublished changes</span>}
        <button className="admin-btn outline" type="button" disabled={Boolean(busy)} onClick={reload}><RefreshCw size={15} /> {draft ? 'Discard and reload' : 'Reload published'}</button>
        {hasLegacyCatalog && !draft && <button className="admin-btn outline" type="button" disabled={locked} onClick={restoreBrowserCatalog}>Recover previous browser settings</button>}
      </div>

      <div className="bf-admin-grid">
        <fieldset disabled={locked}>
          <legend>Planner settings</legend>
          <div className="bf-admin-fields">
            <label>Cohort<input value={value.cohort} maxLength={40} onChange={event => edit({ cohort: event.target.value })} /></label>
            <label>Default term<input value={value.term} maxLength={40} onChange={event => edit({ term: event.target.value })} /></label>
            <label>Minimum credits per term<input type="number" min="0" step="0.1" value={value.minCredits} onChange={event => edit({ minCredits: Number(event.target.value) })} /></label>
            <label>Maximum credits per term<input type="number" min="0.1" step="0.1" value={value.maxCredits} onChange={event => edit({ maxCredits: Number(event.target.value) })} /></label>
            <label>Overall minimum<input type="number" min="0" step="0.1" placeholder="Optional" value={value.totalMinCredits ?? ''} onChange={event => edit({ totalMinCredits: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            <label>Overall maximum<input type="number" min="0.1" step="0.1" placeholder="Optional" value={value.totalMaxCredits ?? ''} onChange={event => edit({ totalMaxCredits: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            {!!rangeTerms.length && <details className="bf-wide bf-term-settings">
              <summary>Set different limits by term</summary>
              {rangeTerms.map(term => <div key={term}>
                <strong>{term}</strong>
                <label>Minimum<input type="number" min="0" step="0.1" aria-label={term + ' minimum credits'} placeholder={String(value.minCredits)} value={termCreditRanges[term]?.min ?? ''} onChange={event => setTermRange(term, 'min', Number(event.target.value))} /></label>
                <label>Maximum<input type="number" min="0.1" step="0.1" aria-label={term + ' maximum credits'} placeholder={String(value.maxCredits)} value={termCreditRanges[term]?.max ?? ''} onChange={event => setTermRange(term, 'max', Number(event.target.value))} /></label>
                <button type="button" className="bf-quiet" disabled={!termCreditRanges[term]} onClick={() => {
                  const ranges = { ...termCreditRanges };
                  delete ranges[term];
                  edit({ termCreditRanges: ranges });
                }}>Use default</button>
              </div>)}
            </details>}
            <label className="bf-wide">Rules for students<textarea value={value.rulesText} maxLength={2000} rows={3} onChange={event => edit({ rulesText: event.target.value })} /></label>
            <label className="bf-checkbox bf-wide"><input type="checkbox" checked={value.enabled} onChange={event => edit({ enabled: event.target.checked })} /> Show BidFlow to students</label>
          </div>
        </fieldset>

        <fieldset disabled={locked}>
          <legend>Import electives</legend>
          <p>Import CSV, TSV or Excel with Course Name and Credits columns. Include Course Code to match electives to the timetable.</p>
          <label>Google Sheets, Apps Script or CSV URL<input type="url" value={sourceUrl} placeholder="https://…" onChange={event => setSourceUrl(event.target.value)} /></label>
          <div className="bf-admin-actions">
            <button className="admin-btn outline" type="button" disabled={!sourceUrl.trim()} onClick={() => importCourses(() => fetchLiveSheetCourses(sourceUrl), 'the feed')}><FileSpreadsheet size={16} /> Import from URL</button>
          </div>
          <label className="bf-file-label">Import file
            <input className="bf-file-input" type="file" accept=".csv,.tsv,.xlsx,.xls,.xlsm"
              onClick={event => { event.currentTarget.value = ''; }}
              onChange={event => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                void importCourses(async () => /\.(?:csv|tsv)$/i.test(file.name)
                  ? parseCSVText(await file.text()) : parseExcelBuffer(await file.arrayBuffer()), file.name);
              }} />
          </label>
          {importStatus ? <div className="bf-import-status bf-notice" data-status={importStatus.state}
              role={importStatus.state === 'error' ? 'alert' : 'status'}>
            {importStatus.state === 'reading' ? <>
              <Loader2 size={17} aria-hidden="true" /><div><strong>Reading {importStatus.source}…</strong></div>
            </> : importStatus.state === 'error' ? <>
              <CircleAlert size={17} aria-hidden="true" />
              <div><strong>Could not import {importStatus.source}</strong><p>{importStatus.detail}</p></div>
            </> : <>
              <CheckCircle2 size={17} aria-hidden="true" />
              <div>
                <strong>{importStatus.count} {importStatus.count === 1 ? 'elective' : 'electives'} imported</strong>
                <p>{importStatus.source} was read into the draft. Use Publish catalog when it’s ready for students.</p>
                {importStatus.usesCatalogIds && <p>Courses without official codes can be planned and exported. Timetable setup needs official course codes.</p>}
                <button type="button" className="bf-quiet" onClick={() => {
                  catalogRef.current?.scrollIntoView({ block: 'start' });
                  catalogRef.current?.focus({ preventScroll: true });
                }}>View draft catalog</button>
              </div>
            </>}
          </div> : <p>Each import replaces the draft catalog. Blank term cells use the default term.</p>}

        </fieldset>
      </div>

      <section className="bf-admin-catalog" aria-label="Draft catalog courses" ref={catalogRef} tabIndex={-1}>
        <div className="bf-admin-toolbar"><h3>Electives <span>{courses.length}</span></h3><input type="search" aria-label="Search catalog" placeholder="Search catalog" value={search} onChange={event => setSearch(event.target.value)} /></div>
        {visible.length ? <ul>{visible.map(course => <li key={bidflowCourseKey(course, value.term)}>
          <div><strong>{course.name}</strong><small>{[officialCourseCode(course.code), course.term || value.term, course.area, course.faculty, course.facultyType].filter(Boolean).join(' · ')}</small></div>
          <span>{course.credits} cr</span>
          <button type="button" className="bf-icon" disabled={locked} aria-label={'Remove ' + (officialCourseCode(course.code) || course.name)} onClick={() => edit({ courses: courses.filter(item => item !== course) })}><Trash2 size={16} /></button>
        </li>)}</ul> : <p className="bf-empty">{courses.length ? 'No electives match your search.' : 'Import a catalog to add electives.'}</p>}
      </section>
      {preview && <BidFlowModal config={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}
