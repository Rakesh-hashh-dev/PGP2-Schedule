import { useCallback, useMemo, useState } from "react";
import { ArrowRight, BarChart3, BookOpen, CalendarCheck2, Check, ChevronDown, CircleGauge, Clock, History, ListFilter, ShieldAlert, X } from "lucide-react";
import { sessionKey, courseSkipStats, isExamSession } from "../lib/attendance.js";
import { attendanceCourseState, attendanceCoverage, attendanceRequirement, groupPendingSessions, sortAttendanceCourses } from "../lib/attendanceWorkspace.js";
import { subjectClass, cleanSessionLabel } from "../lib/subjectColors.js";
import { fmtTime12 } from "../lib/datetime.js";
import { EmptyState } from "./ui.jsx";
import WeatherWidget from "./WeatherWidget.jsx";
import "../styles/attendance.css";

const PENDING_PREVIEW_SIZE = 4;

function clsEnd(c) {
  const [year, month, day] = c.date.split("-").map(Number);
  const [hour, minute] = c.end.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function fmtDate(iso, long = false) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], long
    ? { weekday: "long", day: "numeric", month: "long" }
    : { weekday: "short", day: "numeric", month: "short" });
}

const percentageLabel = (value) => value == null ? "Not recorded" : `${value}%`;

function Progress({ value, target, label }) {
  const width = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="atx-progress" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100"
      aria-valuenow={value ?? 0} aria-valuetext={value == null ? "No attendance recorded" : `${value}% attendance; target ${target}%`}>
      <span className="atx-progress-fill" style={{ width: `${width}%` }} />
      <span className="atx-progress-target" style={{ left: `${target}%` }} aria-hidden="true" />
    </div>
  );
}

function MarkButtons({ session, status, onMark, compact = false }) {
  return (
    <div className={`atx-mark-actions${compact ? " compact" : ""}`}>
      <button
        type="button"
        className={`atx-mark-button present${status === "present" ? " active" : ""}`}
        onClick={() => onMark(session, status === "present" ? null : "present")}
        aria-pressed={status === "present"}
        title={`Mark ${session.name || session.code} as present`}
      >
        <Check size={13} strokeWidth={2.5} />
        <span>{compact ? "Present" : "Mark present"}</span>
      </button>
      <button
        type="button"
        className={`atx-mark-button absent${status === "absent" ? " active" : ""}`}
        onClick={() => onMark(session, status === "absent" ? null : "absent")}
        aria-pressed={status === "absent"}
        title={`Mark ${session.name || session.code} as absent`}
      >
        <X size={13} strokeWidth={2.5} />
        <span>{compact ? "Absent" : "Mark absent"}</span>
      </button>
    </div>
  );
}

function PendingCard({ session, onMark }) {
  const [exiting, setExiting] = useState(null);
  const rawSession = cleanSessionLabel(session.session);
  const sessionLabel = rawSession ? (/^s/i.test(rawSession) ? rawSession : `S${rawSession}`) : null;

  const handleMark = useCallback((targetSession, status) => {
    if (!status || exiting) {
      onMark(targetSession, status);
      return;
    }
    setExiting(status);
    setTimeout(() => {
      onMark(targetSession, status);
    }, 220);
  }, [exiting, onMark]);

  return (
    <article className={`atx-pending-card ${subjectClass(session.code)}${exiting ? ` exiting-${exiting}` : ""}`}>
      <div className="atx-pending-code">
        <strong>{session.code}</strong>
        {sessionLabel && <span>{sessionLabel}</span>}
      </div>
      <div className="atx-pending-copy">
        <strong>{session.name}</strong>
        <span><Clock size={12} /> {fmtTime12(session.start)}–{fmtTime12(session.end)}</span>
      </div>
      <MarkButtons session={session} status={exiting} onMark={handleMark} compact />
    </article>
  );
}

function CourseHistory({ course, attendance, filter, setFilter, onMark }) {
  const sessions = course.sessions.filter((session) => {
    const status = attendance[session.key] || "unmarked";
    return filter === "all" || status === filter;
  });
  return (
    <div className="atx-history">
      <div className="atx-history-head">
        <div><History size={15} /><strong>Session history</strong></div>
        <div className="atx-mini-filters" aria-label="Filter session history">
          {["all", "present", "absent", "unmarked"].map((item) => (
            <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item[0].toUpperCase() + item.slice(1)}</button>
          ))}
        </div>
      </div>
      {sessions.length ? sessions.map((session, index) => {
        const status = attendance[session.key] || null;
        return (
          <div className="atx-history-row" key={session.key}>
            <span className={`atx-status-dot ${status || "unmarked"}`} aria-hidden="true" />
            <div className="atx-history-copy"><strong>Session {session.session || index + 1}</strong><span>{fmtDate(session.date)} · {fmtTime12(session.start)}–{fmtTime12(session.end)}</span></div>
            <span className={`atx-status-label ${status || "unmarked"}`}>{status || "Unmarked"}</span>
            <MarkButtons session={session} status={status} onMark={onMark} compact />
          </div>
        );
      }) : <p className="atx-filter-empty">No {filter} sessions in this course.</p>}
    </div>
  );
}

function SubjectChart({ courses, isVisible = true }) {
  return (
    <div className="atx-chart-scroll">
      <div className="atx-chart" style={{ "--atx-columns": courses.length }} role="img" aria-label="Subject-wise attendance compared with the required percentage">
        <div className="atx-chart-line" style={{ bottom: "80%" }}><span>80% baseline</span></div>
        <div className="atx-chart-bars">
          {courses.map((course, idx) => {
            const height = course.pct == null ? 3 : Math.max(5, course.pct);
            const tone = course.pct == null ? "empty" : course.pct >= course.requiredPct ? "good" : course.pct >= course.requiredPct - 10 ? "watch" : "bad";
            return (
              <div
                className="atx-chart-column"
                key={course.code}
                style={{ "--bar-index": idx }}
                aria-label={`${course.name}: ${percentageLabel(course.pct)}, ${course.state.coverage}% records complete`}
              >
                <span className={`atx-chart-value ${tone}`}>{course.pct == null ? "—" : `${course.pct}%`}</span>
                <div className="atx-chart-track">
                  <span
                    className={`atx-chart-bar ${tone}`}
                    style={{ height: isVisible ? `${height}%` : "0%" }}
                  />
                  <span className="atx-chart-course-target" style={{ bottom: `${course.requiredPct}%` }} aria-hidden="true" />
                </div>
                <strong>{course.code}</strong>
                <small>{course.state.coverage}% recorded</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AttendancePanel({ allClasses, now, attendance, enrolled, legend, markAttendance, weather, termNumber, onOpenCourse }) {
  const [expandedCode, setExpandedCode] = useState(null);
  const [pendingFilter, setPendingFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [showChart, setShowChart] = useState(false);
  const [showAllPending, setShowAllPending] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const codes = Object.keys(enrolled || {});

  const allPast = useMemo(() => {
    if (!enrolled) return [];
    const out = [];
    for (const [code, section] of Object.entries(enrolled)) {
      const name = legend[code]?.name || code;
      allClasses.filter((c) => c.type === "class" && !isExamSession(c) && c.code === code
        && (c.section === "Single" || c.section === section) && clsEnd(c) <= now)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
        .forEach((c) => out.push({ ...c, name, key: sessionKey(c) }));
    }
    return out;
  }, [allClasses, enrolled, legend, now]);

  const stat = useCallback((list) => {
    const present = list.filter((session) => attendance[session.key] === "present").length;
    const absent = list.filter((session) => attendance[session.key] === "absent").length;
    const unmarked = list.length - present - absent;
    const marked = present + absent;
    return { present, absent, unmarked, marked, pct: marked > 0 ? Math.round((present / marked) * 100) : null, total: list.length };
  }, [attendance]);

  const overall = useMemo(() => stat(allPast), [allPast, stat]);
  const overallCoverage = attendanceCoverage(overall);
  const byCourse = useMemo(() => sortAttendanceCourses(codes.map((code) => {
    const sessions = allPast.filter((session) => session.code === code);
    const section = enrolled[code];
    const credits = legend[code]?.credits;
    const budget = courseSkipStats(allClasses, code, section, attendance, { zeroCredit: Number(credits) === 0, credits });
    const base = { code, name: legend[code]?.name || code, credits, sessions, requiredPct: attendanceRequirement(credits), ...budget, ...stat(sessions) };
    return { ...base, state: attendanceCourseState(base) };
  })), [allPast, attendance, codes, allClasses, enrolled, legend, stat]);


  const pending = useMemo(() => allPast.filter((session) => !attendance[session.key]), [allPast, attendance]);
  const pendingCodes = useMemo(() => [...new Set(pending.map((session) => session.code))], [pending]);
  const filteredPending = pendingFilter === "all" ? pending : pending.filter((session) => session.code === pendingFilter);
  const visiblePending = showAllPending ? filteredPending : filteredPending.slice().reverse().slice(0, PENDING_PREVIEW_SIZE);
  const pendingGroups = useMemo(() => groupPendingSessions(visiblePending), [visiblePending]);
  const attentionCourses = byCourse.filter((course) => ["critical", "below", "watch"].includes(course.state.id));
  const filteredCourses = byCourse.filter((course) => {
    if (courseFilter === "attention") return course.state.rank <= 2;
    if (courseFilter === "on-track") return course.state.id === "on-track";
    if (courseFilter === "unmarked") return course.unmarked > 0;
    return true;
  });

  const handleMark = useCallback((session, status) => {
    markAttendance?.(session, status);
    const action = status === "present" ? "marked present" : status === "absent" ? "marked absent" : "cleared";
    setLiveMessage(`${session.name || session.code} ${action}.`);
  }, [markAttendance]);

  function toggleCourse(code) {
    setExpandedCode((current) => current === code ? null : code);
    setHistoryFilter("all");
  }

  if (!codes.length) return <div className="atx-page"><div className="atx-heading"><h1>Attendance</h1></div><EmptyState icon={BookOpen} title="No courses enrolled" sub="Complete setup first — your attendance will show up here." /></div>;

  return (
    <div className="atx-page">
      <div className="atx-heading">
        <div><span className="atx-eyebrow">Attendance centre</span><h1>Attendance</h1><p>{termNumber ? `Term ${["", "I", "II", "III", "IV", "V", "VI"][termNumber] || termNumber}` : "Term so far"} · Know what needs action</p></div>
        <WeatherWidget now={now} weather={weather} />
      </div>
      <div className="sr-only" role="status" aria-live="polite">{liveMessage}</div>

      <section className={`atx-summary${overallCoverage < 70 && overall.total ? " incomplete" : ""}`} aria-labelledby="attendance-summary-title">
        <div className="atx-summary-main">
          <div className="atx-summary-ring" style={{ "--atx-pct": `${overall.pct ?? 0}%` }}><strong>{overall.pct == null ? "—" : `${overall.pct}%`}</strong></div>
          <div><span className="atx-summary-kicker" id="attendance-summary-title">Recorded attendance</span>
            <h2>{overall.pct == null ? "Start recording past classes" : `${overall.present} attended · ${overall.absent} missed`}</h2>
            <p>{overall.total ? `Based on ${overall.marked} of ${overall.total} past sessions.` : "No eligible classes have ended yet."}{overallCoverage < 70 && overall.total ? " Complete your records before relying on this percentage." : ""}</p>
          </div>
        </div>
        <div className="atx-summary-grid">
          <div className="atx-summary-stat"><span>Coverage</span><strong>{overallCoverage}%</strong><small>{overall.marked}/{overall.total} recorded</small></div>
          <div className={`atx-summary-stat${pending.length ? " urgent" : ""}`}><span>To mark</span><strong>{pending.length}</strong><small>{pending.length ? "Newest first" : "All caught up"}</small></div>
          <div className={`atx-summary-stat${attentionCourses.length ? " warn" : ""}`}><span>At risk</span><strong>{attentionCourses.length}</strong><small>{attentionCourses.length ? "Review below" : "No warnings"}</small></div>
        </div>

        {overall.total > 0 && (
          <button
            type="button"
            className={`atx-chart-toggle${showChart ? " open" : ""}`}
            onClick={() => setShowChart((value) => !value)}
            aria-expanded={showChart}
            aria-label={showChart ? "Hide subject graph" : "View subject graph"}
            title={showChart ? "Hide subject graph" : "View subject graph"}
          >
            <ChevronDown size={16} strokeWidth={2.2} className={`atx-toggle-chevron${showChart ? " open" : ""}`} />
          </button>
        )}
      </section>

      {overall.total > 0 && (
        <div className={`atx-chart-drawer${showChart ? " open" : ""}`} aria-hidden={!showChart}>
          <div className="atx-chart-drawer-inner">
            <section className="atx-section atx-chart-section" aria-labelledby="subject-chart-title">
              <div className="atx-section-head">
                <div>
                  <span className="atx-section-icon"><BarChart3 size={17} /></span>
                  <div>
                    <h2 id="subject-chart-title">Subject-wise attendance</h2>
                    <p>Attendance percentage and recording coverage by course.</p>
                  </div>
                </div>
                <span className="atx-count">Target 80% · Zero-credit 90%</span>
              </div>
              <SubjectChart courses={byCourse} isVisible={showChart} />
            </section>
          </div>
        </div>
      )}

      {pending.length > 0 && <section className="atx-section atx-pending" id="attendance-pending" aria-labelledby="pending-title">
        <div className="atx-section-head"><div><span className="atx-section-icon"><CalendarCheck2 size={17} /></span><div><h2 id="pending-title">Quick mark</h2><p>Complete recent sessions to make your insights reliable.</p></div></div><span className="atx-count">{filteredPending.length} pending</span></div>
        <div className="atx-filter-scroll" aria-label="Filter pending attendance by course">
          <button className={pendingFilter === "all" ? "active" : ""} onClick={() => { setPendingFilter("all"); setShowAllPending(false); }}>All</button>
          {pendingCodes.map((code) => <button key={code} className={pendingFilter === code ? "active" : ""} onClick={() => { setPendingFilter(code); setShowAllPending(false); }}>{code}</button>)}
        </div>
        <div className="atx-pending-groups">{pendingGroups.map((group) => <div className="atx-date-group" key={group.date}><h3>{fmtDate(group.date, true)}</h3><div className="atx-pending-list">{group.sessions.map((session) => <PendingCard key={session.key} session={session} onMark={handleMark} />)}</div></div>)}</div>
        {filteredPending.length > PENDING_PREVIEW_SIZE && <button className="atx-show-more" onClick={() => setShowAllPending((value) => !value)}>{showAllPending ? "Show recent sessions only" : `Show ${filteredPending.length - PENDING_PREVIEW_SIZE} earlier sessions`}<ChevronDown size={15} className={showAllPending ? "open" : ""} /></button>}
      </section>}

      {attentionCourses.length > 0 && <section className="atx-section atx-risk" aria-labelledby="risk-title">
        <div className="atx-section-head"><div><span className="atx-section-icon"><ShieldAlert size={17} /></span><div><h2 id="risk-title">Risk watch</h2><p>Courses where the next attendance decision matters most.</p></div></div><span className="atx-count">{attentionCourses.length} course{attentionCourses.length === 1 ? "" : "s"}</span></div>
        <div className="atx-risk-grid">{attentionCourses.map((course) => <article className={`atx-risk-card state-${course.state.id} ${subjectClass(course.code)}`} key={course.code}><div className="atx-risk-top"><strong>{course.code}</strong><span>{percentageLabel(course.pct)}</span></div><h3>{course.name}</h3><p>{course.state.detail}</p><div className="atx-risk-foot"><span>{course.state.label}</span><span>{course.state.coverage}% recorded</span></div></article>)}</div>
      </section>}

      <section className="atx-section" aria-labelledby="courses-title">
        <div className="atx-section-head atx-course-heading"><div><span className="atx-section-icon"><CircleGauge size={17} /></span><div><h2 id="courses-title">Course overview</h2><p>Attendance, coverage and remaining flexibility.</p></div></div><ListFilter size={17} aria-hidden="true" /></div>
        <div className="atx-filter-scroll atx-course-filters" aria-label="Filter courses">{[["all", "All"], ["attention", "Needs attention"], ["on-track", "On track"], ["unmarked", "Unmarked"]].map(([id, label]) => <button key={id} className={courseFilter === id ? "active" : ""} onClick={() => setCourseFilter(id)}>{label}</button>)}</div>
        {allPast.length === 0 ? <EmptyState compact icon={CalendarCheck2} title="No past classes yet" sub="Check back once sessions end." /> : filteredCourses.length ? <div className="atx-course-grid">{filteredCourses.map((course) => {
          const open = expandedCode === course.code;
          const canExpand = course.sessions.length > 0 && !!markAttendance;
          return <article className={`atx-course-card ${subjectClass(course.code)} state-${course.state.id}${open ? " open" : ""}`} key={course.code}>
            <button className="atx-course-toggle" onClick={() => canExpand && toggleCourse(course.code)} disabled={!canExpand} aria-expanded={open}>
              <div className="atx-course-topline"><span className="atx-course-code">{course.code}</span><span className={`atx-state-pill state-${course.state.id}`}>{course.state.label}</span>{canExpand && <ChevronDown size={16} className="atx-course-chevron" />}</div>
              <h3>{course.name}</h3><div className="atx-course-measure"><strong>{percentageLabel(course.pct)}</strong><span>{course.present}/{course.marked} attended</span><span>{course.requiredPct}% required</span></div>
              <Progress value={course.pct} target={course.requiredPct} label={`${course.name} attendance`} />
              <div className="atx-course-foot"><span>{course.state.coverage}% records complete</span><span className={`atx-skip-tracker${course.penaltyHit ? " penalty" : course.skipsRemaining <= 1 ? " low" : ""}`}>{course.penaltyHit ? "Penalty threshold crossed" : `Skips: ${course.skipsRemaining}/${course.totalAllowedSkips} left`}</span></div>
            </button>
            {onOpenCourse && <button className="atx-open-course" onClick={() => onOpenCourse(course.code)}>Open course hub <ArrowRight size={13} /></button>}
            <div className={`atx-history-drawer${open ? " open" : ""}`} aria-hidden={!open} inert={!open ? "" : undefined}>
              <div className="atx-history-drawer-inner">
                {canExpand && (
                  <CourseHistory
                    course={course}
                    attendance={attendance}
                    filter={historyFilter}
                    setFilter={setHistoryFilter}
                    onMark={handleMark}
                  />
                )}
              </div>
            </div>
          </article>;
        })}</div> : <p className="atx-filter-empty">No courses match this filter.</p>}
      </section>
    </div>
  );
}
