import { useMemo, useState } from "react";
import { BookOpen, User, MapPin, CalendarClock, Layers, GraduationCap, Search } from "lucide-react";
import { courseStats } from "../lib/insights.js";
import { subjectClass } from "../lib/subjectColors.js";
import { Card, Badge, EmptyState } from "./ui.jsx";
import "../styles/courses.css";

function prettyDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

function CourseCard({ c }) {
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  const att = c.skip?.pct;
  const skips = c.skip?.skipsRemaining;
  return (
    <Card className={`course-card ${subjectClass(c.code)}`}>
      <div className="course-card-head">
        <span className="course-code">{c.code}</span>
        {c.area && <Badge tone="neutral" className="course-area">{c.area}</Badge>}
        {c.credits != null && c.credits !== "" && (
          <span className="course-credits">{c.credits} cr</span>
        )}
      </div>
      <h3 className="course-name">{c.name}</h3>

      <div className="course-meta">
        {c.faculty.length > 0 && (
          <div className="course-meta-row"><User size={13} /><span>{c.faculty.join(", ")}</span></div>
        )}
        {c.rooms.length > 0 && (
          <div className="course-meta-row"><MapPin size={13} /><span>{c.rooms.join(" · ")}</span></div>
        )}
        {c.next ? (
          <div className="course-meta-row course-meta-next">
            <CalendarClock size={13} />
            <span>Next: {prettyDate(c.next.date)} · {c.next.start}{c.next.room ? ` · ${c.next.room}` : ""}</span>
          </div>
        ) : (
          <div className="course-meta-row course-meta-done"><CalendarClock size={13} /><span>All sessions done</span></div>
        )}
      </div>

      <div className="course-progress">
        <div className="course-progress-track">
          <div className="course-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="course-progress-labels">
          <span>{c.done}/{c.total} sessions</span>
          <span>{c.remaining} left</span>
        </div>
      </div>

      {att != null && (
        <div className="course-att">
          <span className={`course-att-pct${att < 80 ? " is-low" : ""}`}>{att}% present</span>
          <span className="course-att-skips">
            {skips > 0 ? `${skips} skip${skips === 1 ? "" : "s"} left` : c.skip.penaltyHit ? "Over budget" : "No skips left"}
          </span>
        </div>
      )}
    </Card>
  );
}

export default function CoursesPanel({ allClasses, enrolled, legend, attendance, now }) {
  const [q, setQ] = useState("");
  const courses = useMemo(
    () => courseStats(allClasses, enrolled, legend, attendance, now),
    [allClasses, enrolled, legend, attendance, now]
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return courses;
    return courses.filter((c) => c.name.toLowerCase().includes(t) || c.code.toLowerCase().includes(t) || c.faculty.join(" ").toLowerCase().includes(t));
  }, [courses, q]);

  const totalCredits = useMemo(
    () => courses.reduce((s, c) => s + (Number(c.credits) || 0), 0),
    [courses]
  );

  if (courses.length === 0) {
    return <EmptyState icon={BookOpen} title="No courses yet" sub="Finish setup to see your course cards here." />;
  }

  return (
    <div className="courses-panel">
      <div className="courses-summary">
        <div className="courses-summary-stat"><Layers size={15} /><strong>{courses.length}</strong> courses</div>
        <div className="courses-summary-stat"><GraduationCap size={15} /><strong>{totalCredits}</strong> credits</div>
        <div className="courses-search">
          <Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search course or faculty…" aria-label="Search courses" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState compact icon={Search} title="No matches" sub={`Nothing matches “${q}”.`} />
      ) : (
        <div className="courses-grid">
          {filtered.map((c) => <CourseCard key={c.code} c={c} />)}
        </div>
      )}
    </div>
  );
}
