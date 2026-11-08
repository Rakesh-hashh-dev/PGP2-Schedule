import { useEffect, useState } from 'react';
import { cancelPublication, listScheduledPublications } from '../lib/adminPublication.js';
import { hasAdminCapability } from '../lib/adminCapabilities.js';

export default function AdminScheduledPublications({ role }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    listScheduledPublications().then(data => { if (active) setRows(data); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  const refresh = async () => {
    setBusy(true); setError('');
    try { setRows(await listScheduledPublications()); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const cancel = async row => {
    if (!window.confirm(`Cancel the ${row.domain} publication scheduled for ${new Date(row.scheduled_at).toLocaleString()}?`)) return;
    setBusy(true); setError('');
    try { await cancelPublication(row.id); setRows(await listScheduledPublications()); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <section className="admin-card admin-g-system system-control-card" aria-label="Scoped publication queue"><h2>Scheduled publications</h2>
    <p>Latest 50 entries. Each applies only its reviewed area. Legacy snapshots need restaging; they will not run automatically.</p>
    <button type="button" className="admin-btn outline" disabled={busy} onClick={refresh}>Refresh queue</button>
    {error && <p role="alert">{error}</p>}{!rows && !error && <p role="status">Loading queue…</p>}
    {rows?.length === 0 && <p>No scheduled publications.</p>}
    {rows?.map(row => <div key={row.id}><strong>{row.domain}</strong> · {new Date(row.scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · {row.status}
      {row.error && <p>{row.error}</p>}
      {row.notify_students&&<p>Audience estimate: {row.estimated_recipients??'unknown'} students · final audience: {row.actual_recipients??'resolved at execution'}</p>}
      {['pending', 'needs_review', 'failed'].includes(row.status) && <button type="button" className="admin-btn outline" disabled={busy || !hasAdminCapability(role, `${row.domain}.publish`)} onClick={() => cancel(row)}>Cancel publication</button>}
    </div>)}
  </section>;
}
