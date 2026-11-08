import { useEffect, useId, useRef, useState } from 'react';
import { loadStudentNote, saveStudentNote } from '../lib/adminNotes.js';
import {useAdminNavigationGuard} from '../hooks/useAdminNavigationGuard.js';

export default function AdminStudentNotes({ userId, readOnly, onDirtyChange }) {
  const id = useId();
  const alive = useRef(false);
  const [saved, setSaved] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    loadStudentNote(userId).then(note => {
      if (!cancelled) { setSaved(note); setBody(note.body); }
    }).catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; alive.current = false; };
  }, [userId]);
  const dirty = saved !== null && saved.body !== body;
  useAdminNavigationGuard(dirty,'private note');
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
  const reload = async () => {
    if (dirty && !window.confirm('Discard your unsaved note edits and reload the saved note? Copy any text you want to keep first.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const note = await loadStudentNote(userId);
      if (alive.current) { setSaved(note); setBody(note.body); }
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const note = await saveStudentNote(userId, body, Number(saved.revision));
      if (alive.current) { setSaved(note); setBody(note.body); setMessage('Private note saved. No configuration publish is needed.'); }
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  };
  return <section className="admin-user-xray-section">
    <h3><label htmlFor={id}>Private admin notes</label></h3>
    <p>Stored separately from student-facing settings. Save notes independently.</p>
    {loading && <p role="status">Loading private note…</p>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <textarea id={id} className="admin-input" rows={3} maxLength={20000}
      placeholder="Private notes about this student…" value={body}
      disabled={loading || busy || !saved || readOnly} onChange={event => { setBody(event.target.value); setMessage(''); }} />
    {saved?.updated_at && <p>Last saved {new Date(saved.updated_at).toLocaleString()} by {saved.updated_by} · revision {saved.revision}</p>}
    {readOnly && <p>You have read-only access.</p>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" className="admin-btn" disabled={!dirty || busy || readOnly} onClick={save}>{busy ? 'Working…' : 'Save private note'}</button>
      <button type="button" className="admin-btn outline" disabled={loading || busy} onClick={reload}>Reload saved note</button>
      {dirty && <span role="status">Unsaved note changes</span>}
    </div>
  </section>;
}
