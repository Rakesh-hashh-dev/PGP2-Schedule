import React, { useMemo, useState } from "react";
import "../styles/exams.css";
import { GraduationCap, Clock, AlertTriangle, BookOpen, Trophy, CalendarDays, List, ChevronLeft, ChevronRight } from "lucide-react";
import { sessionKey } from "../lib/attendance.js";

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
function CourseCountdown({ courses, allClasses, enrolled, attendance, now }) {
  const courseTimeline = useMemo(() => {
    if (!enrolled || !allClasses) return [];

    return courses.map(c => {
      const sessions = allClasses
        .filter(cl => {
          if (cl.type !== "class" || cl.code !== c.code) return false;
          if (cl.section !== "Single" && cl.section !== (enrolled[c.code] || "")) return false;
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

      const nextSession = sessions.find(s => {
        const [Y, M, D] = s.date.split("-").map(Number);
        return new Date(Y, M - 1, D) >= now;
      });
      const lastSession = sessions[sessions.length - 1];
      const lastDate = lastSession ? (() => {
        const [Y, M, D] = lastSession.date.split("-").map(Number);
        return new Date(Y, M - 1, D);
      })() : null;
      const daysToLast = lastDate ? daysBetween(now, lastDate) : null;

      return { ...c, total, past, remaining: total - past, pct, daysToLast, nextSession, sessions, attPct };
    }).sort((a, b) => (a.daysToLast ?? 999) - (b.daysToLast ?? 999));
  }, [courses, allClasses, enrolled, attendance, now]);

  return (
    <div className="exam-cc-grid">
      {courseTimeline.map((c, i) => {
        const attTone = c.attPct == null ? "" : c.attPct >= 80 ? " att-good" : c.attPct >= 75 ? " att-warn" : " att-bad";
        return (
          <div key={c.code} className="exam-cc" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="exam-cc-top">
              <span className={`ses ses-${(Array.from(c.code).reduce((h, char) => h + char.charCodeAt(0), 0)) % 6}`}>
                {c.code}
              </span>
              <span className="exam-cc-name">{c.name}</span>
              <span className="exam-cc-cr">{c.credits}cr</span>
            </div>

            <CourseDotTrail sessions={c.sessions} attendance={attendance} now={now} />

            <div className="exam-cc-bar-wrap">
              <div className="exam-cc-bar">
                <div className="exam-cc-bar-fill" style={{ width: `${c.pct}%` }} />
              </div>
              <span className="exam-cc-pct">{c.pct}%</span>
            </div>

            <div className="exam-cc-meta">
              <span>{c.past}/{c.total} done</span>
              {c.attPct !== null && (
                <span className={`exam-cc-att${attTone}`}>{c.attPct}% att.</span>
              )}
              {c.nextSession && c.remaining > 0 && (
                <span className="exam-cc-next">Next: {fmtDate(c.nextSession.date)}</span>
              )}
              {c.daysToLast != null && c.daysToLast >= 0 && c.remaining === 0 && (
                <span className="exam-cc-end">ended</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(function ExamsPanel({ allClasses, enrolled, legend, now, termNumber, termStart, termEnd, attendance }) {
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
    return allClasses
      .filter(c => {
        // Is it an exam?
        let isExam = false;
        if (c.type === "exam") isExam = true;
        else if (c.type === "class") {
          const s = (c.session || "").toLowerCase();
          if (s.includes("mid term") || s.includes("end term") || s.includes("quiz")) isExam = true;
        }
        if (!isExam) return false;
        
        // Does it apply to me?
        if (examFilter === "mine" && c.code && !codes.includes(c.code)) return false;
        return true;
      })
      .map(c => {
        const [Y, M, D] = c.date.split("-").map(Number);
        const dt = new Date(Y, M - 1, D);
        const days = daysBetween(now, dt);
        return { ...c, dt, days, category: examCategory(c.name, c.session), tone: cdTone(days) };
      })
      .sort((a, b) => a.dt - b.dt);
  }, [allClasses, now, codes, examFilter]);

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
        <div className="empty">No courses enrolled. Complete setup first.</div>
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
        <div className="eh-top-label">SEMESTER PROGRESS</div>
        <div className="eh-content">
          
          <div className="eh-progress-ring">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle 
                cx="50" cy="50" r="42" fill="none" 
                stroke="url(#purpleGrad)" 
                strokeWidth="8" strokeLinecap="round" 
                strokeDasharray="264" 
                strokeDashoffset={264 - (264 * progressPct) / 100} 
                transform="rotate(-90 50 50)" 
                style={{ transition: 'stroke-dashoffset 1s ease-out' }}
              />
              <defs>
                <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#C084FC" />
                </linearGradient>
              </defs>
            </svg>
            <div className="eh-ring-text">
              <div className="eh-ring-val">{progressPct}%</div>
              <div className="eh-ring-sub">Completed</div>
            </div>
          </div>

          <div className="eh-progress-linear">
            <div className="eh-pl-text">
              <span>Semester Progress</span>
              <span>{progressPct}% Completed</span>
            </div>
            <div className="eh-pl-bar">
              <div className="eh-pl-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="eh-stats-block">
            <div className="eh-stats-row">
              <div className="eh-stat">
                <div className="eh-stat-val">{creditData.total}</div>
                <div className="eh-stat-label">Credits<br/>Loaded</div>
              </div>
              <div className="eh-stat-divider" />
              <div className="eh-stat">
                <div className="eh-stat-val">{creditData.courses.length}</div>
                <div className="eh-stat-label">Subjects<br/>&nbsp;</div>
              </div>
              <div className="eh-stat-divider" />
              <div className="eh-stat">
                <div className="eh-stat-val">{midTermCount}</div>
                <div className="eh-stat-label">Mid Terms<br/>&nbsp;</div>
              </div>
              <div className="eh-stat-divider" />
              <div className="eh-stat">
                <div className="eh-stat-val">{endTermCount}</div>
                <div className="eh-stat-label">End Terms<br/>&nbsp;</div>
              </div>
            </div>

            <div className="eh-next-exam">
              <div className="eh-ne-label">Next Exam</div>
              {nextExam ? (
                <>
                  <div className="eh-ne-title">{nextExam.name || nextExam.code || "Upcoming Exam"}</div>
                  <div className="eh-ne-meta">
                    <span className="eh-ne-days">{nextExam.days} Days</span> Remaining &bull; {fmtDate(nextExam.date)}
                  </div>
                </>
              ) : (
                <div className="eh-ne-title" style={{ opacity: 0.5 }}>No upcoming exams</div>
              )}
            </div>
          </div>

          <div className="eh-ill-block">
            <div className="eh-ill-img-wrap">
              <div className="eh-ill-glow" />
              <img src="/grad-cap-3d.png" alt="" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
              <div className="eh-ill-fallback" style={{ display: 'none' }}>
                <GraduationCap size={48} color="#A78BFA" />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Exam Countdown ── */}
      <section className="exam-card">
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
          <div className="exam-empty">
            <Trophy size={20} />
            <span>No exams scheduled yet — they'll appear here once the timetable is updated.</span>
          </div>
        ) : (
          <div className="exam-cd-grid">
            {upcoming.map((e, i) => (
              <div key={i} className={`exam-cd tone-${e.tone}`} style={{ animationDelay: `${i * 80}ms` }}>
                <div className="exam-cd-days">
                  {e.days === 0 ? "Today" : e.days === 1 ? "Tomorrow" : `${e.days}d`}
                  {e.days <= 3 && e.days >= 0 && <span className="exam-cd-pulse" />}
                </div>
                <div className="exam-cd-info">
                  <span className="exam-cd-cat">{e.category}</span>
                  <span className="exam-cd-name">{e.name}</span>
                  <span className="exam-cd-date">{fmtDate(e.date)} · {e.start}–{e.end}</span>
                </div>
                {e.days <= 3 && e.days >= 0 && (
                  <AlertTriangle size={14} className="exam-cd-alert" />
                )}
              </div>
            ))}
            {past.length > 0 && (
              <>
                <div className="exam-cd-sep">Past</div>
                {past.map((e, i) => (
                  <div key={`p${i}`} className="exam-cd tone-past" style={{ animationDelay: `${(upcoming.length + i) * 80}ms` }}>
                    <div className="exam-cd-days">{Math.abs(e.days)}d ago</div>
                    <div className="exam-cd-info">
                      <span className="exam-cd-cat">{e.category}</span>
                      <span className="exam-cd-name">{e.name}</span>
                      <span className="exam-cd-date">{fmtDate(e.date)}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
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
        <div className="exam-cr-grid">
          {creditData.courses.map((c, i) => {
            const colorIndex = (Array.from(c.code).reduce((h, char) => h + char.charCodeAt(0), 0)) % 6;
            return (
              <div key={c.code} className="exam-cr-row" style={{ animationDelay: `${i * 40}ms` }}>
                <span className={`ses ses-${colorIndex}`}>
                  {c.code}
                </span>
                <span className="exam-cr-name">{c.name}</span>
                <span className="exam-cr-area">
                  {c.area}
                </span>
                <span className={`exam-cr-val${!c.raw ? " exam-cr-missing" : ""}`}>
                  {c.raw ? `${c.credits}cr` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
});
