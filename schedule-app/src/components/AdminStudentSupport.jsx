import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { hasAdminCapability } from '../lib/adminCapabilities.js';
export default function AdminStudentSupport({ userId, role, onNavigate }) {
  const [result, setResult] = useState(null), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    supabase.rpc('admin_student_support', { p_user_id: userId }).then(({ data, error: failure }) => {
      if (!active) return;
      if (failure) setError(failure.message); else { setResult(data); setError(''); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [userId, refresh]);
  return <section className="admin-user-xray-section" aria-label="Student support overview"><h3>Student support</h3>
    <button type="button" className="admin-btn outline" onClick={() => { setResult(null); setRefresh(value => value + 1); }}>Refresh support data</button>
    {error && <p role="alert">{error}</p>}{!result && !error && <p role="status">Loading support summary…</p>}
    {result?.available === false && <p>No saved student profile was found.</p>}
    {result?.available && <><p>Checked {new Date(result.checked_at).toLocaleString()}</p>
      <p>{result.course_count} enrolled course keys · {result.push_devices} subscribed devices</p>
      {!result.course_count && <p>Setup needs attention: no courses selected. Use the enrollment tools below to inspect the saved setup.</p>}
      {!result.profile.last_seen_at && <p>No activity timestamp is recorded; this does not establish absence.</p>}
      {!result.push_devices && <p>Push cannot be delivered without a subscribed device. The student can enable notifications in Settings; inbox delivery is separate.</p>}
      {result.push_preferences?.cancellation_alerts === false && <p>Cancellation alerts are disabled in this student’s saved preferences.</p>}
      <h4>Recent feedback</h4>{result.feedback.length === 0 && <p>No saved feedback.</p>}{result.feedback.map(item => <p key={item.id}>{item.message} · {item.status} · owner {item.owner_id || 'Unassigned'}</p>)}
      <h4>Recent interventions</h4>{result.interventions.map(item => <p key={item.id}>{item.action} · {item.admin_id} · {new Date(item.created_at).toLocaleString()}</p>)}
      {hasAdminCapability(role,'diagnostics.read') && <button type="button" className="admin-btn outline" onClick={() => onNavigate('diagnostics',userId)}>Open this student’s notification diagnostics</button>}
      <button type="button" className="admin-btn outline" onClick={() => onNavigate('feedback',userId)}>Open feedback workspace</button>
    </>}
  </section>;
}
