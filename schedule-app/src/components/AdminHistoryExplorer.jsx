import { useEffect, useState } from 'react';
import { downloadAdminCsv, searchAdminData,loadPublicationVersion } from '../lib/adminOperationalSearch.js';
import { hasAdminCapability } from '../lib/adminCapabilities.js';
import { loadAdminWorkspacePrefs,saveAdminWorkspacePrefs } from '../lib/adminWorkspacePrefs.js';
const NOW = new Date(), FROM = new Date(Date.now() - 29 * 86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}), TO = NOW.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const DATASETS = { audit: ['Audit log','diagnostics.read'], feedback: ['Feedback','support.read'], versions: ['Publication versions','admin.read'], students: ['Student directory','support.read'], notifications: ['Notification metadata','diagnostics.read'] };
export default function AdminHistoryExplorer({ role, initialDataset = 'audit', onInspect, userId,workspace='database' }) {
  const [preferences]=useState(()=>loadAdminWorkspacePrefs(userId));
  const initial=preferences.filters.dataset && hasAdminCapability(role,DATASETS[preferences.filters.dataset][1]) ? preferences.filters.dataset : initialDataset;
  const initialFrom=preferences.filters.from || FROM, initialTo=preferences.filters.to || TO;
  const [dataset, setDataset] = useState(initial), [query, setQuery] = useState(''), [from, setFrom] = useState(initialFrom), [to, setTo] = useState(initialTo), [status, setStatus] = useState(''), [actor, setActor] = useState('');
  const [filter, setFilter] = useState({ dataset: initial, query: '', from: `${initialFrom}T00:00:00+05:30`, to: new Date(new Date(`${initialTo}T00:00:00+05:30`).getTime() + 86400000).toISOString() });
  const [cursors, setCursors] = useState([null]), [result, setResult] = useState(null), [error, setError] = useState(''), [exporting, setExporting] = useState(false);
  const [versionDetails,setVersionDetails]=useState({});
  const cursor = cursors.at(-1);
  useEffect(() => {
    let active = true;
    searchAdminData({ ...filter, cursor }).then(data => { if (active) { setResult(data); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [filter, cursor]);
  const search = event => {
    event.preventDefault();
    const prefs=loadAdminWorkspacePrefs(userId); saveAdminWorkspacePrefs(userId,{...prefs,filters:{...prefs.filters,dataset,from,to}});
    setFilter({ dataset, query, status, actor, from: new Date(`${from}T00:00:00+05:30`).toISOString(), to: new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86400000).toISOString() });
    setCursors([null]); setResult(null);
  };
  const exportData = async () => {
    setExporting(true); setError('');
    try {
      const data = await searchAdminData({ ...filter, exportRows: true });
      downloadAdminCsv(`admin-${filter.dataset}`, data.rows.map(row => row.data));
      if (data.has_more) setError('Export contains the newest 1,000 matching rows. Narrow the filters to export another range.');
    } catch (e) { setError(e.message); } finally { setExporting(false); }
  };
  return <section className={`admin-card admin-ops-panel admin-span-all admin-g-${workspace}`} aria-label="Searchable admin records" style={{ minWidth: 0 }}><h2>Search admin records</h2>
    <p>Server-side search with authorized fields. Pages contain up to 50 rows. Student time filters use last activity; students without recorded activity are included.</p>
    <form onSubmit={search} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <label>Dataset<select value={dataset} onChange={e => setDataset(e.target.value)}>{Object.entries(DATASETS).filter(([,value]) => hasAdminCapability(role,value[1])).map(([key,value]) => <option key={key} value={key}>{value[0]}</option>)}</select></label>
      <label>Search<input value={query} maxLength={200} onChange={e => setQuery(e.target.value)} /></label><label>From (IST)<input type="date" required value={from} onChange={e => setFrom(e.target.value)} /></label><label>To (IST)<input type="date" required value={to} onChange={e => setTo(e.target.value)} /></label>
      <label>Status (feedback)<input value={status} onChange={e => setStatus(e.target.value)} /></label><label>Actor ID (audit/versions)<input value={actor} onChange={e => setActor(e.target.value)} /></label><button type="submit">Search / refresh</button>
    </form>
    {error && <p role="alert">{error}</p>}{!result && !error && <p role="status">Loading records…</p>}
    {result && <><p>{result.total} matching records · showing {result.rows.length}</p><button type="button" disabled={exporting || !result.total} onClick={exportData}>Export filtered records (maximum 1,000)</button>
      {result.rows.map(row => <details key={row.key}><summary>{row.data.action || row.data.name || row.data.domain || row.data.type || row.data.id || row.key} · {row.at === '1970-01-01T00:00:00+00:00' ? 'No recorded activity' : new Date(row.at).toLocaleString()}</summary>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(row.data,null,2)}</pre>
        {filter.dataset==='versions'&&<><button type="button" onClick={async()=>{try{const version=await loadPublicationVersion(row.data.id);setVersionDetails(current=>({...current,[row.key]:version}));}catch(e){setError(e.message);}}}>Inspect published settings</button>{versionDetails[row.key]&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12}}>{JSON.stringify(versionDetails[row.key].payload,null,2)}</pre>}</>}
        {row.data.user_id && onInspect && <button type="button" onClick={() => onInspect(row.data.user_id)}>Inspect student</button>}
      </details>)}
      <button type="button" disabled={cursors.length === 1} onClick={() => { setCursors(previous => previous.slice(0,-1)); setResult(null); }}>Previous page</button>
      <button type="button" disabled={!result.has_more} onClick={() => { setCursors(previous => [...previous,result.rows.at(-1)]); setResult(null); }}>Next page</button>
    </>}
  </section>;
}
