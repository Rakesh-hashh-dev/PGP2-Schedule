import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { hasAdminCapability } from '../lib/adminCapabilities.js';

const PAGE_SIZE = 5;

function StatusBadge({ status }) {
  const color = {
    resolved: 'var(--color-success, #22c55e)',
    duplicate: 'var(--color-muted, #94a3b8)',
    open: 'var(--color-warning, #f59e0b)',
    pending: 'var(--color-warning, #f59e0b)',
  }[status] ?? 'var(--color-muted, #94a3b8)';
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: '999px',
      fontSize: '0.7rem',
      fontWeight: 600,
      letterSpacing: '0.03em',
      textTransform: 'capitalize',
      background: color + '22',
      color,
      border: `1px solid ${color}55`,
      lineHeight: 1.6,
    }}>{status ?? 'unknown'}</span>
  );
}

function PaginatedList({ items, renderItem, emptyMsg }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const slice = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (items.length === 0) return <p style={{ color: 'var(--color-muted, #94a3b8)', fontSize: '0.8rem', margin: '4px 0 0' }}>{emptyMsg}</p>;

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {slice.map(renderItem)}
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '0.75rem', color: 'var(--color-muted, #94a3b8)' }}>
          <button
            type="button"
            className="admin-btn outline"
            style={{ padding: '2px 10px', fontSize: '0.75rem' }}
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >‹ Prev</button>
          <span>{page + 1} / {totalPages}</span>
          <button
            type="button"
            className="admin-btn outline"
            style={{ padding: '2px 10px', fontSize: '0.75rem' }}
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >Next ›</button>
        </div>
      )}
    </div>
  );
}

function Row({ children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 8px',
      borderRadius: 6,
      fontSize: '0.8rem',
      background: 'var(--color-surface-alt, rgba(0,0,0,0.04))',
      lineHeight: 1.4,
    }}>{children}</div>
  );
}

function InfoChip({ label, value }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--color-muted, #64748b)' }}>
      <span style={{ fontWeight: 600, color: 'var(--color-text, inherit)' }}>{value}</span>
      <span>{label}</span>
    </span>
  );
}

export default function AdminStudentSupport({ userId, role, onNavigate }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.rpc('admin_student_support', { p_user_id: userId })
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) setError(failure.message);
        else { setResult(data); setError(''); }
      })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, refresh]);

  const handleRefresh = () => { setResult(null); setRefresh(v => v + 1); };

  const warnings = result?.available ? [
    !result.course_count && 'No courses selected — enrollment needs attention.',
    !result.push_devices && 'No subscribed device — push cannot be delivered.',
    result.push_preferences?.cancellation_alerts === false && 'Cancellation alerts are disabled.',
    !result.profile?.last_seen_at && 'No activity timestamp recorded.',
  ].filter(Boolean) : [];

  return (
    <section className="admin-user-xray-section" aria-label="Student support overview" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.02em' }}>Student support</h3>
        <button
          type="button"
          className="admin-btn outline"
          style={{ padding: '3px 12px', fontSize: '0.75rem' }}
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && <p role="alert" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-error, #ef4444)' }}>{error}</p>}

      {/* Loading */}
      {loading && !result && <p role="status" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-muted, #94a3b8)' }}>Loading…</p>}

      {/* Not found */}
      {!loading && result?.available === false && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-muted, #94a3b8)' }}>No saved student profile found.</p>
      )}

      {result?.available && <>

        {/* Meta chips */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <InfoChip value={result.course_count} label="courses" />
          <InfoChip value={result.push_devices} label="devices" />
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted, #94a3b8)', marginLeft: 'auto' }}>
            {new Date(result.checked_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.75rem', color: 'var(--color-warning, #f59e0b)', padding: '3px 0' }}>
                <span>⚠</span><span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recent feedback */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted, #94a3b8)', marginBottom: 5 }}>
            Recent feedback
          </div>
          <PaginatedList
            items={result.feedback}
            emptyMsg="No feedback on record."
            renderItem={item => (
              <Row key={item.id}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.message}>
                  {item.message}
                </span>
                <StatusBadge status={item.status} />
                <span style={{ fontSize: '0.7rem', color: 'var(--color-muted, #94a3b8)', whiteSpace: 'nowrap' }}>
                  {item.owner_id ? item.owner_id.slice(0, 8) + '…' : 'Unassigned'}
                </span>
              </Row>
            )}
          />
        </div>

        {/* Recent interventions */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted, #94a3b8)', marginBottom: 5 }}>
            Recent interventions
          </div>
          <PaginatedList
            items={result.interventions}
            emptyMsg="No interventions on record."
            renderItem={item => (
              <Row key={item.id}>
                <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.action}>
                  {item.action}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-muted, #94a3b8)', whiteSpace: 'nowrap' }}>
                  {new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </Row>
            )}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
          {hasAdminCapability(role, 'diagnostics.read') && (
            <button type="button" className="admin-btn outline" style={{ fontSize: '0.75rem', padding: '3px 12px' }}
              onClick={() => onNavigate('diagnostics', userId)}>
              Notification diagnostics
            </button>
          )}
          <button type="button" className="admin-btn outline" style={{ fontSize: '0.75rem', padding: '3px 12px' }}
            onClick={() => onNavigate('feedback', userId)}>
            Feedback workspace
          </button>
        </div>

      </>}
    </section>
  );
}
