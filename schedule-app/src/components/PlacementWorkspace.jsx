import { useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarClock, Check, ExternalLink, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { createPlacement, filterPlacements, loadPlacements, placementStats, PLACEMENT_STAGES, savePlacements } from "../lib/placements.js";
import { safeUrl } from "../lib/safeUrl.js";
import "../styles/placements.css";

const EMPTY_FORM = { company: "", role: "", stage: "saved", deadline: "", link: "", notes: "" };
const STAGE_LABEL = { saved: "Saved", applied: "Applied", shortlisted: "Shortlisted", interview: "Interview", offer: "Offer", closed: "Closed" };

function dateLabel(value) {
  if (!value) return "No deadline";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { day: "numeric", month: "short" });
}

export default function PlacementWorkspace({ userId }) {
  const [items, setItems] = useState(() => loadPlacements(userId));
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [form, setForm] = useState(null);
  const stats = useMemo(() => placementStats(items), [items]);
  const visible = useMemo(() => filterPlacements(items, query, stage).sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || b.updatedAt - a.updatedAt), [items, query, stage]);

  const commit = (next) => { setItems(next); savePlacements(userId, next); };
  const save = () => {
    if (!form.company.trim() || !form.role.trim()) return;
    if (form.id) commit(items.map((item) => item.id === form.id ? { ...item, ...form, updatedAt: Date.now() } : item));
    else commit([createPlacement(form), ...items]);
    setForm(null);
  };
  const remove = (id) => commit(items.filter((item) => item.id !== id));
  const move = (item, nextStage) => commit(items.map((row) => row.id === item.id ? { ...row, stage: nextStage, updatedAt: Date.now() } : row));

  return <div className="placement-page">
    <header className="placement-head">
      <div><span><BriefcaseBusiness size={14} /> CAREER PIPELINE</span><h1>Placement workspace</h1><p>Track applications, deadlines, interview rounds, and preparation notes in one private workspace.</p></div>
      <button onClick={() => setForm({ ...EMPTY_FORM })}><Plus size={16} /> Add opportunity</button>
    </header>

    <section className="placement-stats" aria-label="Placement pipeline summary">
      <div><span>Active</span><strong>{stats.active}</strong><small>open opportunities</small></div>
      <div><span>Next 7 days</span><strong>{stats.dueSoon}</strong><small>deadlines</small></div>
      <div><span>Interviews</span><strong>{stats.interviews}</strong><small>in preparation</small></div>
      <div><span>Offers</span><strong>{stats.offers}</strong><small>secured</small></div>
    </section>

    <div className="placement-toolbar">
      <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, role, or notes" /></label>
      <select value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Filter placement stage"><option value="all">All stages</option>{PLACEMENT_STAGES.map((value) => <option key={value} value={value}>{STAGE_LABEL[value]}</option>)}</select>
    </div>

    {visible.length ? <div className="placement-list">{visible.map((item) => {
      const href = safeUrl(item.link);
      return <article className="placement-card" key={item.id}>
        <div className="placement-card-main"><span className={`placement-stage is-${item.stage}`}>{STAGE_LABEL[item.stage]}</span><h2>{item.company}</h2><p>{item.role}</p>{item.notes && <small>{item.notes}</small>}</div>
        <div className="placement-card-meta"><span><CalendarClock size={14} /> {dateLabel(item.deadline)}</span>{href && <a href={href} target="_blank" rel="noopener noreferrer">Open listing <ExternalLink size={13} /></a>}</div>
        <div className="placement-card-actions">
          <select value={item.stage} onChange={(event) => move(item, event.target.value)} aria-label={`Stage for ${item.company}`}>{PLACEMENT_STAGES.map((value) => <option key={value} value={value}>{STAGE_LABEL[value]}</option>)}</select>
          <button aria-label={`Edit ${item.company}`} onClick={() => setForm({ ...item })}><Pencil size={14} /></button>
          <button className="is-danger" aria-label={`Remove ${item.company}`} onClick={() => remove(item.id)}><Trash2 size={14} /></button>
        </div>
      </article>;
    })}</div> : <div className="placement-empty"><BriefcaseBusiness size={28} /><strong>{items.length ? "No opportunities match" : "Build your placement pipeline"}</strong><span>{items.length ? "Try another search or stage." : "Add a role, its deadline, and the next step you need to prepare for."}</span><button onClick={() => items.length ? (setQuery(""), setStage("all")) : setForm({ ...EMPTY_FORM })}>{items.length ? "Clear filters" : "Add first opportunity"}</button></div>}

    {form && <div className="placement-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setForm(null)}><div className="placement-modal" role="dialog" aria-modal="true" aria-labelledby="placement-form-title">
      <div className="placement-modal-head"><div><span>OPPORTUNITY</span><h2 id="placement-form-title">{form.id ? "Edit application" : "Add to pipeline"}</h2></div><button onClick={() => setForm(null)} aria-label="Close placement form"><X size={18} /></button></div>
      <div className="placement-form-grid">
        <label>Company<input autoFocus value={form.company} maxLength={80} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Company name" /></label>
        <label>Role<input value={form.role} maxLength={100} onChange={(event) => setForm({ ...form, role: event.target.value })} placeholder="Role or programme" /></label>
        <label>Stage<select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>{PLACEMENT_STAGES.map((value) => <option key={value} value={value}>{STAGE_LABEL[value]}</option>)}</select></label>
        <label>Deadline<input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label>
        <label className="is-wide">Listing link<input type="url" value={form.link} onChange={(event) => setForm({ ...form, link: event.target.value })} placeholder="https://" /></label>
        <label className="is-wide">Preparation notes<textarea rows="4" value={form.notes} maxLength={2000} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Eligibility, interview rounds, people to contact, preparation plan…" /></label>
      </div>
      <div className="placement-modal-actions"><button onClick={() => setForm(null)}>Cancel</button><button className="is-primary" disabled={!form.company.trim() || !form.role.trim()} onClick={save}><Check size={15} /> Save opportunity</button></div>
    </div></div>}
  </div>;
}
