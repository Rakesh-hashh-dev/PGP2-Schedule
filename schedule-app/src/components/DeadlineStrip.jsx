import { useMemo } from "react";
import { CalendarClock, ChevronRight, GraduationCap, BookOpenCheck } from "lucide-react";
import { upcomingDeadlines, ymd } from "../lib/insights.js";
import { subjectClass } from "../lib/subjectColors.js";
import "../styles/deadlines.css";

function relLabel(iso, todayISO, tomorrowISO) {
  if (iso === todayISO) return "Today";
  if (iso === tomorrowISO) return "Tomorrow";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

// A stack of single-line rows for the next few exams + assignment deadlines —
// same "banner" language as the Tomorrow tab's UP NEXT card, so it reads as
// one family of components rather than a separate widget. Shown at the
// bottom of the Tomorrow page; tapping a row jumps to Exams/Assignments.
export default function DeadlineStrip({ visible, legend, now, onOpenAssignments, onOpenExams }) {
  const todayISO = ymd(now);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = ymd(tomorrow);

  const items = useMemo(() => upcomingDeadlines(visible, legend, now, 7), [visible, legend, now]);

  if (items.length === 0) return null;

  const shown = items.slice(0, 4);
  const more = items.length - shown.length;

  return (
    <div className="dl-section-wrap">
      <section className="dl-strip" aria-label="Upcoming deadlines">
        <div className="dl-strip-head">
          <span className="dl-strip-ico"><CalendarClock size={13} /></span>
          <span className="dl-strip-title">Next 7 days</span>
          <span className="dl-strip-count">{items.length}</span>
        </div>
        <div className="dl-strip-list">
          {shown.map((it) => {
            const Icon = it.kind === "exam" ? GraduationCap : BookOpenCheck;
            const open = it.kind === "exam" ? onOpenExams : onOpenAssignments;
            const rel = relLabel(it.date, todayISO, tomorrowISO);
            const soon = it.date === todayISO || it.date === tomorrowISO;
            return (
              <button
                key={it.key}
                type="button"
                className={`dl-row${soon ? " is-soon" : ""}`}
                onClick={open}
              >
                <span className="dl-row-ico"><Icon size={15} /></span>
                <span className="dl-row-body">
                  <span className="dl-row-top">
                    <span className="dl-row-label">{it.kind === "exam" ? "Exam" : "Due"}</span>
                    <span className={`ses ${subjectClass(it.code)}`}>{it.code}</span>
                  </span>
                  <span className="dl-row-text">{it.title}</span>
                </span>
                <span className="dl-row-meta">
                  {it.kind === "exam" && it.time && <span className="dl-row-time">{it.time}</span>}
                  <span className={`dl-row-when${soon ? " is-soon" : ""}`}>{rel}</span>
                </span>
                <ChevronRight size={16} className="dl-row-go" aria-hidden="true" />
              </button>
            );
          })}
          {more > 0 && onOpenAssignments && (
            <button type="button" className="dl-row dl-row-more" onClick={onOpenAssignments}>
              <span className="dl-row-more-text">{more} more in the next 7 days</span>
              <ChevronRight size={15} className="dl-row-go" aria-hidden="true" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
