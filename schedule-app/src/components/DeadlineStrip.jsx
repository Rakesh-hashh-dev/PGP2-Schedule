import { useMemo } from "react";
import { CalendarClock, GraduationCap, BookOpenCheck, ChevronRight } from "lucide-react";
import { upcomingDeadlines, ymd } from "../lib/insights.js";
import { subjectClass } from "../lib/subjectColors.js";
import "../styles/deadlines.css";

function relLabel(iso, todayISO, tomorrowISO) {
  if (iso === todayISO) return "Today";
  if (iso === tomorrowISO) return "Tomorrow";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

// Compact horizontal strip of the next few exams + assignment deadlines.
// Shown above today's timeline. Tapping "Assignments"/"Exams" jumps to the
// full panel via the parent-provided handlers.
export default function DeadlineStrip({ visible, legend, now, onOpenAssignments, onOpenExams }) {
  const todayISO = ymd(now);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = ymd(tomorrow);

  const items = useMemo(() => upcomingDeadlines(visible, legend, now, 7), [visible, legend, now]);

  if (items.length === 0) return null;

  return (
    <section className="dl-strip" aria-label="Upcoming deadlines">
      <div className="dl-strip-head">
        <span className="dl-strip-title"><CalendarClock size={14} /> Next 7 days</span>
        <span className="dl-strip-count">{items.length}</span>
      </div>
      <div className="dl-strip-rail">
        {items.slice(0, 8).map((it) => {
          const Icon = it.kind === "exam" ? GraduationCap : BookOpenCheck;
          const open = it.kind === "exam" ? onOpenExams : onOpenAssignments;
          const rel = relLabel(it.date, todayISO, tomorrowISO);
          const soon = it.date === todayISO || it.date === tomorrowISO;
          return (
            <button
              key={it.key}
              type="button"
              className={`dl-item dl-${it.kind} ${subjectClass(it.code)}${soon ? " is-soon" : ""}`}
              onClick={open}
            >
              <span className="dl-item-top">
                <span className="dl-item-ico"><Icon size={13} /></span>
                <span className="dl-item-code">{it.code}</span>
                <span className={`dl-item-when${soon ? " is-soon" : ""}`}>{rel}</span>
              </span>
              <span className="dl-item-title">{it.title}</span>
              <span className="dl-item-sub">
                {it.kind === "exam" ? (it.time ? `Exam · ${it.time}` : "Exam") : "Assignment due"}
              </span>
            </button>
          );
        })}
        {onOpenAssignments && (
          <button type="button" className="dl-item dl-more" onClick={onOpenAssignments}>
            <ChevronRight size={18} />
            <span>All</span>
          </button>
        )}
      </div>
    </section>
  );
}
