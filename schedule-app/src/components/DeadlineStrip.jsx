import { useId, useMemo, useState } from "react";
import { CalendarClock, ChevronRight, ChevronDown, GraduationCap, BookOpenCheck, Clock3, MapPin } from "lucide-react";
import { upcomingDeadlines, ymd } from "../lib/insights.js";
import { subjectClass } from "../lib/subjectColors.js";
import { fmtTime12 } from "../lib/datetime.js";
import "../styles/deadlines.css";

function relLabel(iso, todayISO, tomorrowISO) {
  if (iso === todayISO) return "Today";
  if (iso === tomorrowISO) return "Tomorrow";
  const date = new Date(iso + "T00:00:00");
  const days = Math.round((Date.parse(iso + "T12:00:00Z") - Date.parse(todayISO + "T12:00:00Z")) / 86400000);
  return `In ${days} days · ${date.toLocaleDateString([], { month: "short" })}`;
}

// Shared date-grouped agenda. Expanding stays here; opening an item retains
// its existing Exams/Assignments destination and enrollment-filtered data.
export default function DeadlineStrip({ visible, legend, now, onOpenAssignments, onOpenExams }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const todayISO = ymd(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = ymd(tomorrow);
  const items = useMemo(() => upcomingDeadlines(visible, legend, now, 7), [visible, legend, now]);

  if (items.length === 0) return null;

  const shown = expanded ? items : items.slice(0, 4);
  const groups = [];
  for (const item of shown) {
    const previous = groups[groups.length - 1];
    if (previous?.date === item.date) previous.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  const exams = items.filter(item => item.kind === "exam").length;
  const assignments = items.length - exams;
  const summary = [
    exams && `${exams} ${exams === 1 ? "exam" : "exams"}`,
    assignments && `${assignments} ${assignments === 1 ? "assignment" : "assignments"}`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="dl-section-wrap">
      <section className="dl-strip" aria-label="Upcoming deadlines">
        <header className="dl-strip-head">
          <span className="dl-strip-ico" aria-hidden="true"><CalendarClock size={19} /></span>
          <div className="dl-strip-heading">
            <h3 className="dl-strip-title">Next 7 days</h3>
            <p className="dl-strip-summary">{summary}</p>
          </div>
          <span className="dl-strip-count">{items.length} upcoming</span>
        </header>
        <div className="dl-strip-list" id={listId}>
          {groups.map(group => {
            const date = new Date(group.date + "T00:00:00");
            const soon = group.date === todayISO || group.date === tomorrowISO;
            return (
              <div className={`dl-date-group${soon ? " is-soon" : ""}`} key={group.date}>
                <time className="dl-date-tile" dateTime={group.date} aria-label={date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}>
                  <span>{date.toLocaleDateString([], { weekday: "short" })}</span>
                  <strong>{date.getDate()}</strong>
                </time>
                <div className="dl-date-content">
                  <div className="dl-date-label">{relLabel(group.date, todayISO, tomorrowISO)}</div>
                  <div className="dl-date-items">
                    {group.items.map(it => {
                      const Icon = it.kind === "exam" ? GraduationCap : BookOpenCheck;
                      const open = it.kind === "exam" ? onOpenExams : onOpenAssignments;
                      return (
                        <button key={it.key} type="button" className="dl-row" onClick={open} disabled={!open}>
                          <span className="dl-row-body">
                            <span className="dl-row-top">
                              <span className={`dl-row-label is-${it.kind}`}><Icon size={12} aria-hidden="true" />{it.kind === "exam" ? "Exam" : "Assignment"}</span>
                              <span className={`ses ${subjectClass(it.code)}`}>{it.code}</span>
                            </span>
                            <span className="dl-row-text">{it.kind === "exam" ? it.courseName : it.title}</span>
                            <span className="dl-row-description">{it.kind === "exam" ? it.title : it.courseName}</span>
                            <span className="dl-row-meta">
                              {it.time ? <span><Clock3 size={12} aria-hidden="true" />{fmtTime12(it.time)}</span> : <span>Due {group.date === todayISO ? "today" : group.date === tomorrowISO ? "tomorrow" : date.toLocaleDateString([], { month: "short", day: "numeric" })}</span>}
                              {it.room && <span><MapPin size={12} aria-hidden="true" />{it.room}</span>}
                            </span>
                          </span>
                          <ChevronRight size={16} className="dl-row-go" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {items.length > 4 && (
          <button type="button" className="dl-expand" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>
            {expanded ? "Show fewer deadlines" : `Show ${items.length - 4} more ${items.length - 4 === 1 ? "deadline" : "deadlines"}`}
            <ChevronDown size={15} aria-hidden="true" />
          </button>
        )}
      </section>
    </div>
  );
}
