import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, CalendarClock, CheckCircle2, Clock, MoonStar, Sparkles, Sunrise } from "lucide-react";
import { loadAssignments } from "../lib/assignments.js";
import { flattenAssignments } from "../lib/studentPlanner.js";
import { clsDate, fmtTime12 } from "../lib/datetime.js";
import { sessionKey } from "../lib/attendance.js";
import "../styles/today-intelligence.css";

const LAST_VISIT_KEY = "pgp2.last-meaningful-visit";

function readLastVisit() {
  try { return Number(localStorage.getItem(LAST_VISIT_KEY)) || 0; } catch { return 0; }
}

function relativeVisit(value) {
  if (!value) return "your first visit on this device";
  const minutes = Math.max(1, Math.round((Date.now() - value) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString([], { day: "numeric", month: "short" });
}

export default function TodayIntelligence({ today = [], tomorrow = [], now, legend = {}, attendance = {}, changes = [], announcements = [], friendNotifications = [], onNavigate, onOpenChange }) {
  const [lastVisit] = useState(readLastVisit);
  const tasks = useMemo(() => flattenAssignments(loadAssignments(), legend, now), [legend, now]);
  const activeToday = today.filter((item) => item.type === "class" || item.type === "exam");
  const upcoming = activeToday.filter((item) => item.end && clsDate(item, "end") > now);
  const next = upcoming[0] || null;
  const tomorrowFirst = tomorrow.find((item) => item.type === "class" || item.type === "exam") || null;
  const urgentTasks = tasks.filter((task) => !task.completed && task.days != null && task.days <= 1).sort((a, b) => a.days - b.days);
  const unmarked = activeToday.filter((item) => item.end && clsDate(item, "end") <= now && !attendance[sessionKey(item)]).length;
  const newChanges = changes.filter((item) => {
    const timestamp = Number(item.ts) || new Date(item.ts || item.created_at || 0).getTime();
    return lastVisit && timestamp > lastVisit;
  });
  const newSocial = friendNotifications.filter((item) => !item.isRead && (!lastVisit || new Date(item.ts || 0).getTime() > lastVisit));
  const newAnnouncements = announcements.filter((item) => !lastVisit || new Date(`${item.start || "1970-01-01"}T00:00:00`).getTime() > lastVisit);
  const newCount = newChanges.length + newSocial.length + newAnnouncements.length;
  const isEvening = now.getHours() >= 17;

  useEffect(() => {
    const remember = () => { try { localStorage.setItem(LAST_VISIT_KEY, String(Date.now())); } catch { /* optional */ } };
    window.addEventListener("pagehide", remember);
    return () => { window.removeEventListener("pagehide", remember); remember(); };
  }, []);

  return <section className="today-intelligence" aria-label="Daily brief and return digest">
    <article className="today-brief-card">
      <div className="today-intel-head"><span>{isEvening ? <MoonStar size={15} /> : <Sunrise size={15} />}{isEvening ? "EVENING BRIEF" : "MORNING BRIEF"}</span><button onClick={() => onNavigate("planner")}>Open planner <ArrowRight size={13} /></button></div>
      <div className="today-brief-primary">
        <span className="today-brief-icon">{next ? <Clock size={18} /> : <CheckCircle2 size={18} />}</span>
        <div><strong>{next ? next.name || legend[next.code]?.name || next.code : isEvening ? "Academic day complete" : "No classes remaining"}</strong><small>{next ? `${fmtTime12(next.start)}–${fmtTime12(next.end)}${next.room ? ` · ${next.room}` : ""}` : tomorrowFirst ? `Tomorrow starts ${fmtTime12(tomorrowFirst.start)} · ${tomorrowFirst.name || tomorrowFirst.code}` : "Tomorrow is currently clear"}</small></div>
      </div>
      <div className="today-brief-metrics">
        <button onClick={() => onNavigate("fullSchedule")}><strong>{upcoming.length}</strong><span>sessions left</span></button>
        <button className={urgentTasks.length ? "is-warn" : ""} onClick={() => onNavigate("assignments")}><strong>{urgentTasks.length}</strong><span>urgent tasks</span></button>
        <button className={unmarked ? "is-warn" : ""} onClick={() => onNavigate("attendance")}><strong>{unmarked}</strong><span>to mark</span></button>
      </div>
    </article>

    <article className="return-digest-card">
      <div className="today-intel-head"><span><BellRing size={15} /> SINCE LAST VISIT</span><small>{relativeVisit(lastVisit)}</small></div>
      {newCount ? <>
        <strong>{newCount} new update{newCount === 1 ? "" : "s"}</strong>
        <div className="return-digest-list">
          {newChanges.slice(0, 2).map((item, index) => <button key={item.id || `${item.ts}-${index}`} onClick={() => onOpenChange?.(item)}><span className="is-change"><CalendarClock size={14} /></span><span><strong>{item.code || "Schedule"}</strong><small>{item.text || "Schedule updated"}</small></span><ArrowRight size={13} /></button>)}
          {!!newAnnouncements.length && <button onClick={() => onNavigate("notifications")}><span className="is-news"><BellRing size={14} /></span><span><strong>{newAnnouncements.length} announcement{newAnnouncements.length === 1 ? "" : "s"}</strong><small>Campus updates active now</small></span><ArrowRight size={13} /></button>}
          {!!newSocial.length && <button onClick={() => onNavigate("friends")}><span className="is-social"><Sparkles size={14} /></span><span><strong>{newSocial.length} social update{newSocial.length === 1 ? "" : "s"}</strong><small>Friends, groups, or invitations</small></span><ArrowRight size={13} /></button>}
        </div>
      </> : <div className="return-digest-clear"><CheckCircle2 size={21} /><span><strong>You’re caught up</strong><small>No new schedule, campus, or social updates since your last visit.</small></span></div>}
    </article>
  </section>;
}
