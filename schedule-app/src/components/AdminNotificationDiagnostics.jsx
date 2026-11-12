import { useEffect, useId, useState } from 'react';
import { Activity, AlertCircle, ArrowLeft, ArrowRight, BellRing, CheckCircle2, ChevronDown, Clock3, Loader2, PauseCircle, RefreshCw, Search, Send, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { adminRecordTime, adminSearchRange, buildNotificationDiagnosticFilter } from '../lib/adminSearchView.js';
import '../styles/admin-notification-diagnostics.css';

const PAGE_SIZE = 5;
const LABELS = { delivered: 'Provider accepted', no_subscription: 'No push subscription', preference_off: 'Push preference off', quiet_hours: 'Waiting for quiet hours', expired: 'Expired', provider_error: 'Provider error', endpoint_rejected: 'Endpoint rejected', pending_or_unknown: 'Awaiting evidence', unknown: 'No recorded state' };
const humanize = value => LABELS[value] || String(value || 'unknown').replaceAll('_',' ').replace(/^./, char => char.toUpperCase());
const tone = row => row.provider_accepted ? 'accepted' : ['provider_error','endpoint_rejected'].includes(row.state) ? 'error' : 'neutral';

export default function AdminNotificationDiagnostics({ userId = null, onInspect, workspace = 'insights', onClear }) {
  const [draft, setDraft] = useState(() => ({ ...adminSearchRange(7), type: '' }));
  const [filter, setFilter] = useState(() => buildNotificationDiagnosticFilter(draft));
  const [batch, setBatch] = useState(null), [page, setPage] = useState(0);
  const [response, setResponse] = useState(null), [refresh, setRefresh] = useState(0), [validation, setValidation] = useState('');
  const typeListId = useId();
  const cursor = batch?.filter === filter && batch?.userId === userId ? batch.cursor : null;
  const incomingPage = cursor ? batch.page : 0;
  const sameQuery = response?.filter === filter && response?.userId === userId;
  const loading = !sameQuery || response.cursor !== cursor || response.refresh !== refresh;
  const data = sameQuery ? response.data : null;
  const error = !loading && sameQuery ? response.error : '';
  const currentPage = sameQuery ? page : 0;
  const visible = data?.rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE) || [];
  const hasNext = data && ((currentPage + 1) * PAGE_SIZE < data.rows.length || data.has_more);
  const changed = draft.from !== filter.from || draft.to !== filter.to || draft.type.trim() !== filter.type;

  useEffect(() => {
    let active = true;
    supabase.rpc('admin_notification_diagnostics', { p_from: filter.start, p_to: filter.end, p_type: filter.type || null, p_user: userId, p_before: cursor?.created_at || null, p_before_id: cursor?.id || null })
      .then(({ data: result, error: failure }) => {
        if (!active) return;
        if (failure) throw new Error(failure.message);
        setResponse(previous => ({ filter, userId, cursor, refresh, data: { ...result, rows: cursor && previous?.filter === filter && previous?.userId === userId ? [...previous.data.rows, ...result.rows] : result.rows } }));
        setPage(incomingPage);
      }).catch(failure => {
        if (active) setResponse(previous => ({ filter, userId, cursor, refresh, error: failure.message, data: previous?.filter === filter && previous?.userId === userId ? previous.data : null }));
      });
    return () => { active = false; };
  }, [filter, cursor, userId, refresh, incomingPage]);

  const update = patch => { setDraft(previous => ({ ...previous, ...patch })); setValidation(''); };
  const apply = event => {
    event.preventDefault();
    try { setFilter(buildNotificationDiagnosticFilter(draft)); setPage(0); setValidation(''); }
    catch (failure) { setValidation(failure.message); }
  };
  const next = () => {
    if (loading || !hasNext) return;
    if ((currentPage + 1) * PAGE_SIZE < data.rows.length) setPage(previous => previous + 1);
    else { setBatch({ filter, userId, cursor: data.rows.at(-1), page: Math.ceil(data.rows.length / PAGE_SIZE) }); setRefresh(previous => previous + 1); }
  };

  return <section className={`admin-card admin-span-all admin-g-${workspace} nd-panel`} id={`notification-diagnostics-${workspace}`} aria-label="Notification diagnostics">
    <header className="nd-header"><span className="nd-heading-icon"><Activity size={22} aria-hidden="true" /></span><div><span className="nd-eyebrow">Delivery evidence</span><h2>Notification diagnostics</h2><p>Trace notification checks and push-provider handoffs.</p></div><button className="nd-refresh" type="button" disabled={loading} onClick={() => { setFilter(previous => ({ ...previous })); setPage(0); }} aria-label="Refresh notification diagnostics"><RefreshCw size={15} aria-hidden="true" /><span>Refresh</span></button></header>
    {userId && <div className="nd-student"><Users size={14} aria-hidden="true" /><span>Student <strong>{userId}</strong></span>{onClear && <button type="button" onClick={onClear}><X size={13} aria-hidden="true" />Show all students</button>}</div>}
    <form className="nd-filters" onSubmit={apply}><label>From · IST<input type="date" required value={draft.from} onChange={event => update({ from: event.target.value })} /></label><label>To · IST<input type="date" required value={draft.to} onChange={event => update({ to: event.target.value })} /></label><label className="nd-type">Notification type<input list={typeListId} value={draft.type} placeholder="All types" onChange={event => update({ type: event.target.value })} /><datalist id={typeListId}>{['class_reminder','daily_summary','schedule_change','class_cancelled','admin_broadcast','festive_greeting'].map(type => <option value={type} key={type} />)}</datalist></label><button type="submit" disabled={loading}><Search size={14} aria-hidden="true" />Apply filters</button><div className="nd-filter-foot"><span>Up to 90 days · all times in IST</span>{changed && <strong>Filters changed · apply to update</strong>}</div></form>
    {validation && <p className="nd-validation" role="alert"><AlertCircle size={14} aria-hidden="true" />{validation}</p>}
    {data?.dispatch_enabled === false && <div className="nd-paused" role="status"><PauseCircle size={18} aria-hidden="true" /><div><strong>Push dispatch is paused</strong><p>Inbox records can still be queued. Push handoffs wait for dispatch to resume.</p></div></div>}
    {data && <div className="nd-metrics" aria-label="Totals for the applied filters"><div><BellRing size={16} aria-hidden="true" /><strong>{data.total.toLocaleString('en-IN')}</strong><span>Notifications</span></div><div><Users size={16} aria-hidden="true" /><strong>{data.students.toLocaleString('en-IN')}</strong><span>Students</span></div><div><Send size={16} aria-hidden="true" /><strong>{data.accepted.toLocaleString('en-IN')}</strong><span>Provider accepted</span></div></div>}
    <p className="nd-caveat"><AlertCircle size={13} aria-hidden="true" />Provider acceptance confirms a push handoff. It does not confirm display on a device.</p>
    {error && <div className="nd-error" role="alert"><AlertCircle size={17} aria-hidden="true" /><div><strong>Diagnostics could not update</strong><p>{error}</p><button type="button" onClick={() => setRefresh(previous => previous + 1)}>Try again</button></div></div>}
    {loading && <p className="nd-loading" role="status"><Loader2 size={16} aria-hidden="true" />{data ? 'Loading the next records…' : 'Loading notification evidence…'}</p>}
    {data && <>
      <div className="nd-list-heading"><h3>Notification records</h3><span>{data.total ? `${currentPage * PAGE_SIZE + 1}–${currentPage * PAGE_SIZE + visible.length} of ${data.total}` : '0 records'} · 5 per page</span></div>
      {visible.length === 0 ? <div className="nd-empty"><BellRing size={26} aria-hidden="true" /><strong>No notification records</strong><p>Try another type or a broader date range within the last 90 days.</p></div> : <div className="nd-list" aria-busy={loading}>{visible.map(row => <details className={`nd-record nd-record-${tone(row)}`} key={row.id}>
        <summary><span className="nd-record-icon"><BellRing size={16} aria-hidden="true" /></span><span className="nd-record-title"><strong>{row.title || humanize(row.type)}</strong><small>{humanize(row.type)} · {adminRecordTime(row.created_at)}</small></span><span className={`nd-status nd-status-${tone(row)}`}>{row.provider_accepted && <CheckCircle2 size={12} aria-hidden="true" />}{row.provider_accepted ? 'Provider accepted' : humanize(row.state)}</span><ChevronDown size={15} className="nd-chevron" aria-hidden="true" /></summary>
        <div className="nd-record-body"><div className="nd-recipient"><div><span>Student</span><strong>{row.user_id}</strong></div>{onInspect && <button type="button" onClick={() => onInspect(row.user_id)}>Inspect student<ArrowRight size={13} aria-hidden="true" /></button>}</div>
          <div className="nd-device-counts"><div><span>Devices attempted</span><strong>{row.push_attempted_devices ?? 'Not recorded'}</strong></div><div><span>Devices accepted</span><strong>{row.push_accepted_devices ?? 'Not recorded'}</strong></div></div><p className="nd-check-note">Last recorded device check{row.push_checked_at ? ` · ${adminRecordTime(row.push_checked_at)}` : ''}. Device counts differ from student counts.</p>
          <details className="nd-history"><summary><Clock3 size={13} aria-hidden="true" />Recorded checks <span>{row.history?.length || 0}</span><ChevronDown size={13} aria-hidden="true" /></summary>{row.history?.length ? <ol>{row.history.map(event => <li key={event.id}><strong>{humanize(event.state)}</strong><time dateTime={event.checked_at}>{adminRecordTime(event.checked_at)}</time><span>{event.attempted_devices ?? 'Unknown'} devices attempted · {event.accepted_devices ?? 'Unknown'} accepted</span></li>)}</ol> : <p>No recorded check history.</p>}</details>
        </div>
      </details>)}</div>}
      <nav className="nd-pagination" aria-label="Notification diagnostics pages"><span>Page {currentPage + 1}{!data.has_more && data.rows.length > 0 ? ` of ${Math.ceil(data.rows.length / PAGE_SIZE)}` : ''}</span><div><button type="button" disabled={loading || currentPage === 0} onClick={() => setPage(previous => previous - 1)}><ArrowLeft size={14} aria-hidden="true" />Previous</button><button type="button" disabled={loading || !hasNext} onClick={next}>Next<ArrowRight size={14} aria-hidden="true" /></button></div></nav>
    </>}
    <footer className="nd-footer">Up to 20 recorded state changes or send checks per notification · retained for 90 days. Unchanged checks that do not send a push add no history.</footer>
  </section>;
}
