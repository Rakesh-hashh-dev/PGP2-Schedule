import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
const END = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const START = new Date(Date.now() - 6 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
export default function AdminNotificationDiagnostics({ userId = null, onInspect,workspace='insights',onClear }) {
  const [from, setFrom] = useState(START), [to, setTo] = useState(END), [type, setType] = useState('');
  const [filter, setFilter] = useState({ from: START, to: END, type: '' });
  const [cursor, setCursor] = useState(null), [result, setResult] = useState(null), [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const first = new Date(`${filter.from}T00:00:00+05:30`), last = new Date(`${filter.to}T00:00:00+05:30`);
    if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime())) return;
    supabase.rpc('admin_notification_diagnostics', { p_from: first.toISOString(), p_to: new Date(last.getTime() + 86400000).toISOString(), p_type: filter.type || null, p_user: userId, p_before: cursor?.created_at || null, p_before_id: cursor?.id || null })
      .then(({ data, error: failure }) => { if (!active) return; if (failure) setError(failure.message); else { setResult(data); setError(''); } });
    return () => { active = false; };
  }, [filter, cursor, userId, refresh]);
  return <section className={`admin-card admin-ops-panel admin-g-${workspace}`} aria-label="All notification diagnostics"><h2>Notification diagnostics</h2>
    {userId&&<p>Student: {userId} <button type="button" onClick={onClear}>Show all students</button></p>}
    <p>Provider acceptance confirms a push handoff, not device display. Last-check device counts differ from student counts. Up to 20 state changes/send checks per notification are retained for 90 days; unchanged no-send checks do not add history.</p>
    <form onSubmit={e => { e.preventDefault(); setFilter({ from, to, type }); setCursor(null); setResult(null); setRefresh(value => value + 1); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <label>From (IST)<input type="date" required value={from} onChange={e => setFrom(e.target.value)} /></label><label>To (IST)<input type="date" required value={to} onChange={e => setTo(e.target.value)} /></label>
      <label>Notification type<input value={type} placeholder="All types" onChange={e => setType(e.target.value)} /></label><button type="submit">Search / refresh</button>
    </form>
    {error && <p role="alert">{error}</p>}{!result && !error && <p role="status">Loading diagnostics…</p>}
    {result && <>{result.dispatch_enabled===false&&<p role="status">Push dispatch is paused in system settings. Inbox records can still be queued.</p>}<p>{result.total} notifications · {result.students} students · {result.accepted} with provider acceptance</p>
      {result.rows.length === 0 && <p>No notification records in this range.</p>}
      {result.rows.map(row => <details key={row.id}><summary>{row.type} · {row.title} · {row.provider_accepted ? 'Provider accepted' : row.state}</summary>
        <p>{row.user_id} · {new Date(row.created_at).toLocaleString()} {onInspect && <button type="button" onClick={() => onInspect(row.user_id)}>Inspect student</button>}</p>
        <p>Devices on last recorded check: attempted {row.push_attempted_devices ?? 'unknown'}, accepted {row.push_accepted_devices ?? 'unknown'}.</p>
        {row.history.length === 0 && <p>No recorded check history.</p>}{row.history.map(event => <p key={event.id}>{new Date(event.checked_at).toLocaleString()} · {event.state || 'unknown'} · attempts {event.attempted_devices ?? 'unknown'} · accepted {event.accepted_devices ?? 'unknown'}</p>)}
      </details>)}
      <button type="button" disabled={!cursor} onClick={() => { setCursor(null); setResult(null); }}>First page</button>
      <button type="button" disabled={!result.has_more} onClick={() => { setCursor(result.rows.at(-1)); setResult(null); }}>Next page</button>
    </>}
  </section>;
}
