import { useState } from "react";
import { feedbackResponseSummary, RESPONSE_TARGET_OPTIONS } from "../lib/feedbackResponse.js";
import "../styles/feedback-response-tracking.css";

export default function FeedbackResponseTracking({ feedback = [], users = [], triage = {}, busyId, onSetTarget, readOnly, unavailable }) {
  const [showAll, setShowAll] = useState(false);
  const { rows, openAwaiting, overdue, queued, closedWithoutRecordedReply } = feedbackResponseSummary(feedback, triage);
  const visible = rows.filter(row => !row.response.closed && !row.response.hasReply)
    .sort((a, b) => Number(b.response.overdue) - Number(a.response.overdue) || (a.response.dueAt?.getTime() ?? Infinity) - (b.response.dueAt?.getTime() ?? Infinity));
  const displayed = showAll ? visible : visible.slice(0, 6);
  const names = new Map(users.map(user => [user.user_id, user.name || "Student"]));
  return <section className="admin-card admin-span-all admin-g-users frt-panel" aria-label="Feedback response tracking">
    <div className="frt-heading"><div><span className="frt-eyebrow">Feedback operations</span><h2>Response tracking</h2><p>Time since submission to the first admin reply queued for push. A queued push does not confirm delivery or reading.</p></div></div>
    {unavailable && <p className="frt-warning" role="alert">Response records are unavailable. Apply the feedback response tracking migration to save targets and reply queue times.</p>}
    <div className="frt-metrics"><div><strong>{openAwaiting}</strong><span>Awaiting a recorded reply</span></div><div className={overdue ? "frt-overdue" : ""}><strong>{overdue}</strong><span>Past response target</span></div><div><strong>{queued}</strong><span>First replies queued</span></div><div><strong>{closedWithoutRecordedReply}</strong><span>Closed, no reply recorded</span></div></div>
    <p className="frt-note">Target starts when feedback was submitted. Default: 48 hours. A previously queued reply is only counted when its timestamp was recorded.</p>
    {displayed.length ? <div className="frt-list">{displayed.map(({ item, response }) => <div className="frt-row" key={item.id}>
      <div><strong>{names.get(item.user_id) || "Student"}</strong><small>{response.ageHours === null ? "Submission time unavailable" : `${response.ageHours}h since submission`} · {response.overdue ? "Past target" : response.dueAt ? `Target ${response.dueAt.toLocaleString("en-IN")}` : "Target time unavailable"}</small></div>
      <label>Response target <select className="admin-input" value={response.targetHours} disabled={readOnly || unavailable || busyId === item.id || !onSetTarget} onChange={event => onSetTarget(item, Number(event.target.value))}>{RESPONSE_TARGET_OPTIONS.map(hours => <option key={hours} value={hours}>{hours < 24 ? `${hours} hours` : `${hours / 24} ${hours === 24 ? "day" : "days"}`}</option>)}</select></label>
    </div>)}</div> : <p className="frt-empty">No open feedback is awaiting a recorded reply.</p>}
    {visible.length > 6 && <button type="button" className="admin-btn outline" onClick={() => setShowAll(value => !value)}>{showAll ? "Show fewer" : `Show all ${visible.length}`}</button>}
  </section>;
}
