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

function IncidentTimestamp({ label, value }) {
  const date = value == null || value === "" ? null : new Date(value);
  if (!date || !Number.isFinite(date.getTime())) return <span className="aw-incident-time">{label}: Time unavailable</span>;
  return <span className="aw-incident-time">{label}: <time dateTime={date.toISOString()}>{date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })} IST</time></span>;
}

export function IncidentCenter({ snapshot, cronIssues, feedbackCount, feedback = [], handoffCount, pushFailure, pushFailureAt, notes = [], roster = [], readOnly, handoffUnavailable, onTrack, onNavigate }) {
  const lastSuccess = new Date(snapshot.lastSuccessTs || snapshot.ts || 0).getTime();
  const oldestCreatedAt = rows => rows.map(row => row.created_at).filter(value => value && Number.isFinite(new Date(value).getTime())).sort((a, b) => new Date(a) - new Date(b))[0];
  const incidents = [
    ...(snapshot.status !== "success" ? [{ key: "snapshot-failed", title: "Timetable snapshot failed", detail: snapshot.error || "Snapshot generation failed.", area: "system", severity: "error", timeLabel: "Last attempt", at: snapshot.ts }] : []),
    ...(Number.isFinite(lastSuccess) && QUEUE_NOW - lastSuccess > 3 * 86400000 ? [{ key: "snapshot-stale", title: "Timetable snapshot is stale", detail: "The last successful snapshot is more than three days old.", area: "system", severity: "warn", timeLabel: "Last success", at: snapshot.lastSuccessTs || snapshot.ts }] : []),
    ...cronIssues.map(issue => { const detail = typeof issue === "string" ? issue : issue.detail; return { key: `cron:${detail.slice(0, 180)}`, title: "Scheduled job needs attention", detail, area: "insights", severity: "error", timeLabel: "Last run", at: issue.lastRun }; }),
    ...(pushFailure ? [{ key: "browser-push-failure", title: "Latest push send failed in this browser", detail: pushFailure, area: "broadcast", severity: "error", timeLabel: "Failed at", at: pushFailureAt }] : []),
    ...(feedbackCount ? [{ key: "feedback-open", title: `${feedbackCount} open feedback reports`, detail: "Review owners and severity in the feedback queue.", area: "users", severity: "warn", timeLabel: "Oldest open report", at: oldestCreatedAt(feedback) }] : []),
    ...(handoffCount ? [{ key: "handoffs-open", title: `${handoffCount} open handoff notes`, detail: "Check next actions and review dates.", area: "overview", severity: "info", timeLabel: "Oldest open note", at: oldestCreatedAt(notes.filter(note => note.status === "open")) }] : []),
  ];
  return <section className="admin-card admin-span-all admin-g-overview aw-panel" aria-label="Incident center">
    <div className="aw-head"><div><span className="aw-eyebrow"><AlertTriangle size={13} /> Operations</span><h2>Incident center <small>{incidents.length}</small></h2><p>Current signals from the snapshot, scheduled jobs, feedback, and admin handoffs.</p></div></div>
    <div className="aw-list">{incidents.length ? incidents.map(item => {
      const followUp = notes.find(note => note.incident_key === item.key && note.status === "open");
      const owner = followUp?.owner_id && roster.find(admin => admin.user_id === followUp.owner_id);
      return <div className={`aw-issue is-${item.severity}`} key={item.key}><AlertTriangle size={16} /><div><strong>{item.title}</strong><span>{item.detail}</span><IncidentTimestamp label={item.timeLabel} value={item.at} />{followUp && <><span>Follow-up: {owner?.name || owner?.email || followUp.owner_id || "Unassigned"} · Next: {followUp.next_action}</span><IncidentTimestamp label="Tracked since" value={followUp.created_at} /></>}</div><div className="aw-actions"><button type="button" className="admin-btn outline" onClick={() => onNavigate(item.area)}>Open <ArrowRight size={13} /></button>{item.key !== "handoffs-open" && (followUp ? <button type="button" className="admin-btn outline" onClick={() => document.querySelector('[aria-label="Admin handoff notes"]')?.scrollIntoView({ behavior: "smooth", block: "start" })}>Follow-up</button> : !readOnly && !handoffUnavailable && <button type="button" className="admin-btn outline" onClick={() => onTrack(item)}>Track issue</button>)}</div></div>;
    }) : <div className="admin-empty">No incidents detected in the loaded signals.</div>}</div>
    <small>Push send errors here are from this browser session. Cron status is server reported. Refresh dashboard data to recheck remote signals.</small>
    {handoffUnavailable && !readOnly && <small>Issue follow-up links require the admin incident handoffs migration. General handoff notes remain available when their table is installed.</small>}
  </section>;
}

export function ChangeTimeline({ logs, onNavigate, compact = true }) {
  const entries = buildChangeTimeline(logs).slice(0, compact ? 20 : 30);
  return <section className={`admin-card ${compact ? "" : "admin-span-all"} admin-g-insights aw-panel ${compact ? "aw-panel--compact" : ""}`} aria-label="Change timeline">
    <div className={`aw-head ${compact ? "aw-head--compact" : ""}`}>
      <div>
        <span className="aw-eyebrow"><ClipboardList size={12} /> Accountability</span>
        <h2>Change timeline {compact && entries.length > 0 && <small>{entries.length}</small>}</h2>
        <p>{compact ? "Recent audited actions with direct links." : "Recent audited actions, linked to their Admin Tools workspace."}</p>
      </div>
    </div>
    <div className={`aw-list ${compact ? "aw-list--compact" : ""}`}>
      {entries.length ? entries.map(item => (
        <div className={`aw-issue ${compact ? "aw-issue--compact" : ""}`} key={item.id}>
          <span className="aw-icon-badge"><Activity size={compact ? 13 : 16} /></span>
          <div className="aw-issue-content">
            <strong>{item.action}</strong>
            <span>
              {item.object && <span className="aw-object-pill">{item.object}</span>}
              {item.actor} · {item.at ? (
                compact ? (
                  new Date(item.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " + new Date(item.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                ) : new Date(item.at).toLocaleString("en-IN")
              ) : "Time unavailable"}
            </span>
          </div>
          <button type="button" className={`admin-btn outline ${compact ? "aw-btn-compact" : ""}`} onClick={() => onNavigate(item)}>
            Open <ArrowRight size={compact ? 11 : 13} />
          </button>
        </div>
      )) : <div className="admin-empty">No audited actions loaded.</div>}
    </div>
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

export function AttendanceRisk({ rows, unavailable, coverageRows, coverageUnavailable, onNavigate, compact = true }) {
  const coverageReady = !coverageUnavailable && Array.isArray(coverageRows);
  return <section className={`admin-card ${compact ? "" : "admin-span-all"} admin-g-insights aw-panel ${compact ? "aw-panel--compact" : ""}`} aria-label="Attendance risk by course">
    <div className={`aw-head ${compact ? "aw-head--compact" : ""}`}>
      <div>
        <span className="aw-eyebrow"><BellRing size={12} /> Attendance</span>
        <h2>Self-mark coverage and watch {compact && coverageReady && coverageRows.length > 0 && <small>{coverageRows.length}</small>}</h2>
        <p>{compact ? "Course marks & watch signals (<80% with ≥3 marks)." : "Student-saved attendance marks by enrolled course and section. Below 80% is an early watch signal among students with at least three marks, not the course penalty rule or official attendance."}</p>
      </div>
    </div>
    {coverageUnavailable && <p className="aw-error" role="status">Self-mark coverage is unavailable. Deploy the admin attendance coverage migration to enable enrolled-student counts.</p>}
    {coverageReady ? (
      <div className={`aw-list ${compact ? "aw-list--compact" : ""}`}>
        {coverageRows.length ? coverageRows.map(row => {
          const enrolled = Number(row.enrolled_students) || 0;
          const marked = Number(row.students_with_marks) || 0;
          const missing = Number(row.students_without_marks) || 0;
          const eligible = Number(row.risk_eligible_students) || 0;
          const atRisk = Number(row.at_risk_students) || 0;
          const coverage = enrolled ? Math.round(marked / enrolled * 100) : 0;
          
          if (compact) {
            return (
              <div className="aw-issue aw-coverage-row aw-issue--compact" key={`${row.code}:${row.section}`}>
                <div className="aw-coverage-body">
                  <div className="aw-coverage-top">
                    <strong>{row.code} · Sec {row.section || "Single"}</strong>
                    <span className={`aw-rate-badge ${coverage >= 80 ? 'is-good' : coverage >= 50 ? 'is-mid' : 'is-low'}`}>{coverage}% coverage</span>
                  </div>
                  <div className="aw-mini-track">
                    <i style={{ width: `${Math.min(100, coverage)}%` }} className={coverage >= 80 ? 'is-good' : coverage >= 50 ? 'is-mid' : 'is-low'} />
                  </div>
                  <div className="aw-compact-stats">
                    <span><b>{marked}/{enrolled}</b> marked</span>
                    <span><b>{missing}</b> missing</span>
                    <span><b>{eligible}</b> eligible</span>
                    {atRisk > 0 ? (
                      <span className="aw-stat-risk"><b>{atRisk}</b> watch</span>
                    ) : (
                      <span className="aw-stat-ok">0 watch</span>
                    )}
                    {row.latest_marked_session && <span className="aw-stat-date">{row.latest_marked_session}</span>}
                  </div>
                </div>
                <button type="button" className="admin-btn outline aw-btn-compact" aria-label={`View users in ${row.code}, section ${row.section || "Single"}`} onClick={() => onNavigate(row)}>
                  View <ArrowRight size={11} />
                </button>
              </div>
            );
          }

          return (
            <div className="aw-issue aw-coverage-row" key={`${row.code}:${row.section}`}>
              <div className="aw-coverage-body"><strong>{row.code} · Section {row.section || "Single"}</strong><span>{marked === 0 ? "No saved marks" : missing === 0 ? "All enrolled students have a saved mark" : "Some students have no saved marks"}</span>
                <div className="aw-coverage-metrics"><span><b>{marked}/{enrolled}</b> with marks ({coverage}%)</span><span><b>{missing}</b> with no marks</span><span><b>{eligible}/{enrolled}</b> with three or more marks</span><span><b>{atRisk}/{eligible}</b> below 80% among eligible</span><span><b>{row.latest_marked_session || "—"}</b> latest marked class date</span></div>
              </div><button type="button" className="admin-btn outline" aria-label={`View users in ${row.code}, section ${row.section || "Single"}`} onClick={() => onNavigate(row)}>View users <ArrowRight size={13} /></button>
            </div>
          );
        }) : <div className="admin-empty">No enrolled course groups are available.</div>}
      </div>
    ) : coverageRows === null && !coverageUnavailable ? (
      <div className="admin-empty">Loading self-mark coverage…</div>
    ) : unavailable ? (
      <div className="admin-empty">Attendance watch is unavailable.</div>
    ) : (
      <div className={`aw-list ${compact ? "aw-list--compact" : ""}`}>
        {rows.length ? rows.map(row => (
          <div className={`aw-issue ${compact ? "aw-issue--compact" : ""}`} key={`${row.code}:${row.section}`}>
            <AlertTriangle size={compact ? 13 : 16} />
            <div>
              <strong>{row.code} · Section {row.section || "All"}</strong>
              <span>{row.at_risk} of {row.recorded_users} students with at least three marks are below 80%.</span>
            </div>
            <button type="button" className={`admin-btn outline ${compact ? "aw-btn-compact" : ""}`} onClick={() => onNavigate(row)}>
              View users <ArrowRight size={compact ? 11 : 13} />
            </button>
          </div>
        )) : <div className="admin-empty">No course groups are on the attendance watch. Coverage remains unavailable.</div>}
      </div>
    )}
    <small className="aw-footnote">{compact ? "Coverage means ≥1 student-saved mark. Date is latest class date." : "Coverage means at least one student-saved present or absent mark for that enrolled course. The latest date is the class date in a saved mark, not the time it was entered."}</small>
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
  const detail = item => item ? `${item.name || item.code || "Class"} · ${item.start || "?"}–${item.end || "?"} · ${item.room || "Room TBD"}` : `Cancelled${preview.cancellationVisibility === "hide" ? " · Hidden from schedule" : preview.cancellationVisibility === "show" ? " · Shown as cancelled" : ""}`;
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

export function HandoffNotes({ notes, roster, onSave, onClose, readOnly, unavailable, busy, prefill }) {
  const [draft, setDraft] = useState(() => ({ title: prefill?.title || "", detail: prefill?.detail || "", next_action: "", owner_id: "", expires_at: "", incident_key: prefill?.key || null }));
  const open = notes.filter(note => note.status === "open");
  const closed = notes.filter(note => note.status === "closed" && note.incident_key).slice(0, 8);
  const submit = async event => { event.preventDefault(); if (!draft.title.trim() || !draft.next_action.trim()) return; const ok = await onSave(draft); if (ok) setDraft({ title: "", detail: "", next_action: "", owner_id: "", expires_at: "", incident_key: null }); };
  return <section className="admin-card admin-span-all admin-g-overview aw-panel" aria-label="Admin handoff notes">
    <div className="aw-head"><div><span className="aw-eyebrow"><ClipboardList size={13} /> Admin coordination</span><h2>Handoff notes <small>{open.length} open</small></h2><p>Record an issue, its owner, and the next action for the next admin.</p></div></div>
    {unavailable && <p className="aw-error" role="alert">Private handoff storage is unavailable. Apply the admin workflows migration to use shared notes.</p>}
    {!readOnly && !unavailable && <form className="aw-note-form" onSubmit={submit}>{draft.incident_key && <small>Tracking: {draft.title}</small>}<input className="admin-input" aria-label="Handoff title" placeholder="Issue title" maxLength={160} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} required /><textarea className="admin-input" aria-label="Handoff context" placeholder="What happened?" rows={2} value={draft.detail} onChange={event => setDraft({ ...draft, detail: event.target.value })} /><input className="admin-input" aria-label="Next action" placeholder="Next action" maxLength={500} value={draft.next_action} onChange={event => setDraft({ ...draft, next_action: event.target.value })} required /><div className="aw-note-form-bottom"><label>Owner<select className="admin-input" value={draft.owner_id} onChange={event => setDraft({ ...draft, owner_id: event.target.value })}><option value="">Unassigned</option>{roster.map(admin => <option key={admin.user_id} value={admin.user_id}>{admin.name || admin.email || admin.user_id}</option>)}</select></label><label>Review by<input type="date" className="admin-input" value={draft.expires_at} onChange={event => setDraft({ ...draft, expires_at: event.target.value })} /></label><button type="submit" className="admin-btn primary" disabled={busy}>Add note</button></div></form>}
    <div className="aw-list">{open.length ? open.map(note => <article className="aw-note" key={note.id}><div><strong>{note.title}</strong><span>{note.owner_id ? `Owner: ${roster.find(admin => admin.user_id === note.owner_id)?.name || note.owner_id}` : "Unassigned"}{note.expires_at ? ` · Review by ${note.expires_at}` : ""}</span></div>{note.detail && <p>{note.detail}</p>}<p><b>Next:</b> {note.next_action}</p><div className="aw-actions"><small>Updated {new Date(note.updated_at).toLocaleString("en-IN")}</small>{!readOnly && <button type="button" className="admin-btn outline" disabled={busy} onClick={() => onClose(note)}>Mark complete</button>}</div></article>) : <div className="admin-empty">No open handoff notes.</div>}</div>
    {closed.length > 0 && <details className="aw-completed-incidents"><summary>Completed issue follow-ups ({closed.length})</summary><div className="aw-list">{closed.map(note => { const durationHours = Math.max(0, Math.round((new Date(note.resolved_at || note.updated_at) - new Date(note.created_at)) / 3600000)); return <div className="aw-note" key={note.id}><strong>{note.title}</strong><span>Tracked to completion in {durationHours < 24 ? `${durationHours} hours` : `${Math.round(durationHours / 24)} days`} · Completed {new Date(note.resolved_at || note.updated_at).toLocaleString("en-IN")}</span></div>; })}</div></details>}
  </section>;
}
