import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Clock3, History, RefreshCw, Send, ShieldCheck, X } from 'lucide-react';
import { cancelPublication, listScheduledPublications } from '../lib/adminPublication.js';
import { hasAdminCapability } from '../lib/adminCapabilities.js';
import '../styles/admin-scheduled-publications.css';

const AREAS = { schedule: 'Schedule', communications: 'Communications', system: 'System' };
const STATUSES = {
  pending: { label: 'Queued', Icon: Clock3 }, needs_review: { label: 'Needs review', Icon: AlertCircle },
  failed: { label: 'Failed', Icon: AlertCircle }, published: { label: 'Published', Icon: CheckCircle2 }, cancelled: { label: 'Cancelled', Icon: X },
};
const needsAttention = row => ['needs_review', 'failed'].includes(row.status);
const isHistory = row => ['published', 'cancelled'].includes(row.status);
const canCancel = row => row.status === 'pending' || needsAttention(row);
function dateParts(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return { date: 'Date unavailable', time: '' };
  return {
    date: date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
  };
}

export default function AdminScheduledPublications({ role }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(5);
  const [updatedAt, setUpdatedAt] = useState(null);
  const request = useRef(0);
  useEffect(() => {
    const tracker = request;
    const version = ++tracker.current;
    listScheduledPublications().then(data => {
      if (request.current === version) { setRows(data); setUpdatedAt(new Date()); }
    }).catch(e => { if (request.current === version) setError(e.message); });
    return () => { tracker.current++; };
  }, []);
  const refresh = async () => {
    const version = ++request.current;
    setBusy('refresh'); setError(''); setMessage('');
    try {
      const data = await listScheduledPublications();
      if (request.current === version) { setRows(data); setUpdatedAt(new Date()); }
    } catch (e) { if (request.current === version) setError(e.message); }
    finally { if (request.current === version) setBusy(''); }
  };
  const cancel = async row => {
    if (busy || !hasAdminCapability(role, `${row.domain}.publish`)) return;
    const when = dateParts(row.scheduled_at);
    if (!window.confirm(`Cancel the ${AREAS[row.domain] || row.domain} publication scheduled for ${when.date}, ${when.time} IST? This takes effect immediately.`)) return;
    const version = ++request.current;
    setBusy(row.id); setError(''); setMessage('');
    try {
      await cancelPublication(row.id);
      if (request.current !== version) return;
      setRows(current => current.map(item => item.id === row.id ? { ...item, status: 'cancelled', error: null } : item));
      setMessage(`${AREAS[row.domain] || row.domain} publication cancelled.`);
      try {
        const data = await listScheduledPublications();
        if (request.current === version) { setRows(data); setUpdatedAt(new Date()); }
      } catch (e) { if (request.current === version) setError(`Cancellation succeeded, but the queue could not refresh: ${e.message}`); }
    } catch (e) { if (request.current === version) setError(e.message); }
    finally { if (request.current === version) setBusy(''); }
  };
  const entries = rows || [];
  const filters = [
    { id: 'all', label: 'All', count: entries.length },
    { id: 'pending', label: 'Upcoming', count: entries.filter(row => row.status === 'pending').length },
    { id: 'attention', label: 'Needs attention', count: entries.filter(needsAttention).length },
    { id: 'history', label: 'History', count: entries.filter(isHistory).length },
  ];
  const filtered = entries.filter(row => filter === 'all' || (filter === 'pending' ? row.status === 'pending' : filter === 'attention' ? needsAttention(row) : isHistory(row)));
  const empty = filter === 'pending' ? 'Nothing queued' : filter === 'attention' ? 'No publications need attention' : filter === 'history' ? 'No publication history yet' : 'No scheduled publications';
  return <section className="admin-card admin-g-system system-control-card asp-panel" aria-label="Scheduled publications">
    <header className="asp-header">
      <span className="asp-header-icon" aria-hidden="true"><CalendarClock size={21} /></span>
      <div className="asp-heading"><h2>Scheduled publications</h2><p>Reviewed changes, queued by area. All times in IST.</p></div>
      <button type="button" className="asp-refresh" disabled={!!busy} onClick={refresh} aria-label={busy === 'refresh' ? 'Refreshing publications' : 'Refresh publications'} title="Refresh publications"><RefreshCw size={15} className={busy === 'refresh' ? 'asp-spin' : ''} aria-hidden="true" /><span>{busy === 'refresh' ? 'Refreshing…' : 'Refresh'}</span></button>
    </header>
    {error && <div className="asp-error" role="alert"><AlertCircle size={16} aria-hidden="true" /><div><strong>Queue update unavailable</strong><p>{error}</p>{rows && <small>Showing the last loaded entries.</small>}<button type="button" disabled={!!busy} onClick={refresh}>Try again</button></div></div>}
    {message && <p className="asp-success" role="status"><CheckCircle2 size={15} aria-hidden="true" />{message}</p>}
    {!rows && !error && <p className="asp-loading" role="status"><RefreshCw size={16} className="asp-spin" aria-hidden="true" />Loading scheduled publications…</p>}
    {rows && <>
      <nav className="asp-filters" aria-label="Filter scheduled publications">{filters.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setLimit(5); }}>{item.label}<span>{item.count}</span></button>)}</nav>
      {filters[2].count > 0 && filter !== 'history' && <p className="asp-attention"><AlertCircle size={14} aria-hidden="true" />{filters[2].count} {filters[2].count === 1 ? 'publication needs' : 'publications need'} a new review before running.</p>}
      {filtered.length === 0 ? <div className="asp-empty">
        {filter === 'history' ? <History size={25} aria-hidden="true" /> : <CalendarClock size={25} aria-hidden="true" />}
        <strong>{empty}</strong><p>{filter === 'all' || filter === 'pending' ? 'Schedule an area from Review changes when you are ready to publish later.' : filter === 'attention' ? 'Failed and review-required entries will appear here.' : 'Published and cancelled entries will appear here.'}</p>
        {filter !== 'all' && entries.length > 0 && <button type="button" onClick={() => { setFilter('all'); setLimit(5); }}>View all publications</button>}
      </div> : <ul className="asp-list" aria-label="Publication entries" aria-busy={!!busy}>{filtered.slice(0, limit).map(row => {
        const status = STATUSES[row.status] || { label: row.status, Icon: Clock3 }, StatusIcon = status.Icon;
        const when = dateParts(row.scheduled_at), published = row.published_at ? dateParts(row.published_at) : null;
        return <li className={`asp-entry asp-entry-${row.status}`} key={row.id}>
          <div className="asp-entry-top"><h3>{AREAS[row.domain] || row.domain}</h3><span className={`asp-status asp-status-${row.status}`}><StatusIcon size={12} aria-hidden="true" />{status.label}</span></div>
          <div className="asp-entry-main"><div className="asp-date"><Clock3 size={14} aria-hidden="true" /><time dateTime={row.scheduled_at}>{when.date}<span>{when.time} {when.time && 'IST'}</span></time></div>
            {canCancel(row) && (hasAdminCapability(role, `${row.domain}.publish`) ? <button type="button" className="asp-cancel" disabled={!!busy} onClick={() => cancel(row)} aria-label={`Cancel ${AREAS[row.domain] || row.domain} publication on ${when.date} at ${when.time} IST`}><X size={13} aria-hidden="true" />{busy === row.id ? 'Cancelling…' : 'Cancel'}</button> : <span className="asp-readonly">View only</span>)}
          </div>
          {row.error && <div className="asp-entry-error"><AlertCircle size={13} aria-hidden="true" /><p>{row.error}</p></div>}
          {row.notify_students && <p className="asp-audience"><Send size={13} aria-hidden="true" /><span>Student notification · {row.actual_recipients != null ? `${row.actual_recipients} in final audience` : row.estimated_recipients != null ? `${row.estimated_recipients} estimated · final audience set at execution` : 'Audience set at execution'}</span></p>}
          {published && <p className="asp-published">Published {published.date}, {published.time} IST</p>}
        </li>;
      })}</ul>}
      {filtered.length > 5 && <div className="asp-pagination"><span>Showing {Math.min(limit, filtered.length)} of {filtered.length}</span><button type="button" onClick={() => setLimit(current => current < filtered.length ? current + 5 : 5)}>{limit < filtered.length ? 'Show more' : 'Show fewer'}</button></div>}
    </>}
    <footer className="asp-footer"><span><ShieldCheck size={13} aria-hidden="true" />Each publication changes only its reviewed area.</span><small>{updatedAt ? `Updated ${dateParts(updatedAt).time} IST · latest 50 entries` : 'Latest 50 entries'}</small></footer>
  </section>;
}
