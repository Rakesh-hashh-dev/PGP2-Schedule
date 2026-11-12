import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Database, Download, FileSearch, Filter, Loader2, Search, ShieldCheck, X } from 'lucide-react';
import { downloadAdminCsv, searchAdminData, loadPublicationVersion } from '../lib/adminOperationalSearch.js';
import { hasAdminCapability } from '../lib/adminCapabilities.js';
import { loadAdminWorkspacePrefs, saveAdminWorkspacePrefs } from '../lib/adminWorkspacePrefs.js';
import { ADMIN_SEARCH_DATASETS as DATASETS, adminSearchRange, buildAdminSearchFilter, adminRecordTime } from '../lib/adminSearchView.js';
import '../styles/admin-record-search.css';

const labelFor = key => key.replaceAll('_', ' ').replace(/^./, text => text.toUpperCase());
function RecordFields({ data }) {
  return <dl className="ars-fields">{Object.entries(data || {}).map(([key, value]) => <div key={key}><dt>{labelFor(key)}</dt><dd>{value == null ? <span className="ars-null">Not recorded</span> : typeof value === 'object' ? <pre>{JSON.stringify(value,null,2)}</pre> : String(value)}</dd></div>)}</dl>;
}

export default function AdminHistoryExplorer({ role, initialDataset = 'audit', requestedDataset, onInspect, userId, workspace = 'database' }) {
  const allowed = Object.entries(DATASETS).filter(([, value]) => hasAdminCapability(role, value.capability));
  const [initial] = useState(() => {
    const prefs = loadAdminWorkspacePrefs(userId).filters;
    const dataset = allowed.some(([key]) => key === requestedDataset) ? requestedDataset : allowed.some(([key]) => key === prefs.dataset) ? prefs.dataset : allowed.some(([key]) => key === initialDataset) ? initialDataset : allowed[0]?.[0];
    const range = { ...adminSearchRange(), from: prefs.from || adminSearchRange().from, to: prefs.to || adminSearchRange().to };
    try { buildAdminSearchFilter({ dataset, ...range }); } catch { Object.assign(range, adminSearchRange()); }
    return { dataset, ...range, query: '', status: '', actor: '' };
  });
  const [draft, setDraft] = useState(initial);
  const [filter, setFilter] = useState(() => initial.dataset ? buildAdminSearchFilter(initial) : null);
  const [appliedDates, setAppliedDates] = useState({ from: initial.from, to: initial.to });
  const [cursors, setCursors] = useState([null]);
  const [response, setResponse] = useState(null);
  const [validation, setValidation] = useState('');
  const [exporting, setExporting] = useState(false), [exportMessage, setExportMessage] = useState('');
  const [versions, setVersions] = useState({});
  const cursor = cursors.at(-1);
  const loading = !!filter && (response?.filter !== filter || response?.cursor !== cursor);
  const result = !loading ? response?.data : null;
  const searchError = !loading ? response?.error : '';
  const meta = DATASETS[draft.dataset];
  let changed;
  try { changed = JSON.stringify(buildAdminSearchFilter(draft)) !== JSON.stringify(filter); } catch { changed = true; }

  useEffect(() => {
    if (!filter || !hasAdminCapability(role, DATASETS[filter.dataset].capability)) return;
    let active = true;
    searchAdminData({ ...filter, cursor }).then(data => { if (active) setResponse({ filter, cursor, data }); })
      .catch(error => { if (active) setResponse({ filter, cursor, error: error.message }); });
    return () => { active = false; };
  }, [filter, cursor, role]);

  const update = patch => { setDraft(current => ({ ...current, ...patch })); setValidation(''); };
  const search = event => {
    event.preventDefault();
    try {
      const next = buildAdminSearchFilter(draft);
      if (!hasAdminCapability(role, DATASETS[next.dataset].capability)) throw new Error('Your role cannot search this record type.');
      const prefs = loadAdminWorkspacePrefs(userId);
      saveAdminWorkspacePrefs(userId, { ...prefs, filters: { ...prefs.filters, dataset: draft.dataset, from: draft.from, to: draft.to } });
      setValidation(''); setExportMessage(''); setFilter(next); setAppliedDates({ from: draft.from, to: draft.to }); setCursors([null]);
    } catch (error) { setValidation(error.message); }
  };
  const exportData = async () => {
    setExporting(true); setExportMessage('');
    try {
      const data = await searchAdminData({ ...filter, exportRows: true });
      downloadAdminCsv(`admin-${filter.dataset}`, data.rows.map(row => row.data));
      setExportMessage(data.has_more ? 'Downloaded the newest 1,000 matches. Narrow the date range to export more.' : `Downloaded ${data.rows.length} matching records.`);
    } catch (error) { setExportMessage(`Export failed: ${error.message}`); }
    finally { setExporting(false); }
  };
  const inspectVersion = async row => {
    setVersions(current => ({ ...current, [row.key]: { loading: true } }));
    try { const data = await loadPublicationVersion(row.data.id); setVersions(current => ({ ...current, [row.key]: { data } })); }
    catch (error) { setVersions(current => ({ ...current, [row.key]: { error: error.message } })); }
  };

  return <section className={`admin-card admin-span-all admin-g-${workspace} ars-panel`} aria-label="Search admin records">
    <header className="ars-header"><span className="ars-heading-icon"><FileSearch size={23} aria-hidden="true" /></span><div><span className="ars-eyebrow">Records explorer</span><h2>Search admin records</h2><p>Find activity, feedback, students and published changes.</p></div><span className="ars-access"><ShieldCheck size={13} aria-hidden="true" />Role-based access</span></header>
    {!allowed.length ? <p className="ars-empty">Your role has no searchable record types.</p> : <>
      <form className="ars-form" onSubmit={search}>
        <div className="ars-search-row"><label className="ars-dataset">Record type<select value={draft.dataset} onChange={event => update({ dataset: event.target.value, status: '', actor: '' })}>{allowed.map(([key,value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
          <label className="ars-query">Search records<span className="ars-input-wrap"><Search size={16} aria-hidden="true" /><input value={draft.query} maxLength={200} placeholder={meta?.placeholder} onChange={event => update({ query: event.target.value })} />{draft.query && <button type="button" aria-label="Clear search text" onClick={() => update({ query: '' })}><X size={14} /></button>}</span></label>
          <button className="ars-search-button" type="submit" disabled={loading}><Search size={15} aria-hidden="true" />{loading ? 'Searching…' : 'Search records'}</button>
        </div>
        <div className="ars-filter-row"><label>From · IST<input type="date" required value={draft.from} onChange={event => update({ from: event.target.value })} /></label><label>To · IST<input type="date" required value={draft.to} onChange={event => update({ to: event.target.value })} /></label>
          <div className="ars-presets" role="group" aria-label="Quick date ranges"><span>Date range</span><div>{[7,30,90].map(days => { const range = adminSearchRange(days); return <button type="button" key={days} aria-pressed={draft.from === range.from && draft.to === range.to} onClick={() => update(range)}>{days} days</button>; })}</div></div>
          {draft.dataset === 'feedback' && <label>Status<input value={draft.status} placeholder="Any status" onChange={event => update({ status: event.target.value })} /></label>}
          {['audit','versions'].includes(draft.dataset) && <label>Administrator ID<input value={draft.actor} placeholder="Any administrator" onChange={event => update({ actor: event.target.value })} /></label>}
        </div>
        <div className="ars-filter-help"><p><Filter size={13} aria-hidden="true" />{meta?.hint}</p>{changed && <span>Filters changed · search to apply</span>}</div>
        {validation && <p className="ars-alert" role="alert"><AlertCircle size={15} aria-hidden="true" />{validation}</p>}
      </form>

      <div className="ars-results-heading"><div><h3>{filter && DATASETS[filter.dataset].label}<span>{result ? result.total.toLocaleString('en-IN') : '—'}</span></h3><p>{appliedDates.from} – {appliedDates.to} · IST{filter?.query && ` · “${filter.query}”`}{filter?.status && ` · Status: ${filter.status}`}{filter?.actor && ` · Admin: ${filter.actor}`}</p></div>
        <button type="button" className="ars-export" disabled={exporting || loading || !result?.total} onClick={exportData} title="Download up to 1,000 matching records as CSV"><Download size={14} aria-hidden="true" />{exporting ? 'Exporting…' : 'Export results'}</button>
      </div>
      {exportMessage && <p className="ars-export-message" role="status">{exportMessage}</p>}
      {loading && <div className="ars-loading" role="status"><Loader2 size={21} aria-hidden="true" /><strong>Searching records…</strong><span>Applying your filters to the selected record type.</span></div>}
      {searchError && <div className="ars-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><strong>Records could not load</strong><p>{searchError}</p><button type="button" onClick={() => setFilter(current => ({ ...current }))}>Try again</button></div></div>}
      {result && (result.rows.length === 0 ? <div className="ars-empty"><Search size={26} aria-hidden="true" /><strong>No matching records</strong><p>Try a broader date range or fewer filters, then search again.</p><button type="button" onClick={() => update({ ...adminSearchRange(), query: '', status: '', actor: '' })}>Reset filters</button></div> : <>
        <div className="ars-result-list" role="region" aria-label="Search results" tabIndex={0}>{result.rows.map(row => {
          const data = row.data, title = data.action ? labelFor(data.action) : data.name || data.message || data.title || (data.domain ? `${labelFor(data.domain)} · Revision ${data.revision}` : data.type ? labelFor(data.type) : data.user_id || data.id || row.key);
          const secondary = data.admin_id ? `Admin · ${data.admin_id}` : data.created_by ? `Published by · ${data.created_by}` : data.email || (data.user_id ? `Student · ${data.user_id}` : row.key);
          const version = versions[row.key];
          return <details className="ars-record" key={`${filter.dataset}:${row.key}`}><summary><span className="ars-record-icon"><Database size={15} aria-hidden="true" /></span><span className="ars-record-copy"><strong>{title}</strong><small>{secondary}</small></span><span className="ars-record-meta">{(data.status || data.push_delivery_state) && <span className="ars-badge">{labelFor(data.status || data.push_delivery_state)}</span>}<time dateTime={row.at}>{adminRecordTime(row.at)}</time></span><ChevronDown className="ars-chevron" size={15} aria-hidden="true" /></summary>
            <div className="ars-record-body"><RecordFields data={data} />
              {(filter.dataset === 'versions' || (data.user_id && onInspect)) && <div className="ars-record-actions">
                {filter.dataset === 'versions' && <button type="button" disabled={version?.loading} onClick={() => inspectVersion(row)}><FileSearch size={14} aria-hidden="true" />{version?.loading ? 'Loading settings…' : version?.error ? 'Retry published settings' : 'Inspect published settings'}</button>}
                {data.user_id && onInspect && <button type="button" onClick={() => onInspect(data.user_id)}>Inspect student<ArrowRight size={14} aria-hidden="true" /></button>}
              </div>}
              {version?.error && <p className="ars-alert" role="alert">{version.error}</p>}{version?.data && <div className="ars-version"><h4><Check size={14} aria-hidden="true" />Published settings</h4><pre>{JSON.stringify(version.data.payload,null,2)}</pre></div>}
            </div>
          </details>;
        })}</div>
        <div className="ars-pagination"><span>Page {cursors.length} · {(cursors.length - 1) * 50 + 1}–{(cursors.length - 1) * 50 + result.rows.length} of {result.total.toLocaleString('en-IN')}</span><div><button type="button" disabled={cursors.length === 1} onClick={() => setCursors(previous => previous.slice(0,-1))}><ArrowLeft size={14} aria-hidden="true" />Previous</button><button type="button" disabled={!result.has_more} onClick={() => setCursors(previous => [...previous,result.rows.at(-1)])}>Next<ArrowRight size={14} aria-hidden="true" /></button></div></div>
      </>)}
      <footer className="ars-footer"><span><ShieldCheck size={13} aria-hidden="true" />Only fields available to your role are returned.</span><span>50 per page · CSV exports up to 1,000 matches</span></footer>
    </>}
  </section>;
}
