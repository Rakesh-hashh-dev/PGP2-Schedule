import { useState } from 'react';
import {createPortal} from 'react-dom';
import { reportContent } from '../lib/adminModeration.js';
import { dialogProps, useDialog } from '../hooks/useDialog.js';
import '../styles/report-content.css';

export default function ReportContentButton({ type, contentId }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const ref = useDialog(open, () => { if (!busy) setOpen(false); });
  const submit = async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await reportContent(type, contentId, reason, detail); setMessage('Report received by moderators.'); setOpen(false); }
    catch (e) { setMessage(e.message); } finally { setBusy(false); }
  };
  return <><button type="button" className="report-content-trigger" onClick={() => {setMessage('');setOpen(true);}}>Report</button>
    {message && !open && <span role="status">{message}</span>}
    {open && createPortal(<div className="notif-backdrop" style={{ zIndex: 12000, display: 'grid', placeItems: 'center' }} onClick={event => {event.stopPropagation();if (!busy) setOpen(false); }}>
      <form className="report-content-form" ref={ref} {...dialogProps('Report content')} onSubmit={submit} onClick={event => event.stopPropagation()}>
        <h3>Report content</h3><label>Reason<select disabled={busy} value={reason} onChange={event => setReason(event.target.value)}>{['spam','harassment','inappropriate','misleading','other'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Additional context (optional)<textarea disabled={busy} maxLength={1000} value={detail} onChange={event => setDetail(event.target.value)} /></label>
        {message && <p role="alert">{message}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button><button type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </form>
    </div>,document.body)}
  </>;
}
