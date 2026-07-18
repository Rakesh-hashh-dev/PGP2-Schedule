import React, { useMemo, useState } from "react";
import "../styles/exams.css";
import { GraduationCap, Clock, BookOpen, Trophy, CalendarDays, List, ChevronLeft, ChevronRight, Layers, FileText, CalendarClock, ChevronDown, User, MapPin, AlertTriangle, BookOpenCheck } from "lucide-react";
import { sessionKey, isExamSession, courseSkipStats } from "../lib/attendance.js";
import { loadAssignments } from "../lib/assignments.js";
import { subjectClass } from "../lib/subjectColors.js";
import { EmptyState } from "./ui.jsx";

function daysBetween(a, b) {
  const msDay = 86400000;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / msDay);
}

function fmtDate(iso) {
  const [Y, M, D] = iso.split("-").map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

function cdTone(days) {
  if (days < 0) return "past";
  if (days <= 3) return "bad";
  if (days <= 7) return "warn";
  return "good";
}

function examCategory(name, session) {
  const n = (name || "").toLowerCase();
  const s = (session || "").toLowerCase();
  if ((n.includes("end") && n.includes("term")) || (s.includes("end") && s.includes("term"))) return "End Term";
  if ((n.includes("mid") && n.includes("term")) || (s.includes("mid") && s.includes("term"))) return "Mid Term";
  if (n.includes("quiz") || s.includes("quiz")) return "Quiz";
  return "Exam / Admin";
}

function pad2(n) { return String(n).padStart(2, "0"); }

// Derive the subject code an exam belongs to. Exam entries often carry an empty
// `code` with the subject baked into the name (e.g. "SAPM MID Term Exam"), so
// fall back to matching a known course code embedded in the name. Returns null
// for generic exams (e.g. "END Term", "Term Registration") that apply to everyone.
function examSubjectCode(exam, allCodes) {
  if (exam.code) return exam.code;
  const name = (exam.name || "").toUpperCase();
  if (!name || !allCodes) return null;
  const hit = allCodes.find(code => {
    const re = new RegExp(`\\b${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return re.test(name);
  });
  return hit || null;
}

// ── Mini Calendar ──
function ExamCalendar({ exams, now, termStart, termEnd }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString([], { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  // Build exam lookup: date -> [exams]
  const examMap = useMemo(() => {
    const m = {};
    exams.forEach(e => {
      (m[e.date] = m[e.date] || []).push(e);
    });
    return m;
  }, [exams]);

  // Term range for highlighting
  const termStartDate = termStart ? new Date(termStart + "T00:00") : null;
  const termEndDate = termEnd ? new Date(termEnd + "T00:00") : null;

  const cells = [];
  // Empty leading cells
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    const dt = new Date(year, month, d);
    const isToday = iso === todayISO;
    const inTerm = termStartDate && termEndDate && dt >= termStartDate && dt <= termEndDate;
    const dayExams = examMap[iso] || [];
    cells.push({ d, iso, isToday, inTerm, exams: dayExams });
  }

  return (
    <div className="ecal">
      <div className="ecal-nav">
        <button className="ecal-btn" onClick={() => setMonthOffset(o => o - 1)} aria-label="Previous month">
          <ChevronLeft size={15} />
        </button>
        <span className="ecal-month">{monthName}</span>
        <button className="ecal-btn" onClick={() => setMonthOffset(o => o + 1)} aria-label="Next month">
          <ChevronRight size={15} />
        </button>
        {monthOffset !== 0 && (
          <button className="ecal-today-btn" onClick={() => setMonthOffset(0)}>Today</button>
        )}
      </div>
      <div className="ecal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="ecal-hd">{d}</div>
        ))}
        {cells.map((cell, i) => (
          <div key={i} className={
            `ecal-cell${!cell ? " ecal-empty" : ""}${cell?.isToday ? " ecal-today" : ""}${cell?.inTerm ? " ecal-term" : ""}${cell?.exams.length ? " ecal-exam" : ""}`
          }>
            {cell && (
              <>
                <span className="ecal-d">{cell.d}</span>
                {cell.exams.length > 0 && (
                  <>
                    <div className="ecal-dots">
                      {cell.exams.map((e, j) => (
                        <span key={j} className={`ecal-dot tone-${e.tone}`} />
                      ))}
                    </div>
                    <div className="ecal-tooltip">
                      <div className="ecal-tooltip-date">{fmtDate(cell.iso)}</div>
                      {cell.exams.map((e, j) => (
                        <div key={`tt-${j}`} className="ecal-tooltip-item">
                          <span className={`ecal-tooltip-dot ecal-dot tone-${e.tone}`} />
                          <div className="ecal-tooltip-content">
                            <span className="ecal-tooltip-title">{e.code || "General"} {e.category}</span>
                            <span className="ecal-tooltip-time">{e.start || "All Day"} - {e.end || ""}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="ecal-legend">
        <span className="ecal-leg-item"><span className="ecal-leg-swatch ecal-leg-today" />Today</span>
        <span className="ecal-leg-item"><span className="ecal-leg-swatch ecal-leg-exam" />Exam</span>
        <span className="ecal-leg-item"><span className="ecal-leg-swatch ecal-leg-term" />Term</span>
      </div>
    </div>
  );
}

// ── Session dot trail (progress + attendance combined) ──
function CourseDotTrail({ sessions, attendance, now }) {
  if (!sessions.length) return null;
  return (
    <div className="exam-dot-trail">
      {sessions.map((s, i) => {
        const [Y, M, D] = s.date.split("-").map(Number);
        const isPast = new Date(Y, M - 1, D) < now;
        const key = sessionKey(s);
        const status = isPast ? (attendance?.[key] || "unmarked") : "future";
        return (
          <span
            key={i}
            className={`exam-sp exam-sp-${status}`}
            title={`S${s.session || i + 1} · ${isPast ? status : "upcoming"} · ${s.date}`}
          />
        );
      })}
    </div>
  );
}

// ── Per-course countdown ──
// Expanded "course page" detail shown inside a card's dropdown: the richer
// info (faculty, room, area, skip budget, upcoming sessions, assignments) that
// used to live in the standalone Courses view.
function CourseDetail({ c }) {
  const skip = c.skip;
  return (
    <div className="ecc-detail">
      <div className="ecc-detail-meta">
        {c.faculty.length > 0 && (
          <div className="ecc-detail-row"><User size={13} /><span>{c.faculty.join(", ")}</span></div>
        )}
        {c.rooms.length > 0 && (
          <div className="ecc-detail-row"><MapPin size={13} /><span>{c.rooms.join(" · ")}</span></div>
        )}
        <div className="ecc-detail-row"><Layers size={13} /><span>{c.area || "—"} · {c.credits} credits</span></div>
      </div>

      {skip && skip.totalScheduled > 0 && (
        <div className={`ecc-skip${skip.penaltyHit ? " is-bad" : skip.skipsRemaining === 0 ? " is-warn" : ""}`}>
          <AlertTriangle size={13} />
          <span>
            {skip.penaltyHit
              ? "Attendance below the required minimum"
              : skip.skipsRemaining > 0
                ? `${skip.skipsRemaining} skip${skip.skipsRemaining === 1 ? "" : "s"} left before you drop below the minimum`
                : "No skips left — every remaining class counts"}
          </span>
        </div>
      )}

      {c.upcoming.length > 0 && (
        <div className="ecc-detail-block">
          <div className="ecc-detail-label">Upcoming</div>
          <ul className="ecc-upcoming">
            {c.upcoming.map((s, i) => (
              <li key={i} className={`ecc-up-item${s.soon ? " is-soon" : ""}`}>
                <span className="ecc-up-cal">
                  <span className="ecc-up-dow">{s.dow}</span>
                  <span className="ecc-up-dnum">{s.dnum}</span>
                </span>
                <span className="ecc-up-main">
                  <span className="ecc-up-rel">{s.rel}</span>
                  <span className="ecc-up-meta">
                    <Clock size={11} />{s.start}–{s.end}
                    {s.room && <><MapPin size={11} className="ecc-up-sep" />{s.room}</>}
                  </span>
                </span>
              </li>
            ))}
            {c.upcomingMore > 0 && (
              <li className="ecc-up-more">+{c.upcomingMore} more session{c.upcomingMore === 1 ? "" : "s"}</li>
            )}
          </ul>
        </div>
      )}

      <div className="ecc-detail-foot">
        <span className="ecc-detail-tag"><BookOpenCheck size={12} /> {c.assignmentsOpen} assignment{c.assignmentsOpen === 1 ? "" : "s"} open</span>
      </div>
    </div>
  );
}

function CourseCountdown({ courses, allClasses, enrolled, attendance, now }) {
  const [openCodes, setOpenCodes] = useState(() => new Set());
  const toggle = (code) =>
    setOpenCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });

  const courseTimeline = useMemo(() => {
    if (!enrolled || !allClasses) return [];
    const assignmentStore = loadAssignments();

    return courses.map(c => {
      const section = enrolled[c.code] || "";
      const sessions = allClasses
        .filter(cl => {
          if (cl.type !== "class" || cl.code !== c.code) return false;
          if (cl.section !== "Single" && cl.section !== section) return false;
          const s = (cl.session || "").toLowerCase();
          if (s.includes("mid term") || s.includes("end term") || s.includes("quiz")) return false;
          return true;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      const total = sessions.length;
      const pastSessions = sessions.filter(s => {
        const [Y, M, D] = s.date.split("-").map(Number);
        return new Date(Y, M - 1, D) < now;
      });
      const past = pastSessions.length;
      const pct = total > 0 ? Math.round((past / total) * 100) : 0;

      // Attendance % over marked past sessions
      const presentCount = pastSessions.filter(s => attendance?.[sessionKey(s)] === "present").length;
      const absentCount = pastSessions.filter(s => attendance?.[sessionKey(s)] === "absent").length;
      const markedCount = presentCount + absentCount;
      const attPct = markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : null;

      const upcomingAll = sessions.filter(s => {
        const [Y, M, D] = s.date.split("-").map(Number);
        return new Date(Y, M - 1, D) >= now;
      });
      const fmtUpcoming = (s) => {
        const [Y, M, D] = s.date.split("-").map(Number);
        const d = new Date(Y, M - 1, D);
        const diff = daysBetween(now, d);
        const rel = diff === 0 ? "Today" : diff === 1 ? "Tomorrow"
          : diff < 7 ? d.toLocaleDateString([], { weekday: "long" })
          : d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
        return {
          dow: d.toLocaleDateString([], { weekday: "short" }),
          dnum: D, rel, start: s.start, end: s.end, room: s.room, soon: diff <= 1,
        };
      };
      const nextSession = upcomingAll[0];
      const lastSession = sessions[sessions.length - 1];
      const lastDate = lastSession ? (() => {
        const [Y, M, D] = lastSession.date.split("-").map(Number);
        return new Date(Y, M - 1, D);
      })() : null;
      const daysToLast = lastDate ? daysBetween(now, lastDate) : null;

      // Expanded-detail extras (faculty/rooms from all class rows, incl. exams)
      const allRows = allClasses.filter(cl => cl.code === c.code && (cl.section === "Single" || cl.section === section));
      const faculty = [...new Set(allRows.map(r => r.faculty).filter(Boolean))];
      const rooms = [...new Set(allRows.map(r => r.room).filter(Boolean))];
      const skip = courseSkipStats(allClasses, c.code, section, attendance, { zeroCredit: c.credits === 0, credits: c.credits });
      const assignmentsOpen = (assignmentStore?.[c.code] || []).filter(t => !t.completed).length;

      return {
        ...c, total, past, remaining: total - past, pct, daysToLast, nextSession, sessions, attPct,
        faculty, rooms, skip, assignmentsOpen,
        upcoming: upcomingAll.slice(0, 3).map(fmtUpcoming), upcomingMore: Math.max(0, upcomingAll.length - 3),
      };
    }).sort((a, b) => (a.daysToLast ?? 999) - (b.daysToLast ?? 999));
  }, [courses, allClasses, enrolled, attendance, now]);

  return (
    <div className="exam-cc-grid">
      {courseTimeline.map((c, i) => {
        const attTone = c.attPct == null ? "" : c.attPct >= 80 ? " att-good" : c.attPct >= 75 ? " att-warn" : " att-bad";
        const isOpen = openCodes.has(c.code);

        // SVG Ring calculations
        const radius = 22;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (c.pct / 100) * circumference;

        return (
          <div key={c.code} className={`exam-cc-card${isOpen ? " is-open" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
            <button
              type="button"
              className="ecc-toggle"
              onClick={() => toggle(c.code)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${c.name} details`}
            >
              <div className="ecc-top">
                <div className="ecc-ring-wrap">
                  <svg className="ecc-ring-svg" width="56" height="56">
                    <circle className="ecc-ring-bg" cx="28" cy="28" r={radius} />
                    <circle
                      className="ecc-ring-fg"
                      cx="28"
                      cy="28"
                      r={radius}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>
                  <div className="ecc-ring-pct">{c.pct}%</div>
                </div>
                <div className="ecc-info">
                  <div className="ecc-head">
                    <span className={`ses ${subjectClass(c.code)}`}>
                      {c.code}
                    </span>
                    <span className="ecc-cr">{c.credits}cr</span>
                  </div>
                  <div className="ecc-name">{c.name}</div>
                  <CourseDotTrail sessions={c.sessions} attendance={attendance} now={now} />
                </div>
              </div>

              <div className="ecc-bot">
                <div className="ecc-pill ecc-pill-done">
                  <span>{c.past}/{c.total}</span> sessions
                </div>
                {c.attPct !== null && (
                  <div className={`ecc-pill ecc-pill-att${attTone}`}>
                    {c.attPct}% att
                  </div>
                )}
                {c.nextSession && c.remaining > 0 ? (
                  <div className="ecc-pill ecc-pill-next">
                    Next: {fmtDate(c.nextSession.date)}
                  </div>
                ) : c.daysToLast != null && c.daysToLast >= 0 && c.remaining === 0 ? (
                  <div className="ecc-pill ecc-pill-ended">
                    Ended
                  </div>
                ) : null}
                <ChevronDown size={16} className="ecc-caret" />
              </div>
            </button>

            {isOpen && <CourseDetail c={c} />}
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(function ExamsPanel({ allClasses, enrolled, legend, allCodes, now, termNumber, termStart, termEnd, attendance }) {
  const codes = Object.keys(enrolled || {});
  const [cdView, setCdView] = useState("list"); // "list" | "calendar"
  const [examFilter, setExamFilter] = useState("mine"); // "mine" | "all"

  // ── Credit calculations ──
  const creditData = useMemo(() => {
    if (!enrolled || !legend) return { total: 0, courses: [], byArea: {} };

    const courses = codes.map(code => {
      const info = legend[code] || {};
      const cr = parseFloat(info.credits) || 0;
      return { code, name: info.name || code, credits: cr, area: info.area || "Other", raw: info.credits };
    }).sort((a, b) => a.area.localeCompare(b.area) || a.code.localeCompare(b.code));

    const total = courses.reduce((s, c) => s + c.credits, 0);

    const byArea = {};
    courses.forEach(c => {
      byArea[c.area] = (byArea[c.area] || 0) + c.credits;
    });

    return { total, courses, byArea };
  }, [enrolled, legend, codes]);

  // ── Exam entries ──
  const exams = useMemo(() => {
    if (!allClasses) return [];
    const list = allClasses
      .filter(c => {
        // Is it an exam?
        const isExam = c.type === "exam" || (c.type === "class" && isExamSession(c));
        if (!isExam) return false;

        // Does it apply to me? Subject-specific exams (code set, or subject baked
        // into the name like "SAPM MID Term Exam") are hidden unless enrolled.
        // Generic exams (no identifiable subject) apply to everyone.
        if (examFilter === "mine") {
          const subjectCode = examSubjectCode(c, allCodes);
          if (subjectCode && !codes.includes(subjectCode)) return false;
        }
        return true;
      })
      .map(c => {
        const [Y, M, D] = c.date.split("-").map(Number);
        const dt = new Date(Y, M - 1, D);
        const days = daysBetween(now, dt);
        return { ...c, dt, days, category: examCategory(c.name, c.session), tone: cdTone(days) };
      })
      .sort((a, b) => a.dt - b.dt);

    return list;
  }, [allClasses, now, codes, examFilter, allCodes]);

  const upcoming = exams.filter(e => e.days >= 0);
  const past = exams.filter(e => e.days < 0);

  const progressPct = useMemo(() => {
    if (!allClasses || !codes.length) return 0;
    let total = 0;
    let pastCount = 0;
    allClasses.forEach(c => {
      if (c.code && codes.includes(c.code)) {
        total++;
        if (c.date) {
          const [Y, M, D] = c.date.split("-").map(Number);
          if (new Date(Y, M - 1, D) < now) pastCount++;
        }
      }
    });
    return total === 0 ? 0 : Math.round((pastCount / total) * 100);
  }, [allClasses, codes, now]);

  const midTermCount = exams.filter(e => e.category === "Mid Term").length;
  const endTermCount = exams.filter(e => e.category === "End Term").length;
  const nextExam = upcoming[0];

  if (!codes.length) {
    return (
      <div className="exam-page">
        <div className="exam-head"><h1>Exams & Credits</h1></div>
        <EmptyState icon={GraduationCap} title="No courses enrolled" sub="Complete setup first — your exams and credits will show up here." />
      </div>
    );
  }

  return (
    <div className="exam-page">
      <div className="exam-head">
        <h1>Exams & Credits</h1>
        <span className="att-sub">{termNumber ? `Term ${["", "I", "II", "III", "IV", "V", "VI"][termNumber] || termNumber}` : "This term"}</span>
      </div>

      {/* ── Credit Summary Hero ── */}
      <section className="exam-hero-new">
        <span className="eh-tag"><GraduationCap size={13} /> Semester Progress</span>

        <div className="eh-ill-block" aria-hidden="true">
          <div className="eh-ill-img-wrap">
            <div className="eh-ill-glow" />
            <img src="/grad-cap-3d.png" alt="" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            <div className="eh-ill-fallback" style={{ display: 'none' }}>
              <GraduationCap size={44} color="#A78BFA" />
            </div>
          </div>
        </div>

        <div className="eh-content">
          <div className="eh-progress-ring">
            <svg width="112" height="112" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="url(#purpleGrad)"
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * progressPct) / 100}
                transform="rotate(-90 50 50)"
                className="eh-ring-prog"
              />
              <defs>
                <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#C084FC" />
                </linearGradient>
              </defs>
            </svg>
            <div className="eh-ring-text">
              <div className="eh-ring-val">{progressPct}<span className="eh-ring-pct">%</span></div>
              <div className="eh-ring-sub">Completed</div>
            </div>
          </div>

          <div className="eh-stats-block">
            <div className="eh-progress-linear">
              <div className="eh-pl-text">
                <span>Semester Progress</span>
                <span>{progressPct}% Completed</span>
              </div>
              <div className="eh-pl-bar">
                <div className="eh-pl-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="eh-stats-row">
              <div className="eh-tile" style={{ animationDelay: "80ms" }}>
                <span className="eh-tile-ico"><BookOpen size={15} /></span>
                <div className="eh-tile-val">{creditData.total}</div>
                <div className="eh-tile-label">Credits</div>
              </div>
              <div className="eh-tile" style={{ animationDelay: "140ms" }}>
                <span className="eh-tile-ico"><Layers size={15} /></span>
                <div className="eh-tile-val">{creditData.courses.length}</div>
                <div className="eh-tile-label">Subjects</div>
              </div>
              <div className="eh-tile" style={{ animationDelay: "200ms" }}>
                <span className="eh-tile-ico"><FileText size={15} /></span>
                <div className="eh-tile-val">{midTermCount}</div>
                <div className="eh-tile-label">Mid Terms</div>
              </div>
              <div className="eh-tile" style={{ animationDelay: "260ms" }}>
                <span className="eh-tile-ico"><Trophy size={15} /></span>
                <div className="eh-tile-val">{endTermCount}</div>
                <div className="eh-tile-label">End Terms</div>
              </div>
            </div>

            <div className={`eh-next-exam${nextExam ? ` tone-${nextExam.tone || (nextExam.days <= 3 ? "bad" : nextExam.days <= 7 ? "warn" : "ok")}` : ""}`}>
              <div className="eh-ne-l">
                <span className="eh-ne-label"><CalendarClock size={12} /> Next Exam</span>
                {nextExam ? (
                  <>
                    <div className="eh-ne-title">{nextExam.name || nextExam.code || "Upcoming Exam"}</div>
                    <div className="eh-ne-meta"><span className="eh-ne-days-m">{nextExam.days} {nextExam.days === 1 ? "Day" : "Days"}</span> Remaining &bull; {fmtDate(nextExam.date)}</div>
                  </>
                ) : (
                  <div className="eh-ne-title" style={{ opacity: 0.5 }}>No upcoming exams</div>
                )}
              </div>
              {nextExam && (
                <div className="eh-ne-badge">
                  <span className="eh-ne-badge-n">{nextExam.days}</span>
                  <span className="eh-ne-badge-u">{nextExam.days === 1 ? "day" : "days"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Exam Countdown ── */}
      <section className="exam-card exam-card-countdown">
        <div className="exam-card-h">
          <h2><Clock size={15} /> Exam Countdown</h2>
          <div className="exam-filter-pill">
            <button className={`exam-fp-btn${examFilter === "mine" ? " on" : ""}`} onClick={() => setExamFilter("mine")}>My Subjects</button>
            <button className={`exam-fp-btn${examFilter === "all" ? " on" : ""}`} onClick={() => setExamFilter("all")}>All Subjects</button>
          </div>
          <div className="exam-view-toggle">
            <button className={`exam-vt-btn${cdView === "list" ? " on" : ""}`} onClick={() => setCdView("list")} aria-label="List view">
              <List size={14} />
            </button>
            <button className={`exam-vt-btn${cdView === "calendar" ? " on" : ""}`} onClick={() => setCdView("calendar")} aria-label="Calendar view">
              <CalendarDays size={14} />
            </button>
          </div>
        </div>

        {cdView === "calendar" ? (
          <ExamCalendar exams={exams} now={now} termStart={termStart} termEnd={termEnd} />
        ) : exams.length === 0 ? (
          <EmptyState compact icon={Trophy} title="No exams scheduled yet" sub="They'll appear here once the timetable is updated." />
        ) : (
          <>
            <div className="exam-cd-grid">
            {upcoming.map((e, i) => (
              <div key={i} className={`exam-cd tone-${e.tone}`} style={{ animationDelay: `${i * 80}ms` }}>
                {/* Left: countdown number */}
                <div className="exam-cd-days">
                  {e.days <= 3 && e.days >= 0 && <span className="exam-cd-pulse" />}
                  <span className="exam-cd-days-num">
                    {e.days === 0 ? "0" : e.days}
                  </span>
                  <span className="exam-cd-days-unit">
                    {e.days === 0 ? "Today" : e.days === 1 ? "day left" : "days left"}
                  </span>
                </div>

                {/* Divider */}
                <div className="exam-cd-divider" />

                {/* Right: info */}
                <div className="exam-cd-info">
                  <span className="exam-cd-cat">{e.category}</span>
                  <span className="exam-cd-name">{e.name || e.code}</span>
                  <div className="exam-cd-meta">
                    <span className="exam-cd-date">
                      <CalendarDays size={11} /> {fmtDate(e.date)}
                    </span>
                    {e.start && (
                      <span className="exam-cd-time">
                        <Clock size={11} /> {e.start} – {e.end}
                      </span>
                    )}
                  </div>
                </div>

                {/* Subject code badge */}
                {e.code && (
                  <span className={`ses ${subjectClass(e.code)} exam-cd-code`}>{e.code}</span>
                )}
              </div>
            ))}

            {past.length > 0 && (
              <>
                <div className="exam-cd-sep">Past</div>
                {past.map((e, i) => (
                  <div key={`p${i}`} className="exam-cd tone-past" style={{ animationDelay: `${(upcoming.length + i) * 80}ms` }}>
                    {/* Left: days ago */}
                    <div className="exam-cd-days">
                      <span className="exam-cd-days-num">{Math.abs(e.days)}</span>
                      <span className="exam-cd-days-unit">{Math.abs(e.days) === 1 ? "day ago" : "days ago"}</span>
                    </div>

                    {/* Divider */}
                    <div className="exam-cd-divider" />

                    {/* Right: info */}
                    <div className="exam-cd-info">
                      <span className="exam-cd-cat">{e.category}</span>
                      <span className="exam-cd-name">{e.name || e.code}</span>
                      <div className="exam-cd-meta">
                        <span className="exam-cd-date">
                          <CalendarDays size={11} /> {fmtDate(e.date)}
                        </span>
                      </div>
                    </div>

                    {/* Subject code badge */}
                    {e.code && (
                      <span className={`ses ${subjectClass(e.code)} exam-cd-code exam-cd-code-past`}>{e.code}</span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer bar */}
          {upcoming.length > 0 && (
            <div className="exam-cd-footer">
              <div className="exam-cd-footer-l">
                <div className="exam-cd-footer-ico">
                  <CalendarDays size={14} />
                </div>
                <div>
                  <div className="exam-cd-footer-count">{upcoming.length} Exam{upcoming.length !== 1 ? "s" : ""} Upcoming</div>
                  <div className="exam-cd-footer-sub">Keep going! You're on track.</div>
                </div>
              </div>
            </div>
          )}
          </>
        )}
      </section>

      {/* ── Course Progress Countdown ── */}
      <section className="exam-card">
        <div className="exam-card-h">
          <h2><BookOpen size={15} /> Course Progress</h2>
          <span className="att-count">{creditData.courses.length} courses</span>
        </div>
        <CourseCountdown
          courses={creditData.courses}
          allClasses={allClasses}
          enrolled={enrolled}
          attendance={attendance}
          now={now}
        />
      </section>

      {/* ── Credits by Course ── */}
      <section className="exam-card exam-credits-card">
        <div className="exam-card-h">
          <h2><GraduationCap size={15} /> Credits by Course</h2>
          <span className="att-count">{creditData.total} total</span>
        </div>
        <div className="exam-cr-grid-new">
          {creditData.courses.map((c, i) => {
            return (
              <div key={c.code} className="exam-cr-badge" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="ecr-bg-text">{c.code}</div>
                <div className="ecr-content">
                  <div className="ecr-top">
                    <span className="ecr-area">{c.area}</span>
                  </div>
                  <div className="ecr-name">{c.name}</div>
                  <div className="ecr-bot">
                    <span className="ecr-code">{c.code}</span>
                    <span className={`ecr-val${!c.raw ? " ecr-missing" : ""}`}>
                      {c.raw ? c.credits : "—"}<small>cr</small>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
});
