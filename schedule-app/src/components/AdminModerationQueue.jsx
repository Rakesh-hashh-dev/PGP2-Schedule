import { useEffect, useState } from 'react';
import { loadReportQueue, moderateContent } from '../lib/adminModeration.js';
import { hasAdminCapability } from '../lib/adminCapabilities.js';
import { loadAdminWorkspacePrefs,saveAdminWorkspacePrefs } from '../lib/adminWorkspacePrefs.js';

export default function AdminModerationQueue({ role, roster = [], userId }) {
  const [status, setStatus] = useState(()=>loadAdminWorkspacePrefs(userId).filters.reportStatus || 'open');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reasons, setReasons] = useState({});
  const [owners, setOwners] = useState({});
  const [cursors,setCursors]=useState([null]);const cursor=cursors.at(-1);
  useEffect(() => {
    let active = true;
    loadReportQueue(status,cursor).then(data => { if (active) { setRows(data); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [status,cursor]);
  const act = async (row, action) => {
    const reason = reasons[row.id]?.trim();
    if (!reason) { setError('Write a decision reason first.'); return; }
    if (!window.confirm(`${action} this reported ${row.target_type.replaceAll('_', ' ')}?`)) return;
    setBusy(true); setError('');
    try { await moderateContent(row.id, action, reason, owners[row.id] || null); setRows(await loadReportQueue(status,cursor)); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <section className="admin-card admin-ops-panel admin-g-moderation" aria-label="Reported content queue"><h2>Reported content</h2>
    <p>50 reports per page. Group context is limited to the reported message. Reporter identities are private.</p>
    <label>Report status<select value={status} onChange={e => { setStatus(e.target.value); setCursors([null]);setRows(null); const prefs=loadAdminWorkspacePrefs(userId);saveAdminWorkspacePrefs(userId,{...prefs,filters:{...prefs.filters,reportStatus:e.target.value}}); }}>{['open','resolved','dismissed','all'].map(value => <option key={value}>{value}</option>)}</select></label>
    <button type="button" onClick={async () => { try { setRows(await loadReportQueue(status,cursor)); setError(''); } catch (e) { setError(e.message); } }}>Refresh reports</button>
    {error && <p role="alert">{error}</p>}{!rows && !error && <p role="status">Loading reports…</p>}{rows?.length === 0 && <p>No reports in this view.</p>}
    {rows?.map(row => <article key={row.id} style={{ borderTop: '1px solid var(--border)', paddingBlock: 12, overflowWrap: 'anywhere' }}>
      <h3>{row.target_type.replaceAll('_', ' ')} · {row.reason}</h3><small>{new Date(row.created_at).toLocaleString()} · {row.status} · owner {row.owner_id || 'Unassigned'}</small>
      <small>Evidence captured when reported.</small><blockquote style={{ whiteSpace: 'pre-wrap' }}>{row.evidence.text}</blockquote><p>{row.detail}</p>
      <details><summary>Latest 20 decisions</summary>{row.history.map((item, index) => <p key={index}>{item.action} · {item.reason} · {item.actor} · {new Date(item.at).toLocaleString()}</p>)}</details>
      {hasAdminCapability(role, 'moderation.write') && <fieldset disabled={busy} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <legend>Moderation decision</legend><input aria-label="Decision reason" maxLength={500} placeholder="Decision reason" value={reasons[row.id] || ''} onChange={e => setReasons(current => ({ ...current, [row.id]: e.target.value }))} />
        <select aria-label="Assign moderator" value={owners[row.id] || ''} onChange={e => setOwners(current => ({ ...current, [row.id]: e.target.value }))}><option value="">Unassigned</option>{roster.filter(admin => ['moderator','superadmin'].includes(admin.role)).map(admin => <option key={admin.user_id} value={admin.user_id}>{admin.name || admin.user_id}</option>)}</select>
        {['hide','restore','dismiss','resolve','assign'].map(action => <button type="button" key={action} onClick={() => act(row, action)}>{action}</button>)}
      </fieldset>}
    </article>)}
    <button type="button" disabled={busy||cursors.length===1} onClick={()=>{setCursors(current=>current.slice(0,-1));setRows(null);}}>Previous reports</button>
    <button type="button" disabled={busy||rows?.length!==50} onClick={()=>{setCursors(current=>[...current,rows.at(-1)]);setRows(null);}}>Older reports</button>
  </section>;
}
