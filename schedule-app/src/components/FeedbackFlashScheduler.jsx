import { useState } from "react";
import { Check, ChevronDown, Clock3, Copy, MessageSquare, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import FeedbackFlashToast from "./FeedbackFlashToast.jsx";
import "../styles/feedback-flash-scheduler.css";

const HOUR = 60 * 60 * 1000;
const formatDate = value => new Date(value).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const localInput = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const presets = [
  { label: "Tonight · 11:59 PM", date: now => { const d = new Date(now); d.setHours(23, 59, 0, 0); return d; } },
  { label: "Tomorrow · 5 PM", date: now => { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(17, 0, 0, 0); return d; } },
  { label: "Next Friday · 11:59 PM", date: now => { const d = new Date(now); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); d.setHours(23, 59, 0, 0); return d; } },
  { label: "+7 days", date: now => { const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0); return d; } },
];

function stageState(time, now, enabled) {
  if (!enabled || !Number.isFinite(time)) return "pending";
  if (now < time) return "upcoming";
  if (now <= time + HOUR) return "live";
  return "past";
}

export default function FeedbackFlashScheduler({ flashes, setFlashes, legend, sectionsByCode, now, onSave, saving, saveMsg }) {
  const [expandedId, setExpandedId] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [filter, setFilter] = useState("all");

  const update = (id, patch) => setFlashes(current => current.map(f => f.id === id ? { ...f, ...patch } : f));
  const add = () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFlashes(current => [...current, { id, enabled: false, deadline: "", link: "", subjectCode: "", section: "" }]);
    setExpandedId(id);
    setFilter("all");
  };
  const classify = f => {
    const deadline = new Date(f.deadline).getTime();
    if (!f.deadline || !Number.isFinite(deadline)) return "draft";
    if (deadline <= now) return "expired";
    if (!f.subjectCode || !f.section) return "draft";
    return f.enabled ? "active" : "draft";
  };
  const counts = { all: flashes.length, active: 0, draft: 0, expired: 0 };
  flashes.forEach(f => { counts[classify(f)] += 1; });
  const visible = flashes.filter(f => filter === "all" || classify(f) === filter);
  const preview = flashes.find(f => f.id === previewId);
  const save = () => {
    const invalid = flashes.find(f => f.enabled && (!f.deadline || !Number.isFinite(new Date(f.deadline).getTime()) || (new Date(f.deadline).getTime() > Date.now() && (!f.subjectCode || !sectionsByCode[f.subjectCode]?.includes(f.section)))));
    if (invalid) {
      setFilter("all");
      setExpandedId(invalid.id);
      window.alert("Each enabled upcoming flash needs a valid deadline, subject, and section.");
      return;
    }
    onSave();
  };

  return (
    <section className="admin-card admin-span-all admin-g-broadcast ff-scheduler" style={{ gridColumn: "1 / -1" }}>
      <div className="ff-head">
        <div>
          <span className="ff-eyebrow"><MessageSquare size={14} /> Course feedback</span>
          <h2>Feedback Flash Scheduler</h2>
          <p>Set a deadline and audience. Students receive an in-app reminder at announcement, 2 hours before, and 20 minutes before the deadline.</p>
        </div>
        <button type="button" className="admin-btn primary ff-add" onClick={add}><Plus size={16} /> New flash</button>
      </div>

      <div className="ff-overview" aria-label="Feedback flash counts">
        {[["all", "All flashes"], ["active", "Active & scheduled"], ["draft", "Drafts"], ["expired", "Expired"]].map(([key, label]) => (
          <button key={key} type="button" className={`ff-metric${filter === key ? " is-selected" : ""}`} onClick={() => setFilter(key)} aria-pressed={filter === key}>
            <strong>{counts[key]}</strong><span>{label}</span>
          </button>
        ))}
      </div>

      <div className="ff-list">
        {visible.map(f => {
          const deadline = f.deadline ? new Date(f.deadline).getTime() : NaN;
          const validDeadline = Number.isFinite(deadline) && deadline > now;
          const status = classify(f);
          const stages = [
            { label: "Announce", time: f.announcedAt ? new Date(f.announcedAt).getTime() : NaN },
            { label: "2 hours before", time: deadline - 2 * HOUR },
            { label: "20 minutes before", time: deadline - 20 * 60000 },
          ];
          const open = expandedId === f.id;
          const selectedSections = sectionsByCode[f.subjectCode] || [];
          return (
            <article key={f.id} className={`ff-item ff-item--${status}`}>
              <div className="ff-item-main">
                <div className="ff-item-icon"><MessageSquare size={19} /></div>
                <div className="ff-item-info">
                  <div className="ff-item-title"><strong>Flash {flashes.indexOf(f) + 1}</strong><span className={`ff-status ff-status--${status}`}>{status === "active" ? "Active" : status === "expired" ? "Expired" : "Draft"}</span></div>
                  <p>{f.deadline && Number.isFinite(deadline) ? `Deadline ${formatDate(deadline)}` : "Choose a deadline to get started"}</p>
                  <div className="ff-item-meta"><span>{f.subjectCode ? `${legend[f.subjectCode]?.name || f.subjectCode} · ${f.subjectCode} · Section ${f.section || "?"}` : f.subjectCode === undefined ? "Legacy audience · choose a subject and section" : "Subject and section needed"}</span><span>{f.link ? "External form" : "In-app feedback"}</span></div>
                </div>
                <div className="ff-item-actions">
                  <button type="button" className="admin-btn outline" onClick={() => setPreviewId(f.id)} title="Preview student reminder"><Sparkles size={14} /> Preview</button>
                  <button type="button" className="admin-btn outline ff-edit" onClick={() => setExpandedId(open ? null : f.id)} aria-expanded={open} aria-controls={`ff-details-${f.id}`}>{open ? "Close" : "Edit"}<ChevronDown size={15} className={open ? "is-open" : ""} /></button>
                </div>
              </div>
              {open && <div className="ff-details" id={`ff-details-${f.id}`}>
                <div className="ff-settings-head"><div><h3>Flash settings</h3><p>Changes go live when you save the scheduler.</p></div><label className="ff-enable"><input type="checkbox" checked={!!f.enabled} onChange={e => update(f.id, { enabled: e.target.checked })} /><span>Enabled</span></label></div>
                {f.enabled && (!validDeadline || !f.subjectCode || !f.section) && <p className="ff-warning" role="alert">{validDeadline ? "Set a subject and its section before saving this enabled flash." : "This deadline has passed or is missing; students will not receive reminders."}</p>}
                {f.subjectCode === undefined && <p className="ff-warning">This saved flash uses the older course-only audience and will not reach students until you choose a subject and section.</p>}
                <div className="ff-form-grid">
                  <div className="admin-field"><label htmlFor={`ff-deadline-${f.id}`}>Deadline date & time</label><input id={`ff-deadline-${f.id}`} type="datetime-local" className="admin-input" value={f.deadline || ""} onChange={e => update(f.id, { deadline: e.target.value })} /><div className="ff-presets">{presets.map(p => <button key={p.label} type="button" onClick={() => update(f.id, { deadline: localInput(p.date(new Date())) })}>{p.label}</button>)}</div></div>
                  <div className="admin-field"><label htmlFor={`ff-link-${f.id}`}>External form link <span className="admin-optional">Optional</span></label><input id={`ff-link-${f.id}`} type="url" className="admin-input" value={f.link || ""} onChange={e => update(f.id, { link: e.target.value })} placeholder="https://forms.gle/..." /><p className="ff-field-hint">Leave blank to open TermFlow feedback.</p></div>
                </div>
                <div className="ff-audience"><div className="ff-audience-head"><div><h3>Audience</h3><p>Only students enrolled in this subject and section will see the reminder.</p></div></div><div className="ff-form-grid"><div className="admin-field"><label htmlFor={`ff-subject-${f.id}`}>Subject · code</label><select id={`ff-subject-${f.id}`} className="admin-input" value={f.subjectCode || ""} onChange={e => update(f.id, { subjectCode: e.target.value, section: "", subjects: undefined })}><option value="">Choose a subject</option>{Object.entries(legend).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([code, item]) => <option key={code} value={code}>{item.name.replace(/\s+/g, " ")} · {code}</option>)}</select></div><div className="admin-field"><label htmlFor={`ff-section-${f.id}`}>Section of that subject</label><select id={`ff-section-${f.id}`} className="admin-input" value={f.section || ""} disabled={!f.subjectCode} onChange={e => update(f.id, { section: e.target.value })}><option value="">Choose a section</option>{selectedSections.map(section => <option key={section} value={section}>{section}</option>)}</select>{f.subjectCode && selectedSections.length === 0 && <p className="ff-field-hint">No taught section is listed for this subject yet.</p>}</div></div></div>
                {validDeadline && <div className="ff-timeline"><h3><Clock3 size={15} /> Reminder timeline</h3><div className="ff-stages">{stages.map(stage => { const state = stageState(stage.time, now, f.enabled); return <div key={stage.label} className={`ff-stage ff-stage--${state}`}><span className="ff-stage-dot" /><div><strong>{stage.label}</strong><small>{Number.isFinite(stage.time) ? `${formatDate(stage.time)} · ${state === "past" ? "Window passed" : state === "live" ? "Window open" : state === "pending" ? "Disabled" : "Upcoming"}` : "Starts when saved and enabled"}</small></div></div>; })}</div><p>Each reminder is available for one hour. Students can dismiss each stage for the current browser session.</p></div>}
                <div className="ff-item-footer"><span>{f.enabled ? "Enabled for students after save" : "Hidden from students"}</span><div><button type="button" className="admin-btn outline" onClick={() => { const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; setFlashes(current => [...current, { ...f, id, enabled: false, announcedAt: undefined }]); setExpandedId(id); setFilter("all"); }}><Copy size={14} /> Duplicate draft</button><button type="button" className="admin-btn danger" onClick={() => { if (window.confirm("Remove this feedback flash? Save the scheduler to apply the removal.")) setFlashes(current => current.filter(item => item.id !== f.id)); }}><Trash2 size={14} /> Remove</button></div></div>
              </div>}
            </article>
          );
        })}
        {visible.length === 0 && <div className="ff-empty"><MessageSquare size={26} /><strong>{filter === "all" ? "No feedback flashes yet" : `No ${filter} flashes`}</strong><p>{filter === "all" ? "Create a flash to schedule course feedback reminders." : "Choose another status to see more flashes."}</p>{filter === "all" && <button type="button" className="admin-btn primary" onClick={add}><Plus size={15} /> New flash</button>}</div>}
      </div>
      <div className="ff-save"><p><Check size={15} /> Review the deadline, subject, and section before saving. Enabled flashes can appear to matching students immediately.</p><button type="button" className="admin-btn primary" onClick={save} disabled={saving}><Save size={15} /> {saving ? "Saving…" : "Save scheduler"}</button></div>
      {saveMsg && <p className="ff-save-message" role="status">{saveMsg}</p>}
      {preview && <FeedbackFlashToast config={{ deadline: preview.deadline, link: preview.link, subjectName: legend[preview.subjectCode]?.name || null }} onClose={() => setPreviewId(null)} />}
    </section>
  );
}
