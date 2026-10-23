import { useEffect, useMemo, useRef } from "react";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, MapPin, X } from "lucide-react";
import { loadAssignments } from "../lib/assignments.js";
import { sessionKey } from "../lib/attendance.js";
import { loadCourseHubItems } from "../lib/courseHubStore.js";
import { fmtTime12 } from "../lib/datetime.js";
import { sessionItems } from "../lib/premiumWorkflow.js";
import { safeUrl } from "../lib/safeUrl.js";
import "../styles/premium-workflow.css";
import { useBackClose } from "../lib/backClose.js";

function dateLabel(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}

export default function ClassPrepSheet({ session, termNumber, attendance = {}, onClose, onOpenCourse, onOpenTask, onOpenSchedule }) {
  useBackClose(onClose);
  const closeRef = useRef(null);
  const tasks = useMemo(() => (loadAssignments()[session.code] || []).filter((task) => !task.completed)
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")).slice(0, 3), [session]);
  const { prep, notes, links } = useMemo(() => sessionItems(session, loadCourseHubItems(), termNumber), [session, termNumber]);
  const mark = session.type === "class" ? attendance[sessionKey(session)] : null;

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return <div className="prep-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="prep-sheet" role="dialog" aria-modal="true" aria-labelledby="prep-title">
      <header className="prep-head">
        <div><span className="prep-kicker">CLASS PREP</span><h2 id="prep-title">{session.name}</h2><p>{session.code} · {dateLabel(session.date)}</p></div>
        <button ref={closeRef} type="button" className="prep-close" onClick={onClose} aria-label="Close class details"><X size={18} /></button>
      </header>
      <div className="prep-facts">
        <span><Clock3 size={16} /> {fmtTime12(session.start)}–{fmtTime12(session.end)}</span>
        <span><MapPin size={16} /> {session.room || "Room to be announced"}</span>
        {session.faculty && <span><BookOpen size={16} /> {session.faculty}</span>}
        {mark && <span><CheckCircle2 size={16} /> Marked {mark}</span>}
      </div>
      {session.session && <p className="prep-session">Session {session.session}</p>}
      <div className="prep-section"><h3>Before class</h3>
        {prep.length ? <ul>{prep.map((item) => <li key={item.id}>{item.done ? "✓ " : "○ "}{item.title}</li>)}</ul> : <p>No preparation items saved for this class.</p>}
      </div>
      <div className="prep-section"><h3>Related work</h3>
        {tasks.length ? <div className="prep-links">{tasks.map((task) => <button key={task.id} type="button" onClick={() => onOpenTask(session.code, task)}><span>{task.title || "Untitled assignment"}<small>{task.dueDate ? `Due ${task.dueDate}` : "No due date"}</small></span><ArrowRight size={15} /></button>)}</div> : <p>No open assignments for this course.</p>}
      </div>
      {(notes.length > 0 || links.length > 0) && <div className="prep-section"><h3>Notes and resources</h3>
        {notes.map((item) => <p key={item.id} className="prep-note">{item.details?.takeaway || item.details?.followUp || item.title}</p>)}
        {links.slice(0, 3).map((item) => { const href = safeUrl(item.url); return href ? <a key={item.id} href={href} target="_blank" rel="noopener noreferrer">{item.title} ↗</a> : null; })}
      </div>}
      <footer className="prep-actions">
        <button type="button" onClick={() => onOpenSchedule(session)}><CalendarDays size={15} /> Full schedule</button>
        <button type="button" className="prep-primary" onClick={() => onOpenCourse(session.code)}>Open course <ArrowRight size={15} /></button>
      </footer>
    </section>
  </div>;
}
