import React, { useMemo, useState } from "react";
import "../styles/exams.css";
import { GraduationCap, Clock, BookOpen, Trophy, CalendarDays, List, ChevronLeft, ChevronRight, Layers, CalendarClock, ChevronDown, User, MapPin, AlertTriangle, BookOpenCheck, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { sessionKey, courseSkipStats, isExamSession } from "../lib/attendance.js";
import { clsDate, fmtTime12 } from "../lib/datetime.js";
import { loadAssignments } from "../lib/assignments.js";
import { subjectClass } from "../lib/subjectColors.js";
import { CalendarEventBadgeSVG } from "./CalendarSVGs.jsx";
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

function examCategory(name, session, c) {
  const n = (name || "").toLowerCase();
  const s = (session || "").toLowerCase();
  if ((n.includes("end") && n.includes("term")) || (s.includes("end") && s.includes("term")) || (c?.date >= "2026-12-11" && c?.date <= "2026-12-20")) return "End Term";
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
  // Drop intra-word punctuation so sheet spellings like "E-Com" still match
  // the course code "ECOM" (word boundaries from spaces/newlines are kept).
  const name = (exam.name || "").toUpperCase().replace(/[-.'’_/]/g, "");
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
                            <span className="ecal-tooltip-title">{e.subjectCode || "General"} {e.category}</span>
                            <span className="ecal-tooltip-time">{e.start ? fmtTime12(e.start) : "All Day"}{e.end ? ` - ${fmtTime12(e.end)}` : ""}</span>
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
                    <Clock size={11} />{fmtTime12(s.start)}–{fmtTime12(s.end)}
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
          if (isExamSession(cl)) return false;
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
                  <svg className="ecc-ring-svg" width="56" height="56" viewBox="0 0 56 56">
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

export default React.memo(function ExamsPanel({ allClasses, enrolled, legend, allCodes, now, termNumber, termStart, termEnd, attendance, onOpenCalendarExport, onOpenCourse }) {
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
    const targetCodes = examFilter === "mine" ? codes : allCodes;
    const isSpecialCaseExam = (c) => c.type === "exam" && (c.name === "Term Registration" || c.name === "Lunch\r\nBreak");

    const seen = new Set();
    return allClasses
      .filter(c => {
        // Real exam rows (END TERM / Registration) PLUS mid-terms — the sheet
        // delivers those as type:"class" with a "MID TERM" session because the
        // feed's classify() only promotes END TERM/EXAM/REGISTRATION to exams.
        // isExamSession catches mid/end term + quiz across separator variants.
        const isExam = c.type === "exam" || (c.type === "class" && isExamSession(c));
        if (!isExam) return false;
        if (isSpecialCaseExam(c)) return false;
        const code = examSubjectCode(c, allCodes);
        if (code && !targetCodes.includes(code)) return false;
        // Dedup: mid-terms are single-section today, but guard against any
        // per-section duplication so each subject's exam shows once.
        const key = `${c.date}|${code || c.name}|${examCategory(c.name, c.session, c)}|${c.start || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(c => {
        const code = examSubjectCode(c, allCodes);
        const info = code ? legend[code] : null;
        const days = daysBetween(now, clsDate(c, "start"));
        return {
          ...c,
          subjectCode: code,
          subjectName: info?.name || c.name,
          category: examCategory(c.name, c.session, c),
          days,
          tone: cdTone(days),
          rawCredits: info?.credits,
        };
      })
      .sort((a, b) => a.days - b.days);
  }, [allClasses, examFilter, codes, allCodes, legend, now]);

  const upcoming = useMemo(() => exams.filter(e => e.days >= 0), [exams]);
  const past = useMemo(() => exams.filter(e => e.days < 0), [exams]);

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

  const termLabel = termNumber ? `Term ${["", "I", "II", "III", "IV", "V", "VI"][termNumber] || termNumber}` : "This term";

  const renderExamRow = (e, i, isPast = false) => {
    const code = e.subjectCode || e.code;
    const dayLabel = isPast
      ? `${Math.abs(e.days)} ${Math.abs(e.days) === 1 ? "day" : "days"} ago`
      : e.days === 0 ? "Today" : e.days === 1 ? "Tomorrow" : `${e.days} days`;

    return (
      <article key={`${e.date}-${code || e.name}-${i}`} className={`exam-row tone-${isPast ? "past" : e.tone}`} data-code={code || ""}>
        <div className="exam-row-date" aria-label={fmtDate(e.date)}>
          <span>{new Date(`${e.date}T00:00`).toLocaleDateString([], { month: "short" })}</span>
          <strong>{Number(e.date.slice(8, 10))}</strong>
          <small>{new Date(`${e.date}T00:00`).toLocaleDateString([], { weekday: "short" })}</small>
        </div>
        <div className="exam-row-main">
          <div className="exam-row-kicker">
            {code && <span className={`ses ${subjectClass(code)}`}>{code}</span>}
            <span>{e.category}</span>
          </div>
          <h3>{e.subjectName || e.name || code || "Scheduled exam"}</h3>
          <div className="exam-row-meta">
            {e.start && <span><Clock size={13} />{fmtTime12(e.start)}{e.end ? ` – ${fmtTime12(e.end)}` : ""}</span>}
            {e.room && <span><MapPin size={13} />{e.room}</span>}
            {code && enrolled?.[code] && <button type="button" className="exam-course-link" onClick={() => onOpenCourse?.(code)}>Open course</button>}
          </div>
        </div>
        <div className="exam-row-status">
          {!isPast && e.days <= 3 && <span className="exam-status-dot" aria-hidden="true" />}
          <strong>{dayLabel}</strong>
          <span>{isPast ? "Completed" : "remaining"}</span>
        </div>
      </article>
    );
  };

  return (
    <div className="exam-page">
      <div className="exam-aura" aria-hidden="true"><i /><i /></div>

      <header className="exam-head">
        <div>
          <span className="exam-eyebrow"><GraduationCap size={13} /> Academic control centre</span>
          <h1>Exam planner</h1>
          <p>{termLabel} · dates, countdowns and course readiness in one place</p>
        </div>
        {onOpenCalendarExport && (
          <button className="exam-cal-sync-btn" onClick={() => onOpenCalendarExport({ initialIncludeExams: true, initialSelectedCodes: null })}>
            <CalendarEventBadgeSVG size={17} />
            <span>Add to calendar</span>
            <ArrowUpRight size={14} />
          </button>
        )}
      </header>

      <section className={`exam-focus${nextExam ? ` tone-${nextExam.tone}` : " is-clear"}`}>
        <div className="exam-focus-copy">
          <span className="exam-focus-label"><CalendarClock size={14} /> Up next</span>
          {nextExam ? (
            <>
              <div className="exam-focus-tags">
                {nextExam.subjectCode && <span className={`ses ${subjectClass(nextExam.subjectCode)}`}>{nextExam.subjectCode}</span>}
                <span>{nextExam.category}</span>
              </div>
              <h2>{nextExam.subjectName || nextExam.name || "Upcoming exam"}</h2>
              <div className="exam-focus-meta">
                <span><CalendarDays size={15} />{fmtDate(nextExam.date)}</span>
                {nextExam.start && <span><Clock size={15} />{fmtTime12(nextExam.start)}{nextExam.end ? ` – ${fmtTime12(nextExam.end)}` : ""}</span>}
                {nextExam.room && <span><MapPin size={15} />{nextExam.room}</span>}
              </div>
            </>
          ) : (
            <>
              <h2>Your exam calendar is clear</h2>
              <p>No upcoming exams are currently listed for your subjects.</p>
            </>
          )}
        </div>

        {nextExam ? (
          <div className="exam-focus-countdown" aria-label={`${nextExam.days} days until the next exam`}>
            <strong>{nextExam.days}</strong>
            <span>{nextExam.days === 0 ? "today" : nextExam.days === 1 ? "day to go" : "days to go"}</span>
          </div>
        ) : (
          <div className="exam-focus-clear" aria-hidden="true"><CheckCircle2 size={36} /></div>
        )}
      </section>

      <div className="exam-stats" aria-label="Term overview">
        <div className="exam-stat"><span className="exam-stat-icon violet"><CalendarDays size={16} /></span><div><strong>{upcoming.length}</strong><span>Upcoming</span></div></div>
        <div className="exam-stat"><span className="exam-stat-icon green"><CheckCircle2 size={16} /></span><div><strong>{past.length}</strong><span>Completed</span></div></div>
        <div className="exam-stat"><span className="exam-stat-icon amber"><BookOpen size={16} /></span><div><strong>{creditData.total}</strong><span>Credits</span></div></div>
        <div className="exam-stat"><span className="exam-stat-icon blue"><Layers size={16} /></span><div><strong>{progressPct}%</strong><span>Term progress</span></div></div>
      </div>

      <section className="exam-section exam-schedule-section">
        <div className="exam-section-head">
          <div>
            <span className="exam-section-kicker">Schedule</span>
            <h2>Exam timeline</h2>
            <p>{upcoming.length ? `${upcoming.length} upcoming across the selected subjects` : "No upcoming exams in this view"}</p>
          </div>
          <div className="exam-toolbar">
            <div className="exam-filter-pill" aria-label="Exam subject filter">
              <button className={`exam-fp-btn${examFilter === "mine" ? " on" : ""}`} onClick={() => setExamFilter("mine")} aria-pressed={examFilter === "mine"}>My subjects</button>
              <button className={`exam-fp-btn${examFilter === "all" ? " on" : ""}`} onClick={() => setExamFilter("all")} aria-pressed={examFilter === "all"}>All</button>
            </div>
            <div className="exam-view-toggle" aria-label="Exam layout">
              <button className={`exam-vt-btn${cdView === "list" ? " on" : ""}`} onClick={() => setCdView("list")} aria-label="List view" aria-pressed={cdView === "list"}><List size={15} /></button>
              <button className={`exam-vt-btn${cdView === "calendar" ? " on" : ""}`} onClick={() => setCdView("calendar")} aria-label="Calendar view" aria-pressed={cdView === "calendar"}><CalendarDays size={15} /></button>
            </div>
          </div>
        </div>

        {cdView === "calendar" ? (
          <ExamCalendar exams={exams} now={now} termStart={termStart} termEnd={termEnd} />
        ) : exams.length === 0 ? (
          <EmptyState compact icon={Trophy} title="No exams scheduled yet" sub="They’ll appear here when the timetable is updated." />
        ) : (
          <div className="exam-timeline">
            {upcoming.length > 0 && <div className="exam-list-label"><span>Coming up</span><span>{upcoming.length}</span></div>}
            {upcoming.map((e, i) => renderExamRow(e, i))}
            {past.length > 0 && (
              <details className="exam-past">
                <summary><span>Past exams</span><span>{past.length}<ChevronDown size={15} /></span></summary>
                <div className="exam-past-list">{past.map((e, i) => renderExamRow(e, i, true))}</div>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="exam-section">
        <div className="exam-section-head">
          <div>
            <span className="exam-section-kicker">Readiness</span>
            <h2>Course progress</h2>
            <p>Expand a subject to see attendance, remaining classes and open work.</p>
          </div>
          <span className="exam-section-count">{creditData.courses.length} courses</span>
        </div>
        <CourseCountdown courses={creditData.courses} allClasses={allClasses} enrolled={enrolled} attendance={attendance} now={now} />
      </section>

      <section className="exam-section exam-credits-card">
        <div className="exam-section-head">
          <div>
            <span className="exam-section-kicker">Course load</span>
            <h2>Credits by course</h2>
            <p>{midTermCount} mid term{midTermCount === 1 ? "" : "s"} · {endTermCount} end term{endTermCount === 1 ? "" : "s"} listed</p>
          </div>
          <span className="exam-total-credits"><strong>{creditData.total}</strong> credits</span>
        </div>
        <div className="exam-cr-grid-new">
          {creditData.courses.map((c, i) => (
            <div key={c.code} className="exam-cr-badge" style={{ animationDelay: `${i * 40}ms` }}>
              <span className={`ses ${subjectClass(c.code)}`}>{c.code}</span>
              <div className="ecr-content"><span className="ecr-area">{c.area}</span><span className="ecr-name">{c.name}</span></div>
              <span className={`ecr-val${!c.raw ? " ecr-missing" : ""}`}>{c.raw ? c.credits : "—"}<small>cr</small></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
});
