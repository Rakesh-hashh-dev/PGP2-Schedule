import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, CheckCircle2, CircleDashed, Clock, GraduationCap, MapPin, X, XCircle } from "lucide-react";
import { subjectClass } from "../../lib/subjectColors.js";
import { fmtTime12 } from "../../lib/datetime.js";

function hours(value) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}h`;
}

function CourseDetail({ course }) {
  const max = Math.max(1, ...course.weeks.map((week) => week.hours));
  return (
    <>
      <div className="wrapped-detail-hero">
        <span className={`ses ${subjectClass(course.code)}`}>{course.code}</span>
        <div><h2 id="wrapped-detail-title">{course.name}</h2><p>Course breakdown across completed sessions.</p></div>
      </div>
      <div className="wrapped-detail-metrics">
        <div><strong>{hours(course.hours)}</strong><span>classroom time</span></div>
        <div><strong>{course.held}</strong><span>sessions</span></div>
        <div><strong>{course.attendancePct == null ? "—" : `${course.attendancePct}%`}</strong><span>marked attendance</span></div>
        <div><strong>{course.coveragePct}%</strong><span>marking coverage</span></div>
      </div>
      <section className="wrapped-detail-section">
        <div className="wrapped-detail-section-head"><h3>Weekly workload</h3>{course.peakWeek && <span>Peak · {course.peakWeek.rangeLabel}</span>}</div>
        <div className="wrapped-detail-week-bars">
          {course.weeks.map((week) => (
            <div key={week.startISO}>
              <span>{week.rangeLabel}</span>
              <i><b style={{ width: `${(week.hours / max) * 100}%` }} /></i>
              <strong>{hours(week.hours)}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="wrapped-detail-section">
        <h3>Attendance evidence</h3>
        <div className="wrapped-detail-statuses">
          <span><CheckCircle2 size={15} /> Present <strong>{course.present}</strong></span>
          <span><XCircle size={15} /> Skipped <strong>{course.absent}</strong></span>
          <span><CircleDashed size={15} /> Unmarked <strong>{course.unmarked}</strong></span>
        </div>
      </section>
    </>
  );
}

function WeekDetail({ week }) {
  return (
    <>
      <div className="wrapped-detail-hero">
        <span className="wrapped-detail-icon"><CalendarDays size={19} /></span>
        <div><h2 id="wrapped-detail-title">{week.label}</h2><p>{week.rangeLabel}</p></div>
      </div>
      <div className="wrapped-detail-metrics">
        <div><strong>{hours(week.hours)}</strong><span>classroom time</span></div>
        <div><strong>{week.sessions}</strong><span>classes</span></div>
        <div><strong>{week.exams.length}</strong><span>exams</span></div>
        <div><strong>{week.busiestDay?.sessions || 0}</strong><span>classes on busiest day</span></div>
      </div>
      {week.busiestDay && <p className="wrapped-detail-highlight">Busiest day: {week.busiestDay.label} · {hours(week.busiestDay.hours)}</p>}
      <section className="wrapped-detail-section">
        <h3>What happened that week</h3>
        {week.events.length ? <div className="wrapped-detail-events">
          {week.events.map((event, index) => (
            <div key={`${event.date}-${event.start}-${event.code}-${index}`}>
              <span className={`wrapped-detail-event-icon${event.type === "exam" ? " is-exam" : ""}`}>
                {event.type === "exam" ? <GraduationCap size={15} /> : <Clock size={15} />}
              </span>
              <div>
                <strong>{event.code || event.name}</strong>
                <span>{new Date(`${event.date}T00:00:00`).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · {fmtTime12(event.start)}{event.end ? `–${fmtTime12(event.end)}` : ""}</span>
                {event.code && event.name !== event.code && <small>{event.name}</small>}
              </div>
              {event.room && <span className="wrapped-detail-room"><MapPin size={11} /> {event.room}</span>}
            </div>
          ))}
        </div> : <p className="wrapped-detail-empty">No completed classes or exams in this week.</p>}
      </section>
    </>
  );
}

export default function WrappedDetailModal({ detail, onClose }) {
  const modalRef = useRef(null);
  const closeRef = useRef(null);
  const closeModal = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!detail) return undefined;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeModal();
      if (event.key === "Tab") {
        const buttons = [...(modalRef.current?.querySelectorAll("button:not(:disabled)") || [])];
        if (!buttons.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detail, closeModal]);

  if (!detail) return null;
  return createPortal(
    <div className="wrapped-detail-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <section ref={modalRef} className="wrapped-detail-modal" role="dialog" aria-modal="true" aria-labelledby="wrapped-detail-title">
        <button ref={closeRef} type="button" className="wrapped-detail-close" onClick={closeModal} aria-label="Close details"><X size={18} /></button>
        {detail.type === "course" ? <CourseDetail course={detail.data} /> : <WeekDetail week={detail.data} />}
      </section>
    </div>,
    document.body,
  );
}
