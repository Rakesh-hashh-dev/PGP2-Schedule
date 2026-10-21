import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, CalendarDays, ArrowRight, BarChart3, ChevronDown } from "lucide-react";
import WeekGlance from "./WeekGlance.jsx";
import { subjectClass, cleanSessionLabel } from "../lib/subjectColors.js";
import { isNationalHoliday } from "../lib/nationalHolidays.js";
import IndiaFlagIcon from "./IndiaFlagIcon.jsx";
import { CancellationStripe } from "./CancelledClassNotice.jsx";
import { fmtTime12 } from "../lib/datetime.js";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

// Desktop "peek at my week" modal, opened from the floating calendar button on
// the wide-content views (Friends / Admin / Week / Wrapped) where the docked
// WeekAgenda sidebar is hidden. Deliberately NOT a re-wrap of WeekAgenda: the
// sidebar panel brings its own card chrome and week nav, which in a dialog read
// as a card inside a card. Here the week nav *is* the dialog header.
export default function ScheduleModal({ visible, now, offset, setOffset, todayISO, onClose, onViewFullSchedule }) {
  // Week Stats stays where the reader left it, same as the sidebar's toggle.
  const [showStats, setShowStats] = useState(() => localStorage.getItem("sm-stats-closed") !== "1");
  const toggleStats = () => setShowStats((open) => {
    localStorage.setItem("sm-stats-closed", open ? "1" : "0");
    return !open;
  });

  const { days, label } = useMemo(() => {
    const monday = new Date(now);
    const dow = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - dow + offset * 7);
    monday.setHours(0, 0, 0, 0);

    const days = [...Array(7)].map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = ymd(d);
      const items = visible
        .filter((c) => c.date === iso)
        .sort((a, b) => toMin(a.start) - toMin(b.start));
      return { d, iso, items };
    });

    const label = `${monday.toLocaleDateString([], { day: "numeric", month: "short" })} – ${days[6].d.toLocaleDateString([], { day: "numeric", month: "short" })}`;

    return { days, label };
  }, [visible, now, offset]);

  const weekPulse = useMemo(() => {
    const classDays = days.map((day) => {
      const classes = day.items.filter((item) => item.type === "class");
      return { ...day, classCount: classes.length, classes };
    });
    const classCount = classDays.reduce((total, day) => total + day.classCount, 0);
    const studyDays = classDays.filter((day) => day.classCount > 0).length;
    const busiest = classDays.reduce((best, day) => day.classCount > best.classCount ? day : best, classDays[0]);
    const totalMin = classDays.flatMap((day) => day.classes)
      .reduce((acc, c) => acc + Math.max(0, toMin(c.end) - toMin(c.start)), 0);
    const hours = Math.round((totalMin / 60) * 10) / 10;
    // The collapsed row's whole job is to show the week's SHAPE, so the reader
    // can skip opening it. Counts per day drive the little bar strip.
    const counts = classDays.map((day) => day.classCount);
    return {
      classCount, studyDays, busiest, hours, counts,
      maxCount: Math.max(0, ...counts),
      todayIdx: days.findIndex((day) => day.iso === todayISO),
    };
  }, [days, todayISO]);

  // Lock the page behind the dialog: without this the wheel falls through to
  // the Friends/Admin page once the day list hits its end.
  useEffect(() => {
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, []);

  // Arrow keys page through weeks; Esc closes (the overlay click already does).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setOffset(offset - 1);
      else if (e.key === "ArrowRight") setOffset(offset + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offset, setOffset, onClose]);

  return (
    <div className="fs-modal-overlay hide-mobile" onClick={onClose}>
      <div className="sm-card" role="dialog" aria-modal="true" aria-label="Week schedule" onClick={(e) => e.stopPropagation()}>
        <header className="sm-head">
          <div className="sm-head-nav">
            <button className="sm-nav" onClick={() => setOffset(offset - 1)} aria-label="Previous week"><ChevronLeft size={17} /></button>
            <button className="sm-nav" onClick={() => setOffset(offset + 1)} aria-label="Next week"><ChevronRight size={17} /></button>
          </div>
          <div className="sm-head-t">
            <span className="sm-eyebrow"><CalendarDays size={12} /> Week schedule</span>
            <h3 className="sm-range">{label}</h3>
          </div>
          <div className="sm-head-r">
            {offset !== 0 && <button className="sm-today-btn" onClick={() => setOffset(0)}>This week</button>}
            <button className="sm-close" onClick={onClose} aria-label="Close"><X size={17} /></button>
          </div>
        </header>

        <div className="sm-days">
          {days.map(({ d, iso, items }) => {
            const isToday = iso === todayISO;
            const empty = items.length === 0;
            return (
              <button
                key={iso}
                type="button"
                className={`sm-day${isToday ? " is-today" : ""}${empty ? " is-empty" : ""}`}
                onClick={() => onViewFullSchedule(iso)}
                title="Open this day in the full schedule"
              >
                <span className="sm-date">
                  <span className="sm-dow">{d.toLocaleDateString([], { weekday: "short" })}</span>
                  <span className="sm-num">{d.getDate()}</span>
                </span>
                <span className="sm-items">
                  {empty ? (
                    <span className="sm-free">No classes</span>
                  ) : (
                    items.map((c, i) => (
                      <span key={i} className={`sm-item${c.type === "cancelled" ? " sm-cancelled" : ""}${c.type !== "class" ? " soft" : ""}${c.type === "break" ? " sm-break" : ""}`}>
                        <span className="sm-time">{fmtTime12(c.start)}</span>
                        <span className="sm-name">
                          {isNationalHoliday(c) && <IndiaFlagIcon size={13} className="row-flag-icon" />}
                          <span className={c.type === "cancelled" ? "cancelled-class-name" : undefined}>{c.name}</span>
                          {c.type === "cancelled" && <CancellationStripe compact />}
                          {c.session && <span className={`ses ${subjectClass(c.code)}`}>{c.code} {cleanSessionLabel(c.session)}</span>}
                        </span>
                        {c.type === "class" && c.room && <span className="sm-room">{c.room}</span>}
                      </span>
                    ))
                  )}
                </span>
                {isToday && <span className="sm-today-tag">Today</span>}
                <ArrowRight size={15} className="sm-go" />
              </button>
            );
          })}
        </div>

        <section className={`sm-stats${showStats ? " is-open" : ""}`} aria-label="Week statistics">
          <button
            className="sm-stats-toggle"
            onClick={toggleStats}
            aria-expanded={showStats}
            aria-label={`Week pulse: ${weekPulse.classCount} classes over ${weekPulse.studyDays} teaching days, about ${weekPulse.hours} hours`}
          >
            <span className="sm-stats-icon"><BarChart3 size={15} /></span>
            <span className="sm-stats-title">
              <strong>Week pulse</strong>
              <small>
                <b>{weekPulse.classCount}</b> {weekPulse.classCount === 1 ? "class" : "classes"}
                {weekPulse.hours > 0 && <> · ~{weekPulse.hours}h</>}
                {weekPulse.busiest?.classCount > 0 && (
                  <> · peak {weekPulse.busiest.d.toLocaleDateString([], { weekday: "short" })}</>
                )}
              </small>
            </span>
            {/* The pulse itself: the shape of the week, so the collapsed row
                says something the expanded card would otherwise have to. */}
            <span className="sm-pulse-strip" aria-hidden="true">
              {weekPulse.counts.map((n, i) => (
                <span
                  key={i}
                  className={`sm-pulse-bar${n === 0 ? " is-off" : ""}${i === weekPulse.todayIdx ? " is-today" : ""}`}
                  style={{ height: n === 0 ? "3px" : `${20 + Math.round((n / weekPulse.maxCount) * 80)}%` }}
                />
              ))}
            </span>
            <ChevronDown size={17} className="sm-stats-chev" />
          </button>
          {showStats && (
            <div className="sm-stats-body">
              <div className="sm-pulse-meta">
                <span>{weekPulse.studyDays ? `${weekPulse.studyDays} teaching ${weekPulse.studyDays === 1 ? "day" : "days"}` : "A free week"}</span>
                {weekPulse.busiest?.classCount > 0 && <span>Peak: {weekPulse.busiest.d.toLocaleDateString([], { weekday: "long" })}</span>}
              </div>
              <div className="sm-glance-frame">
                <WeekGlance visible={visible} now={now} offset={offset} todayISO={todayISO} variant="pulse" />
              </div>
            </div>
          )}
        </section>

        <footer className="sm-foot">
          <span className="sm-foot-hint">Click any day to open it in the full schedule</span>
          <button className="sm-foot-btn" onClick={() => onViewFullSchedule(days[0].iso)}>
            <CalendarDays size={15} /> Full schedule
          </button>
        </footer>
      </div>
    </div>
  );
}
