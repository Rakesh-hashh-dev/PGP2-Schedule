import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { DIWALI_2026, validFestivalDate, diwaliDecorEnabled } from '../../supabase/functions/_shared/diwali.js';
export default function AdminDiwaliControls({ flags, onChange, disabled }) {
  const configured = flags.diwali?.date || DIWALI_2026;
  const [draft, setDraft] = useState(null);
  const date = draft ?? configured;
  const change = patch => onChange({ ...flags, diwali: { ...(flags.diwali || {}), ...patch } });
  return <section className="admin-card admin-g-system system-control-card">
    <h2><Sparkles size={20} /> Diwali celebration</h2>
    <p className="admin-subtext">Changes are staged. Review and publish the System area to apply them. The 2026 date is verified; set a confirmed date for future years.</p>
    <fieldset className="admin-readonly-group" disabled={disabled}>
      <label className="admin-field"><span>Event date (IST)</span><input className="admin-input" type="date" value={date} onChange={event => setDraft(event.target.value)} /></label>
      <button type="button" className="admin-btn" disabled={!validFestivalDate(date) || date === configured} onClick={() => { change({ date }); setDraft(null); }}>Stage event date</button>
      <p className="admin-subtext">Configured date: {configured}. Visuals run from the day before to the day after; the greeting is queued only on the event day, 9 AM–10 PM IST.</p>
      <label className="admin-field"><span><input type="checkbox" checked={diwaliDecorEnabled(flags)} onChange={event => onChange({ ...flags, features: { ...(flags.features || {}), diwaliDecor: event.target.checked } })} /> Diwali décor</span></label>
      <label className="admin-field"><span><input type="checkbox" checked={flags.diwali?.greetingPush !== false} onChange={event => change({ greetingPush: event.target.checked })} /> Enable one festive greeting per event</span></label>
      <p className="admin-subtext">This is the same Diwali décor switch shown under Features. Independence/Republic Day décor is controlled separately. Student notification opt-outs and quiet hours still apply.</p>
    </fieldset>
  </section>;
}
