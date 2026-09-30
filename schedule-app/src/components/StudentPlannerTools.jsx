import { useMemo, useState } from "react";
import {
  BriefcaseBusiness, CalendarSync, Check, ClipboardList, Cloud, CloudOff, Copy,
  Download, Link2, MapPin, Plus, RefreshCw, Trash2, Users,
} from "lucide-react";
import {
  DEFAULT_CALENDAR_PREFS, TOOLKIT_KEYS, buildLocalBackup,
  calendarSubscriptionUrl, careerSummary, offlineInventory, readToolkitValue,
  upcomingStudySessions, writeToolkitValue,
} from "../lib/studentToolkit.js";
import "../styles/student-toolkit.css";

const STAGES = ["interested", "applying", "applied", "shortlisted", "interview", "offered", "rejected", "withdrawn"];
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

function useStoredList(key) {
  const [value, setValueState] = useState(() => readToolkitValue(key, []));
  const setValue = updater => setValueState(current => {
    const next = typeof updater === "function" ? updater(current) : updater;
    writeToolkitValue(key, next);
    return next;
  });
  return [value, setValue];
}

function Empty({ children }) {
  return <div className="toolkit-empty"><Check size={19} /><span>{children}</span></div>;
}

export function CareerPlanner({ onNavigate }) {
  const [items, setItems] = useStoredList(TOOLKIT_KEYS.careers);
  const [draft, setDraft] = useState({ company: "", role: "", deadline: "", stage: "interested", resume: "", url: "", notes: "" });
  const summary = useMemo(() => careerSummary(items), [items]);
  const submit = event => {
    event.preventDefault();
    if (!draft.company.trim() || !draft.role.trim()) return;
    setItems(current => [{ ...draft, id: uid("career"), createdAt: new Date().toISOString() }, ...current]);
    setDraft({ company: "", role: "", deadline: "", stage: "interested", resume: "", url: "", notes: "" });
  };
  const patch = (id, change) => setItems(current => current.map(item => item.id === id ? { ...item, ...change, updatedAt: new Date().toISOString() } : item));
  return <div className="toolkit-stack">
    <div className="toolkit-metrics"><div><span>Tracked</span><strong>{summary.total}</strong></div><div><span>Active</span><strong>{summary.active}</strong></div><div><span>Offers</span><strong>{summary.offered}</strong></div><div><span>Next deadline</span><strong>{summary.next?.deadline || "—"}</strong></div></div>
    <section className="toolkit-card">
      <div className="toolkit-card-head"><div><span>PLACEMENT PIPELINE</span><h2>Add an opportunity</h2></div><BriefcaseBusiness size={20} /></div>
      <form className="toolkit-form toolkit-form-career" onSubmit={submit}>
        <label>Company<input value={draft.company} onChange={e => setDraft({ ...draft, company: e.target.value })} placeholder="Company name" required /></label>
        <label>Role<input value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })} placeholder="Role or programme" required /></label>
        <label>Deadline<input type="date" value={draft.deadline} onChange={e => setDraft({ ...draft, deadline: e.target.value })} /></label>
        <label>Stage<select value={draft.stage} onChange={e => setDraft({ ...draft, stage: e.target.value })}>{STAGES.map(stage => <option key={stage}>{stage}</option>)}</select></label>
        <label>Resume version<input value={draft.resume} onChange={e => setDraft({ ...draft, resume: e.target.value })} placeholder="PM-v3.pdf" /></label>
        <label>Application link<input type="url" value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" /></label>
        <label className="toolkit-span">Preparation notes<textarea rows="2" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="JD themes, interview preparation, contact…" /></label>
        <button className="toolkit-primary" type="submit"><Plus size={15} /> Add opportunity</button>
      </form>
    </section>
    <section className="toolkit-card">
      <div className="toolkit-card-head"><div><span>APPLICATIONS</span><h2>Your private tracker</h2></div><small>Stored on this device</small></div>
      {items.length ? <div className="toolkit-list">{items.map(item => <article className="toolkit-row" key={item.id}>
        <span className={`toolkit-status is-${item.stage}`} />
        <div className="toolkit-row-main"><strong>{item.company} · {item.role}</strong><small>{item.deadline ? `Deadline ${item.deadline}` : "No deadline"}{item.resume ? ` · ${item.resume}` : ""}</small>{item.notes && <p>{item.notes}</p>}</div>
        <select aria-label={`Stage for ${item.company}`} value={item.stage} onChange={e => patch(item.id, { stage: e.target.value })}>{STAGES.map(stage => <option key={stage}>{stage}</option>)}</select>
        {item.url && <a href={item.url} target="_blank" rel="noreferrer">Open</a>}
        <button className="toolkit-icon-btn" aria-label={`Delete ${item.company}`} onClick={() => setItems(current => current.filter(row => row.id !== item.id))}><Trash2 size={15} /></button>
      </article>)}</div> : <Empty>Add companies as their application windows open.</Empty>}
      <button className="toolkit-link" onClick={() => onNavigate?.("assignments")}>Open application-related tasks</button>
    </section>
  </div>;
}

export function SmartCalendar({ enrolled = {} }) {
  const codes = Object.keys(enrolled);
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_CALENDAR_PREFS, selectedCodes: codes, ...readToolkitValue(TOOLKIT_KEYS.calendar, {}) }));
  const [copied, setCopied] = useState(false);
  const save = change => { const next = { ...prefs, ...change }; setPrefs(next); writeToolkitValue(TOOLKIT_KEYS.calendar, next); };
  const url = calendarSubscriptionUrl(typeof location === "undefined" ? "https://pgp2.termflow.tech" : location.origin, enrolled, prefs);
  const webcal = url.replace(/^https?:/, "webcal:");
  const copy = async () => { await navigator.clipboard.writeText(webcal); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const toggleCode = code => save({ selectedCodes: prefs.selectedCodes.includes(code) ? prefs.selectedCodes.filter(value => value !== code) : [...prefs.selectedCodes, code] });
  return <div className="toolkit-stack">
    <section className="toolkit-card toolkit-calendar-hero">
      <div className="toolkit-card-head"><div><span>LIVE CALENDAR</span><h2>Subscribe once, receive timetable updates</h2><p>The feed contains course and section preferences, but no name or email.</p></div><CalendarSync size={22} /></div>
      <div className="toolkit-calendar-actions"><a className="toolkit-primary" href={webcal}><Link2 size={15} /> Subscribe</a><button onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy link"}</button></div>
      <code className="toolkit-url">{webcal}</code>
    </section>
    <section className="toolkit-card">
      <div className="toolkit-card-head"><div><span>REMINDER PROFILE</span><h2>Choose what reaches your calendar</h2></div></div>
      <div className="toolkit-options">
        <label><input type="checkbox" checked={prefs.includeClasses} onChange={e => save({ includeClasses: e.target.checked })} /> Classes</label>
        <label><input type="checkbox" checked={prefs.includeExams} onChange={e => save({ includeExams: e.target.checked })} /> Exams</label>
        <label><input type="checkbox" checked={prefs.notifyChanges} onChange={e => save({ notifyChanges: e.target.checked })} /> Highlight schedule changes in TermFlow</label>
        <label>Calendar reminder<select value={prefs.reminderMinutes} onChange={e => save({ reminderMinutes: Number(e.target.value) })}><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></label>
        <label>Daily review time<input type="time" value={prefs.digestTime} onChange={e => save({ digestTime: e.target.value })} /></label>
      </div>
      <div className="toolkit-course-pills">{codes.map(code => <button key={code} aria-pressed={prefs.selectedCodes.includes(code)} className={prefs.selectedCodes.includes(code) ? "is-active" : ""} onClick={() => toggleCode(code)}>{code}</button>)}</div>
      <small>Calendar applications decide how often subscription feeds refresh. TermFlow cannot force an immediate refresh in Google, Apple, or Outlook Calendar.</small>
    </section>
  </div>;
}

export function StudyPlanner({ enrolled = {} }) {
  const [items, setItems] = useStoredList(TOOLKIT_KEYS.study);
  const [draft, setDraft] = useState({ title: "", course: Object.keys(enrolled)[0] || "", date: todayISO(), time: "18:00", duration: 60, location: "", agenda: "", participants: "" });
  const upcoming = useMemo(() => upcomingStudySessions(items), [items]);
  const submit = event => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.date) return;
    setItems(current => [...current, { ...draft, id: uid("study"), status: "planned", createdAt: new Date().toISOString() }]);
    setDraft({ ...draft, title: "", agenda: "", participants: "" });
  };
  return <div className="toolkit-stack">
    <section className="toolkit-card">
      <div className="toolkit-card-head"><div><span>STUDY GROUPS</span><h2>Plan a focused session</h2></div><Users size={21} /></div>
      <form className="toolkit-form toolkit-study-form" onSubmit={submit}>
        <label>Session name<input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="CRM case discussion" required /></label>
        <label>Course<select value={draft.course} onChange={e => setDraft({ ...draft, course: e.target.value })}>{Object.keys(enrolled).map(code => <option key={code}>{code}</option>)}</select></label>
        <label>Date<input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} required /></label>
        <label>Start<input type="time" value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} /></label>
        <label>Duration<select value={draft.duration} onChange={e => setDraft({ ...draft, duration: Number(e.target.value) })}><option value="30">30 min</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></label>
        <label>Location<input value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} placeholder="Library / Meet link" /></label>
        <label className="toolkit-span">Participants<input value={draft.participants} onChange={e => setDraft({ ...draft, participants: e.target.value })} placeholder="Names or group" /></label>
        <label className="toolkit-span">Agenda<textarea rows="2" value={draft.agenda} onChange={e => setDraft({ ...draft, agenda: e.target.value })} placeholder="Cases, chapters, questions…" /></label>
        <button className="toolkit-primary" type="submit"><Plus size={15} /> Plan session</button>
      </form>
    </section>
    <section className="toolkit-card">
      <div className="toolkit-card-head"><div><span>UPCOMING</span><h2>Study plan</h2></div><ClipboardList size={20} /></div>
      {upcoming.length ? <div className="toolkit-list">{upcoming.map(item => <article className={`toolkit-row${item.past ? " is-past" : ""}`} key={item.id}>
        <span className="toolkit-date"><b>{item.date?.slice(8)}</b><small>{item.date?.slice(5, 7)}</small></span>
        <div className="toolkit-row-main"><strong>{item.title}</strong><small>{item.course}{item.time ? ` · ${item.time}` : ""} · {item.duration} min</small>{item.location && <p><MapPin size={12} /> {item.location}</p>}{item.agenda && <p>{item.agenda}</p>}</div>
        <button onClick={() => setItems(current => current.map(row => row.id === item.id ? { ...row, status: "done" } : row))}><Check size={15} /> Done</button>
        <button className="toolkit-icon-btn" aria-label={`Delete ${item.title}`} onClick={() => setItems(current => current.filter(row => row.id !== item.id))}><Trash2 size={15} /></button>
      </article>)}</div> : <Empty>No study sessions planned.</Empty>}
    </section>
  </div>;
}

export function OfflineSyncCenter({ isOffline, syncing, syncedAgo, onSync }) {
  const [, setNonce] = useState(0);
  const inventory = offlineInventory();
  const present = inventory.filter(item => item.present);
  const queued = inventory.find(item => item.key === "pgp2.split.queue")?.count || 0;
  const bytes = present.reduce((sum, item) => sum + item.bytes, 0);
  const download = () => {
    const backup = buildLocalBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href; anchor.download = `termflow-backup-${todayISO()}.json`; anchor.click();
    URL.revokeObjectURL(href);
  };
  return <div className="toolkit-stack">
    <section className={`toolkit-sync-hero${isOffline ? " is-offline" : ""}`}>
      {isOffline ? <CloudOff size={28} /> : <Cloud size={28} />}
      <div><span>{isOffline ? "Offline mode" : syncing ? "Refreshing" : "Connected"}</span><strong>{isOffline ? "Local academic data remains available." : `Last global refresh ${syncedAgo === 0 ? "just now" : `${syncedAgo}m ago`}.`}</strong></div>
      <button disabled={isOffline || syncing} onClick={onSync}><RefreshCw className={syncing ? "spin-icon" : ""} size={15} /> Retry sync</button>
    </section>
    <div className="toolkit-metrics"><div><span>Local stores</span><strong>{present.length}</strong></div><div><span>Queued writes</span><strong>{queued}</strong></div><div><span>Backup size</span><strong>{Math.max(1, Math.round(bytes / 1024))} KB</strong></div><div><span>Conflicts</span><strong>0 known</strong></div></div>
    <section className="toolkit-card">
      <div className="toolkit-card-head"><div><span>DEVICE DATA</span><h2>Offline inventory</h2></div><button onClick={() => setNonce(value => value + 1)}><RefreshCw size={14} /> Rescan</button></div>
      <div className="toolkit-list">{inventory.map(item => <div className="toolkit-row" key={item.key}><span className={`toolkit-sync-dot${item.present ? " is-present" : ""}`} /><div className="toolkit-row-main"><strong>{item.key.replace("pgp2.", "")}</strong><small>{item.present ? `${item.count} record group${item.count === 1 ? "" : "s"} · ${item.bytes} bytes` : "No local data"}</small></div><span>{item.present ? "Available offline" : "Empty"}</span></div>)}</div>
      <div className="toolkit-footer-actions"><button className="toolkit-primary" onClick={download}><Download size={15} /> Export private backup</button></div>
      <small>The backup stays on your device. It contains the listed local academic data and should be handled as private.</small>
    </section>
  </div>;
}
