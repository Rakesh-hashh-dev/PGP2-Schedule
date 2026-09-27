import { useState } from "react";
import { Activity, AlertTriangle, ArrowRight, BellRing, CalendarDays, Check, ClipboardList, MessageSquare, ShieldCheck, Users } from "lucide-react";
import { buildAdoptionTrend, buildChangeTimeline, buildDataQualityIssues, buildScheduleImpact, buildSupportQueue, feedbackState } from "../lib/adminWorkflow.js";
import snapshotMeta from "../data/snapshot-meta.json";
import "../styles/admin-workflows.css";

const QUEUE_NOW = Date.now();

export function BroadcastAudienceBuilder({ filter, onChange, result, courses, changesAvailable, onSave }) {
  const update = patch => onChange({ ...filter, ...patch });
  return <section className="aw-builder" aria-label="Broadcast audience builder">
    <div className="aw-preview-title"><Users size={16} /><strong>Audience builder</strong><span>Preview before send</span></div>
    <div className="aw-builder-fields">
      <label>Section<select className="admin-input" value={filter.section} onChange={event => update({ section: event.target.value })}><option value="">Any section</option><option value="A">Section A</option><option value="B">Section B</option></select></label>
      <label>Course<select className="admin-input" value={filter.course} onChange={event => update({ course: event.target.value })}><option value="">Any course</option>{courses.map(code => <option key={code} value={code}>{code}</option>)}</select></label>
      <label>Activity<select className="admin-input" value={filter.activity} onChange={event => update({ activity: event.target.value })}><option value="all">Any activity</option><option value="inactive">Inactive 14+ days</option><option value="incomplete">Setup incomplete</option></select></label>
      <label className="aw-check"><input type="checkbox" checked={filter.affected} disabled={!changesAvailable} onChange={event => update({ affected: event.target.checked })} /> Affected by staged schedule changes</label>
    </div>
    <div className="aw-builder-result"><strong>{result.ids.length} matching students</strong><span>{result.sample.length ? `Sample: ${result.sample.join(", ")}` : "No matching students"}</span><button type="button" className="admin-btn outline" onClick={onSave}>Save audience</button></div>
    <small>Recipients are selected from loaded profiles. Only students with subscribed devices receive push; sending remains a separate action.</small>
  </section>;
}

export function IncidentCenter({ snapshot, cronIssues, feedbackCount, handoffCount, pushFailure, onNavigate }) {
  const lastSuccess = new Date(snapshot.lastSuccessTs || snapshot.ts || 0).getTime();
  const incidents = [
    ...(snapshot.status !== "success" ? [{ title: "Timetable snapshot failed", detail: snapshot.error || "Snapshot generation failed.", area: "system", severity: "error" }] : []),
    ...(Number.isFinite(lastSuccess) && QUEUE_NOW - lastSuccess > 3 * 86400000 ? [{ title: "Timetable snapshot is stale", detail: `Last success: ${new Date(lastSuccess).toLocaleString("en-IN")}`, area: "system", severity: "warn" }] : []),
    ...cronIssues.map(detail => ({ title: "Scheduled job needs attention", detail, area: "insights", severity: "error" })),
    ...(pushFailure ? [{ title: "Latest push send failed in this browser", detail: pushFailure, area: "broadcast", severity: "error" }] : []),
    ...(feedbackCount ? [{ title: `${feedbackCount} open feedback reports`, detail: "Review owners and severity in the feedback queue.", area: "users", severity: "warn" }] : []),
    ...(handoffCount ? [{ title: `${handoffCount} open handoff notes`, detail: "Check next actions and review dates.", area: "overview", severity: "info" }] : []),
  ];
  return <section className="admin-card admin-span-all admin-g-overview aw-panel" aria-label="Incident center">
    <div className="aw-head"><div><span className="aw-eyebrow"><AlertTriangle size={13} /> Operations</span><h2>Incident center <small>{incidents.length}</small></h2><p>Current signals from the snapshot, scheduled jobs, feedback, and admin handoffs.</p></div></div>
    <div className="aw-list">{incidents.length ? incidents.map((item, index) => <div className={`aw-issue is-${item.severity}`} key={index}><AlertTriangle size={16} /><div><strong>{item.title}</strong><span>{item.detail}</span></div><button type="button" className="admin-btn outline" onClick={() => onNavigate(item.area)}>Open <ArrowRight size={13} /></button></div>) : <div className="admin-empty">No incidents detected in the loaded signals.</div>}</div>
    <small>Push send errors here are from this browser session. Cron status is server reported. Refresh dashboard data to recheck remote signals.</small>
  </section>;
}

export function ChangeTimeline({ logs, onNavigate }) {
  const entries = buildChangeTimeline(logs).slice(0, 30);
  return <section className="admin-card admin-span-all admin-g-insights aw-panel" aria-label="Change timeline">
    <div className="aw-head"><div><span className="aw-eyebrow"><ClipboardList size={13} /> Accountability</span><h2>Change timeline</h2><p>Recent audited actions, linked to their Admin Tools workspace.</p></div></div>
    <div className="aw-list">{entries.length ? entries.map(item => <div className="aw-issue" key={item.id}><Activity size={16} /><div><strong>{item.action}</strong><span>{item.object && `${item.object} · `}{item.actor} · {item.at ? new Date(item.at).toLocaleString("en-IN") : "Time unavailable"}</span></div><button type="button" className="admin-btn outline" onClick={() => onNavigate(item)}>Open <ArrowRight size={13} /></button></div>) : <div className="admin-empty">No audited actions loaded.</div>}</div>
  </section>;
}

export function ScheduleImpactWeek({ classes, overrides, announcements, today, onOpenDate }) {
  const impact = buildScheduleImpact(classes, overrides, announcements, today);
  return <section className="admin-card admin-span-all admin-g-schedule aw-panel" aria-label="Seven day schedule impact">
    <div className="aw-head"><div><span className="aw-eyebrow"><CalendarDays size={13} /> Forward view</span><h2>Next seven days</h2><p>Classes, loaded overrides, and active announcements through {impact.last}.</p></div></div>
    <div className="aw-week">{impact.days.map(day => <button type="button" key={day.date} onClick={() => onOpenDate(day.date)}><strong>{day.date}</strong><span>{day.classes} classes</span><small>{day.cancellations} cancelled · {day.roomChanges} rooms · {day.timeChanges} times</small><small>{day.announcements} announcements</small></button>)}</div>
    <small>Override counts reflect the currently loaded config, including changes staged locally.</small>
  </section>;
}

export function AdoptionTrends({ history, users, historyAvailable, features = [], featuresUnavailable = false }) {
  const observed = historyAvailable ? history : users.filter(user => user.last_seen_at).map(user => ({ user_id: user.user_id, activity_date: new Date(new Date(user.last_seen_at).getTime() + 330 * 60000).toISOString().slice(0, 10) }));
  const trend = buildAdoptionTrend(observed, users, QUEUE_NOW);
  const max = Math.max(1, ...trend.daily.map(day => day.active));
  return <section className="admin-card admin-span-all admin-g-insights aw-panel" aria-label="Adoption trends">
    <div className="aw-head"><div><span className="aw-eyebrow"><Activity size={13} /> Usage</span><h2>Adoption trends</h2><p>Student activity, current onboarding completion, and daily feature use where available.</p></div></div>
    {!historyAvailable && <p className="aw-error">Showing each student’s latest heartbeat only. Earlier days undercount until durable presence history is deployed.</p>}
    <div className="aw-trend-summary"><div><strong>{trend.current}</strong><span>active this week</span></div><div><strong>{trend.previous}</strong><span>active previous week</span></div><div><strong>{trend.completed}/{trend.total}</strong><span>course setup complete now</span></div></div><div className="aw-bars" role="img" aria-label="Daily active students over the last fourteen days">{trend.daily.map(day => <div key={day.date} title={`${day.date}: ${day.active} active`}><i style={{ height: `${Math.max(4, day.active / max * 100)}%` }} /><small>{day.date.slice(8)}</small></div>)}</div>
    {featuresUnavailable ? <p className="aw-error">Feature usage history is unavailable. Apply the feature usage migration to start collecting daily attendance marks, calendar exports, and announcement views.</p> : <div className="aw-feature-usage">{[["attendance_mark", "Attendance marking"], ["calendar_export", "Calendar exports"], ["announcements_view", "Announcements viewed"]].map(([key, label]) => {
      const current = features.filter(row => row.feature === key && row.activity_date >= trend.daily[7].date && row.activity_date <= trend.daily[13].date).reduce((sum, row) => sum + Number(row.users || 0), 0);
      const previous = features.filter(row => row.feature === key && row.activity_date >= trend.daily[0].date && row.activity_date < trend.daily[7].date).reduce((sum, row) => sum + Number(row.users || 0), 0);
      return <div key={key}><strong>{label}</strong><span>{current} student-days this week</span><small>{previous} previous week</small></div>;
    })}</div>}
    <small>Feature counts are daily unique student actions summed across each week; one student active on multiple days contributes multiple student-days.</small>
  </section>;
}

export function AttendanceRisk({ rows, unavailable, onNavigate }) {
  return <section className="admin-card admin-span-all admin-g-insights aw-panel" aria-label="Attendance risk by course">
    <div className="aw-head"><div><span className="aw-eyebrow"><BellRing size={13} /> Attendance</span><h2>Attendance watch by course</h2><p>Aggregate students below 80% of their recorded marks, with at least three marks. This is an early signal, not the course penalty rule.</p></div></div>
    {unavailable ? <div className="admin-empty">Admin attendance aggregate is unavailable. Apply the admin attendance risk migration to enable this view.</div> : <div className="aw-list">{rows.length ? rows.map(row => <div className="aw-issue" key={`${row.code}:${row.section}`}><AlertTriangle size={16} /><div><strong>{row.code} · Section {row.section || "All"}</strong><span>{row.at_risk} of {row.recorded_users} students with recorded marks below 80%</span></div><button type="button" className="admin-btn outline" onClick={() => onNavigate(row)}>Users <ArrowRight size={13} /></button></div>) : <div className="admin-empty">No course groups have recorded students below this watch threshold.</div>}</div>}
  </section>;
}

export function SupportQueue({ users, feedback, triage, onInspect, onFeedback }) {
  const [query, setQuery] = useState("");
  const [inactiveDays, setInactiveDays] = useState(14);
  const rows = buildSupportQueue(users, feedback, triage, QUEUE_NOW, inactiveDays);
  const shown = rows.filter(({ user, reasons }) => `${user.name} ${user.email} ${reasons.join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0, 50);
  return <section className="admin-card admin-span-all admin-g-users aw-panel" aria-label="Student support queue">
    <div className="aw-head"><div><span className="aw-eyebrow"><Users size={13} /> Student support</span><h2>Needs attention <small>{rows.length}</small></h2><p>Signals from setup, recent activity, and open feedback. Inspect before taking action.</p></div></div>
    <div className="aw-toolbar"><input className="admin-input" aria-label="Search support queue" placeholder="Search student or reason" value={query} onChange={event => setQuery(event.target.value)} /><label>Inactive after <select className="admin-input" value={inactiveDays} onChange={event => setInactiveDays(Number(event.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select></label></div>
    {shown.length ? <div className="aw-list">{shown.map(({ user, reasons, openFeedback }) => <div className="aw-row" key={user.user_id}><div><strong>{user.name || "Student"}</strong><span>{user.email || user.user_id}</span><div className="aw-tags">{reasons.map(reason => <small key={reason}>{reason}</small>)}</div></div><div className="aw-actions">{openFeedback > 0 && <button type="button" className="admin-btn outline" onClick={onFeedback}>Feedback</button>}<button type="button" className="admin-btn outline" onClick={() => onInspect(user)}>Inspect <ArrowRight size={13} /></button></div></div>)}</div> : <div className="admin-empty">No students match these signals.</div>}
    {rows.length > shown.length && <p className="aw-footnote">Showing the first {shown.length} of {rows.length} students. Refine the search to find others.</p>}
  </section>;
}

export function DataQualityMonitor({ classes, overrides, onOpenSchedule, onOpenSystem }) {
  const [filter, setFilter] = useState("all");
  const issues = buildDataQualityIssues(classes, overrides, snapshotMeta, QUEUE_NOW);
  const shown = issues.filter(issue => filter === "all" || issue.level === filter).slice(0, 60);
  return <section className="admin-card admin-span-all admin-g-schedule aw-panel" aria-label="Data quality monitor">
    <div className="aw-head"><div><span className="aw-eyebrow"><ShieldCheck size={13} /> Source quality</span><h2>Data quality monitor <small>{issues.length}</small></h2><p>Checks the bundled timetable, snapshot result, and staged overrides. Refresh the source to clear resolved issues.</p></div></div>
    <div className="aw-filters" role="group" aria-label="Filter data quality issues">{["all", "error", "warn", "info"].map(value => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "warn" ? "Warnings" : value === "error" ? "Errors" : "Info"}</button>)}</div>
    {shown.length ? <div className="aw-list">{shown.map(issue => <div className={`aw-issue is-${issue.level}`} key={issue.key}><AlertTriangle size={16} aria-hidden="true" /><div><strong>{issue.title}</strong><span>{issue.detail}</span></div><button type="button" className="admin-btn outline" onClick={() => issue.area === "system" ? onOpenSystem() : onOpenSchedule(issue.date)}>{issue.area === "system" ? "System" : "Schedule"} <ArrowRight size={13} /></button></div>)}</div> : <div className="admin-empty">No issues in this filter.</div>}
    {issues.length > shown.length && <p className="aw-footnote">Showing {shown.length} of {issues.length} issues.</p>}
  </section>;
}

export function ScheduleChangePreview({ preview, title = "Change preview" }) {
  if (!preview) return null;
  const before = preview.before;
  const after = preview.after;
  const detail = item => item ? `${item.name || item.code || "Class"} · ${item.start || "?"}–${item.end || "?"} · ${item.room || "Room TBD"}` : "Cancelled";
  return <section className="aw-preview" aria-label={title}>
    <div className="aw-preview-title"><ClipboardList size={16} /><strong>{title}</strong><span>Preview only</span></div>
    <div className="aw-before-after"><div><small>Before</small><span>{before ? detail(before) : "No existing class"}</span></div><ArrowRight size={16} aria-hidden="true" /><div><small>After</small><span>{detail(after)}</span></div></div>
    <p><strong>{preview.affected}</strong> potentially affected students · Section {preview.section} · {preview.date}</p>
    {preview.conflicts?.length ? <div className="aw-preview-warning"><AlertTriangle size={14} /> {preview.conflicts.length} possible clash{preview.conflicts.length === 1 ? "" : "es"}: {preview.conflicts.slice(0, 2).join("; ")}</div> : <div className="aw-preview-ok"><Check size={14} /> No new time clash found in the bundled schedule.</div>}
    <small>Audience count is based on selected courses in current profiles. Changes are staged until config deployment; no notification is sent automatically.</small>
  </section>;
}

export function FeedbackTriage({ feedback, users, triage, roster, busyId, onSave, onInspect, onReply, onWhatsNew, tags = {}, onToggleTag, readOnly, unavailable }) {
  const [filter, setFilter] = useState("open");
  const items = feedback.filter(item => filter === "all" || (filter === "open" ? !["resolved", "duplicate"].includes(feedbackState(item, triage).status) : feedbackState(item, triage).status === filter));
  return <section className="admin-card admin-g-users admin-users-feedback aw-panel" aria-label="Feedback triage">
    <div className="aw-head"><div><span className="aw-eyebrow"><MessageSquare size={13} /> Feedback</span><h2>Feedback triage <small>{items.length}</small></h2><p>Assign an owner, set severity, and track each report through resolution.</p></div></div>
    {unavailable && <p className="aw-error" role="alert">Private triage storage is unavailable. Apply the admin workflows migration to save assignments and statuses.</p>}
    <div className="aw-filters" role="group" aria-label="Filter feedback">{["open", "all", "pending", "investigating", "planned", "resolved", "duplicate"].map(value => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    <div className="aw-list">{items.length ? items.map(item => { const state = feedbackState(item, triage); const student = users.find(user => user.user_id === item.user_id); const disabled = readOnly || unavailable || busyId === item.id; const change = patch => onSave(item, { ...state, ...patch }); return <article className="aw-feedback" key={item.id}>
      <div className="aw-feedback-meta"><strong>{student?.name || "Student"}</strong><span>{new Date(item.created_at).toLocaleString("en-IN")}</span></div>
      <p>{item.message}</p>
      <div className="aw-fields"><label>Status<select className="admin-input" value={state.status} disabled={disabled} onChange={event => change({ status: event.target.value })}>{["pending", "investigating", "planned", "resolved", "duplicate"].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label><label>Severity<select className="admin-input" value={state.severity} disabled={disabled} onChange={event => change({ severity: event.target.value })}>{["low", "normal", "high"].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label><label>Owner<select className="admin-input" value={state.ownerId} disabled={disabled} onChange={event => change({ ownerId: event.target.value })}><option value="">Unassigned</option>{roster.map(admin => <option key={admin.user_id} value={admin.user_id}>{admin.name || admin.email || admin.user_id}</option>)}</select></label></div>
      <div className="aw-actions">{student && <button type="button" className="admin-btn outline" onClick={() => onInspect(student)}>Inspect</button>}{item.user_id && <button type="button" className="admin-btn outline" onClick={() => onReply(item, student)}>Reply</button>}<button type="button" className="admin-btn outline" onClick={() => onWhatsNew(item)}>To What’s New</button></div>
      <div className="aw-tags">{["bug", "idea", "dup", "wontfix"].map(tag => <button type="button" key={tag} className={`aw-tag-button${(tags[item.id] || []).includes(tag) ? " active" : ""}`} aria-pressed={(tags[item.id] || []).includes(tag)} disabled={readOnly} onClick={() => onToggleTag(item.id, tag)}>{tag}</button>)}<small>Tags are staged until config deployment.</small></div>
    </article>; }) : <div className="admin-empty">No feedback in this filter.</div>}</div>
  </section>;
}

export function HandoffNotes({ notes, roster, onSave, onClose, readOnly, unavailable, busy }) {
  const [draft, setDraft] = useState({ title: "", detail: "", next_action: "", owner_id: "", expires_at: "" });
  const open = notes.filter(note => note.status === "open");
  const submit = async event => { event.preventDefault(); if (!draft.title.trim() || !draft.next_action.trim()) return; const ok = await onSave(draft); if (ok) setDraft({ title: "", detail: "", next_action: "", owner_id: "", expires_at: "" }); };
  return <section className="admin-card admin-span-all admin-g-overview aw-panel" aria-label="Admin handoff notes">
    <div className="aw-head"><div><span className="aw-eyebrow"><ClipboardList size={13} /> Admin coordination</span><h2>Handoff notes <small>{open.length} open</small></h2><p>Record an issue, its owner, and the next action for the next admin.</p></div></div>
    {unavailable && <p className="aw-error" role="alert">Private handoff storage is unavailable. Apply the admin workflows migration to use shared notes.</p>}
    {!readOnly && !unavailable && <form className="aw-note-form" onSubmit={submit}><input className="admin-input" aria-label="Handoff title" placeholder="Issue title" maxLength={160} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} required /><textarea className="admin-input" aria-label="Handoff context" placeholder="What happened?" rows={2} value={draft.detail} onChange={event => setDraft({ ...draft, detail: event.target.value })} /><input className="admin-input" aria-label="Next action" placeholder="Next action" maxLength={500} value={draft.next_action} onChange={event => setDraft({ ...draft, next_action: event.target.value })} required /><div className="aw-note-form-bottom"><label>Owner<select className="admin-input" value={draft.owner_id} onChange={event => setDraft({ ...draft, owner_id: event.target.value })}><option value="">Unassigned</option>{roster.map(admin => <option key={admin.user_id} value={admin.user_id}>{admin.name || admin.email || admin.user_id}</option>)}</select></label><label>Review by<input type="date" className="admin-input" value={draft.expires_at} onChange={event => setDraft({ ...draft, expires_at: event.target.value })} /></label><button type="submit" className="admin-btn primary" disabled={busy}>Add note</button></div></form>}
    <div className="aw-list">{open.length ? open.map(note => <article className="aw-note" key={note.id}><div><strong>{note.title}</strong><span>{note.owner_id ? `Owner: ${roster.find(admin => admin.user_id === note.owner_id)?.name || note.owner_id}` : "Unassigned"}{note.expires_at ? ` · Review by ${note.expires_at}` : ""}</span></div>{note.detail && <p>{note.detail}</p>}<p><b>Next:</b> {note.next_action}</p><div className="aw-actions"><small>Updated {new Date(note.updated_at).toLocaleString("en-IN")}</small>{!readOnly && <button type="button" className="admin-btn outline" disabled={busy} onClick={() => onClose(note)}>Mark complete</button>}</div></article>) : <div className="admin-empty">No open handoff notes.</div>}</div>
  </section>;
}
