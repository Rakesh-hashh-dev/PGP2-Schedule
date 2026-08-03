import React, { useMemo, useState, useEffect } from "react";
import "../styles/fullschedule.css";
import { ArrowLeft, Clock, MapPin, User, SlidersHorizontal, X, ArrowUp, Calendar, ChevronLeft, ChevronRight, List, CalendarDays, GraduationCap } from "lucide-react";
import { subjectClass } from "../lib/subjectColors.js";
import { isExamSession } from "../lib/attendance.js";

function examCategory(name, session) {
  const n = (name || "").toLowerCase();
  const s = (session || "").toLowerCase();
  if ((n.includes("end") && n.includes("term")) || (s.includes("end") && s.includes("term"))) return "End Term";
  if ((n.includes("mid") && n.includes("term")) || (s.includes("mid") && s.includes("term"))) return "Mid Term";
  if (n.includes("quiz") || s.includes("quiz")) return "Quiz";
  return "Exam";
}

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso) {
  const [Y, M, D] = iso.split("-").map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

function fmtShort(iso) {
  const [Y, M, D] = iso.split("-").map(Number);
  return new Date(Y, M - 1, D).toLocaleDateString([], { day: "numeric", month: "short" });
}

function getWeekStart(iso) {
  const [Y, M, D] = iso.split("-").map(Number);
  const d = new Date(Y, M - 1, D);
  const dow = d.getDay(); // 0=Sun
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return isoOf(d);
}

function assignLanes(classes) {
  const sorted = [...classes].sort((a, b) => toMin(a.start) - toMin(b.start));
  const lanes = [];
  for (const cls of sorted) {
    let placed = false;
    for (let li = 0; li < lanes.length; li++) {
      const last = lanes[li][lanes[li].length - 1];
      if (toMin(last.end) <= toMin(cls.start)) { lanes[li].push(cls); placed = true; break; }
    }
    if (!placed) lanes.push([cls]);
  }
  return lanes;
}

const HOUR_W = 96;  // px per hour (horizontal week view)
const LANE_H = 64;  // px per lane row
const TODAY = isoOf(new Date());

export default React.memo(function FullSchedulePage({ allClasses, enrolled, legend, termLabel, onBack, jumpToDate, setJumpToDate, jumpToSession, setJumpToSession }) {
  const [filterCodes, setFilterCodes] = useState([]);
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [calWeek, setCalWeek] = useState(() => getWeekStart(TODAY));
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const [selectedDate, setSelectedDate] = useState(null);
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  const [tooltip, setTooltip] = useState(null);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);

  useEffect(() => {
    const id = setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); }, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (jumpToDate) {
      const t = setTimeout(() => {
        const el = document.getElementById(`day-${jumpToDate}`);
        if (el) {
          const headerOffset = 100;
          const offsetPosition = el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: "smooth" });
        }
        if (setJumpToDate) setJumpToDate(null);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [jumpToDate, setJumpToDate]);

  // Jump to a specific class row (from an announcement) — scroll to its day,
  // then pulse-highlight the matching card so it's obvious which session changed.
  useEffect(() => {
    if (jumpToSession) {
      const { date, code, start } = jumpToSession;
      const t = setTimeout(() => {
        const dayEl = date && document.getElementById(`day-${date}`);
        if (dayEl) {
          const headerOffset = 100;
          const offsetPosition = dayEl.getBoundingClientRect().top + window.pageYOffset - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: "smooth" });
        }
        const key = `${date || ""}-${code || ""}-${start || ""}`;
        const cardEl = document.querySelector(`[data-class-key="${window.CSS?.escape ? CSS.escape(key) : key}"]`);
        if (cardEl) {
          cardEl.classList.add("fs-card-jump-highlight");
          setTimeout(() => cardEl.classList.remove("fs-card-jump-highlight"), 2200);
        }
        if (setJumpToSession) setJumpToSession(null);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [jumpToSession, setJumpToSession]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const baseClasses = useMemo(() => {
    // Separate regular classes and exam entries
    const examRows = allClasses
      .filter(c => c.type === "exam" || (c.type === "class" && isExamSession(c)))
      .map(c => ({ ...c, isExam: true }));

    let classes;
    if (showAllClasses) {
      classes = allClasses.filter(c => c.type === "class" && !isExamSession(c));
    } else if (!enrolled) {
      return [];
    } else {
      classes = allClasses
        .filter(c => c.type === "class" && !isExamSession(c))
        .filter(c => { const sec = enrolled[c.code]; return sec !== undefined && (c.section === sec || c.section === "Single"); });
    }

    // For exams: include all (type=exam are global), or filter subject-specific ones if "my schedule"
    const enrolledCodes = enrolled ? Object.keys(enrolled) : [];
    const filteredExams = showAllClasses
      ? examRows
      : examRows.filter(c => {
          // Generic exams (no code) show to everyone; subject-specific only if enrolled
          if (!c.code) return true;
          return enrolledCodes.includes(c.code);
        });

    const combined = [...classes, ...filteredExams];
    return combined.sort((a, b) => a.date.localeCompare(b.date) || toMin(a.start) - toMin(b.start));
  }, [allClasses, enrolled, showAllClasses]);

  const subjectCodes = useMemo(() => {
    const codes = [...new Set(baseClasses.map(c => c.code).filter(Boolean))];
    codes.sort((a, b) => (legend[a]?.name || a).localeCompare(legend[b]?.name || b));
    return codes;
  }, [baseClasses, legend]);

  const filtered = useMemo(() => {
    if (filterCodes.includes("__EXAMS__")) return baseClasses.filter(c => c.isExam);
    if (filterCodes.length > 0) return baseClasses.filter(c => filterCodes.includes(c.code));
    return baseClasses;
  }, [baseClasses, filterCodes]);

  const grouped = useMemo(() => {
    if (filtered.length === 0) return [];
    const classMap = new Map();
    for (const c of filtered) {
      if (!classMap.has(c.date)) classMap.set(c.date, []);
      classMap.get(c.date).push(c);
    }
    const classDates = [...classMap.keys()].sort();
    const result = [];
    for (let i = 0; i < classDates.length; i++) {
      result.push({ type: "day", date: classDates[i], items: classMap.get(classDates[i]) });
      if (i < classDates.length - 1) {
        const cur = new Date(classDates[i]);
        const next = new Date(classDates[i + 1]);
        const gapDays = Math.round((next - cur) / 86400000) - 1;
        if (gapDays === 1) {
          const fd = new Date(cur); fd.setDate(fd.getDate() + 1);
          result.push({ type: "free", date: isoOf(fd) });
        } else if (gapDays >= 2) {
          const fd = new Date(cur); fd.setDate(fd.getDate() + 1);
          const td = new Date(next); td.setDate(td.getDate() - 1);
          result.push({ type: "gap", from: isoOf(fd), to: isoOf(td), count: gapDays });
        }
      }
    }
    return result;
  }, [filtered]);

  useEffect(() => {
    if (viewMode === "list" && !jumpToDate && !jumpToSession && !hasScrolledToToday && grouped.length > 0) {
      const t = setTimeout(() => {
        let el = document.getElementById(`day-${TODAY}`);
        if (!el) {
          const classDates = grouped.filter(g => g.type === "day").map(g => g.date);
          const nextDate = classDates.find(d => d >= TODAY);
          if (nextDate) el = document.getElementById(`day-${nextDate}`);
        }
        if (el) {
          const headerOffset = 100;
          const offsetPosition = el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: "smooth" });
        }
        setHasScrolledToToday(true);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [viewMode, jumpToDate, jumpToSession, grouped, hasScrolledToToday]);

  // ── Calendar week data ──
  const dateClassMap = useMemo(() => {
    const map = new Map();
    for (const c of filtered) {
      if (!map.has(c.date)) map.set(c.date, []);
      map.get(c.date).push(c);
    }
    return map;
  }, [filtered]);

  const nextUpcomingCls = useMemo(() => {
    for (const c of filtered) {
      if (c.date < TODAY) continue;
      if (c.date === TODAY && toMin(c.start) <= nowMin) continue;
      return c;
    }
    return null;
  }, [filtered, nowMin]);

  const weekDays = useMemo(() => {
    const days = [];
    const [Y, M, D] = calWeek.split("-").map(Number);
    for (let i = 0; i < 7; i++) {
      const dt = new Date(Y, M - 1, D + i);
      days.push(isoOf(dt));
    }
    return days;
  }, [calWeek]);

  // Fixed time range across all filtered classes for a stable grid height
  const timeRange = useMemo(() => {
    if (filtered.length === 0) return { startH: 8, endH: 19 };
    const startH = Math.floor(Math.min(...filtered.map(c => toMin(c.start))) / 60);
    const endH = Math.ceil(Math.max(...filtered.map(c => toMin(c.end))) / 60);
    return { startH: Math.min(startH, 8), endH: Math.max(endH, 19) };
  }, [filtered]);

  const hourSlots = useMemo(() => {
    const slots = [];
    for (let h = timeRange.startH; h <= timeRange.endH; h++) slots.push(h);
    return slots;
  }, [timeRange]);

  const weekLabel = useMemo(() => {
    const fmt = (iso) => {
      const [Y, M, D] = iso.split("-").map(Number);
      return new Date(Y, M - 1, D).toLocaleDateString([], { day: "numeric", month: "short" });
    };
    const [Y] = weekDays[0].split("-").map(Number);
    return `${fmt(weekDays[0])} – ${fmt(weekDays[6])}, ${Y}`;
  }, [weekDays]);

  function showTooltip(e, cls) {
    const rect = e.currentTarget.getBoundingClientRect();
    const above = rect.top > 180;
    setTooltip({ cls, x: rect.left + rect.width / 2, y: above ? rect.top - 10 : rect.bottom + 10, above });
  }

  function shiftWeek(delta) {
    const [Y, M, D] = calWeek.split("-").map(Number);
    setCalWeek(isoOf(new Date(Y, M - 1, D + delta * 7)));
  }

  const monthGrid = useMemo(() => {
    const { year, month } = calMonth;
    const firstDow = new Date(year, month, 1).getDay();
    const offset = firstDow === 0 ? 6 : firstDow - 1; // Mon-start offset
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = offset; i > 0; i--) cells.push({ iso: isoOf(new Date(year, month, 1 - i)), inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ iso: isoOf(new Date(year, month, d)), inMonth: true });
    let trailing = 1;
    while (cells.length % 7 !== 0) cells.push({ iso: isoOf(new Date(year, month + 1, trailing++)), inMonth: false });
    return cells;
  }, [calMonth]);

  const monthLabel = useMemo(() =>
    new Date(calMonth.year, calMonth.month, 1).toLocaleDateString([], { month: "long", year: "numeric" })
  , [calMonth]);

  function shiftMonth(delta) {
    setCalMonth(prev => {
      let m = prev.month + delta, y = prev.year;
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
    setSelectedDate(null);
  }

  const totalSessions = filtered.length;

  return (
    <div className="fs-page">
      {/* Header */}
      <div className="fs-header">
        <button className="fr-btn fr-btn-secondary fs-back" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="fs-header-info">
          <h1 className="fs-title">Full Schedule</h1>
          <span className="fs-subtitle">
            {filterCodes.length === 1
              ? (legend[filterCodes[0]]?.name || filterCodes[0])
              : `${filterCodes.length > 1 ? filterCodes.length : subjectCodes.length} subjects`} · {totalSessions} sessions
            {termLabel && <> · {termLabel}</>}
          </span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="cal-controls">
        {/* View toggle */}
        <div className="cal-view-toggle">
          <button className={`cal-toggle-btn ${viewMode === "list" ? "cal-toggle-active" : ""}`} onClick={() => setViewMode("list")}>
            <List size={13} /> List
          </button>
          <button className={`cal-toggle-btn ${viewMode === "calendar" ? "cal-toggle-active" : ""}`} onClick={() => setViewMode("calendar")}>
            <Calendar size={13} /> Week
          </button>
          <button className={`cal-toggle-btn ${viewMode === "month" ? "cal-toggle-active" : ""}`} onClick={() => setViewMode("month")}>
            <CalendarDays size={13} /> Month
          </button>
        </div>

        <div className="cal-controls-right">
          <button
            className={`cal-ctrl-btn${filterCodes.length > 0 ? " cal-ctrl-btn-on" : ""}`}
            onClick={() => setFilterModalOpen(true)}
          >
            <SlidersHorizontal size={14} />
            {filterCodes.includes("__EXAMS__")
              ? "Exams"
              : filterCodes.length > 0
                ? (filterCodes.length === 1 ? filterCodes[0] : `${filterCodes[0]} +${filterCodes.length - 1}`)
                : (!showAllClasses ? "My Schedule" : "All Subjects")}
            {filterCodes.length > 0 && !filterCodes.includes("__EXAMS__") && <span className="cal-ctrl-count">{filterCodes.length}</span>}
          </button>

          <button className="cal-ctrl-btn" onClick={() => setDateModalOpen(true)}>
            <Calendar size={14} /> Select Date
          </button>
        </div>
      </div>

      {/* Date Jump Modal */}
      {dateModalOpen && (
        <div className="filter-modal-overlay" onClick={() => setDateModalOpen(false)}>
          <div className="filter-modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3>Jump to Date</h3>
              <button onClick={() => setDateModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="filter-modal-scroll" style={{ padding: "20px" }}>
              <input
                type="date"
                autoFocus
                onChange={(e) => {
                  const targetDate = e.target.value;
                  if (!targetDate) return;

                  if (viewMode === "list") {
                    let el = document.getElementById(`day-${targetDate}`);
                    if (!el) {
                      const classDates = grouped.filter(g => g.type === "day").map(g => g.date);
                      const nextDate = classDates.find(d => d >= targetDate);
                      if (nextDate) el = document.getElementById(`day-${nextDate}`);
                    }
                    if (el) {
                      const offsetPosition = el.getBoundingClientRect().top + window.pageYOffset - 100;
                      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                    } else {
                      alert("There are no upcoming classes from the selected date.");
                    }
                  } else if (viewMode === "calendar") {
                    setCalWeek(getWeekStart(targetDate));
                  } else if (viewMode === "month") {
                    const [Y, M] = targetDate.split("-").map(Number);
                    setCalMonth({ year: Y, month: M - 1 });
                    setSelectedDate(targetDate);
                  }

                  setDateModalOpen(false);
                }}
                style={{
                  width: "100%", padding: "12px 14px", fontSize: "15px",
                  borderRadius: "10px", border: "1px solid var(--border)",
                  background: "var(--bg)", color: "var(--text)", fontFamily: "var(--body)"
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {filterModalOpen && (
        <div className="filter-modal-overlay" onClick={() => setFilterModalOpen(false)}>
          <div className="filter-modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3>Filter Schedule</h3>
              <button onClick={() => setFilterModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="filter-modal-scroll" style={{ padding: "20px" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                <button
                  className={`fs-chip ${filterCodes.length === 0 && !showAllClasses ? "fs-chip-on" : ""}`}
                  onClick={() => { setFilterCodes([]); setShowAllClasses(false); }}
                  style={{ flex: 1, justifyContent: "center", padding: "12px", fontSize: "13.5px" }}
                >
                  My Schedule
                </button>
                <button
                  className={`fs-chip ${filterCodes.length === 0 && showAllClasses ? "fs-chip-on" : ""}`}
                  onClick={() => { setFilterCodes([]); setShowAllClasses(true); }}
                  style={{ flex: 1, justifyContent: "center", padding: "12px", fontSize: "13.5px" }}
                >
                  Whole Timetable
                </button>
              </div>

              <h4 style={{ fontSize: "11.5px", fontWeight: "700", color: "var(--muted)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Filter by Subject
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {/* Exams chip */}
                <button
                  className={`fs-chip fs-chip-exams ${filterCodes.includes("__EXAMS__") ? "fs-chip-exams-on" : ""}`}
                  onClick={() => setFilterCodes(filterCodes.includes("__EXAMS__") ? [] : ["__EXAMS__"])}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <GraduationCap size={12} /> Exams
                </button>
                {subjectCodes.map(code => {
                  const section = enrolled ? enrolled[code] : null;
                  const showSection = section && section !== "Single";
                  const isOn = filterCodes.includes(code);
                  return (
                    <button
                      key={code}
                      className={`fs-chip ${isOn ? "fs-chip-on" : ""}`}
                      onClick={() => {
                        setFilterCodes(isOn ? filterCodes.filter(c => c !== code) : [...filterCodes, code]);
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      {code}
                      {showSection && !showAllClasses && (
                        <span style={{
                          background: isOn ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)",
                          color: isOn ? "#fff" : "var(--muted)",
                          padding: "1px 6px", borderRadius: "6px",
                          fontSize: "11px", fontWeight: "700",
                        }}>
                          {section}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: "32px" }}>
                <button
                  onClick={() => setFilterModalOpen(false)}
                  style={{
                    width: "100%", padding: "14px", borderRadius: "12px",
                    background: "var(--ink)", color: "var(--bone)",
                    fontFamily: "var(--body)", fontSize: "15px", fontWeight: "700",
                    border: "none", cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(21,24,43,0.15)", transition: "transform 0.1s"
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
                  onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                  onTouchStart={e => e.currentTarget.style.transform = "scale(0.98)"}
                  onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  Show Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === "list" && (
        <div className="fs-list">
          {grouped.length === 0 ? (
            <p className="fr-empty" style={{ textAlign: "center", padding: "40px 0" }}>No sessions found.</p>
          ) : (
            grouped.map((entry, idx) => {
              if (entry.type === "free") {
                return (
                  <div key={entry.date} id={`day-${entry.date}`} className="fs-free-day">
                    <span className="fs-free-date">
                      {fmtDate(entry.date)} 
                      <span style={{ opacity: 0.5, margin: "0 6px" }}>·</span> 
                      <span style={{ fontWeight: 600 }}>No classes</span>
                    </span>
                  </div>
                );
              }
              if (entry.type === "gap") {
                const nextEntry = grouped[idx + 1];
                let nextLabel = null;
                if (nextEntry && nextEntry.type === "day" && nextEntry.items.length > 0) {
                  const nextCls = nextEntry.items[0];
                  const dObj = new Date(nextEntry.date);
                  const dow = dObj.toLocaleDateString([], { weekday: "short" });
                  const dNum = dObj.getDate();
                  const dMo = dObj.toLocaleDateString([], { month: "short" });
                  nextLabel = `${dow}, ${dMo} ${dNum} · ${nextCls.code}`;
                }
                const gapDays = [];
                const fd = new Date(entry.from);
                const td = new Date(entry.to);
                for (let d = new Date(fd); d <= td; d.setDate(d.getDate() + 1)) {
                  if (gapDays.length < 8) gapDays.push(d.getDate());
                }
                const hasMore = entry.count > 8;

                return (
                  <details key={`gap-${idx}`} className="fs-gap-row">
                    <summary className="fs-gap-summary">
                      <span className="fs-gap-range">{fmtShort(entry.from)} – {fmtShort(entry.to)}</span>
                      <span className="fs-gap-label">No classes · {entry.count} days</span>
                      {nextLabel && <span className="fs-gap-next">→ Next: {nextLabel}</span>}
                    </summary>
                    <div className="fs-gap-bubbles">
                      {gapDays.map((d, di) => <span key={di} className="fs-gap-bubble">{d}</span>)}
                      {hasMore && <span className="fs-gap-bubble-more">+{entry.count - 8}</span>}
                    </div>
                  </details>
                );
              }
              const { date, items } = entry;
              return (
                <div key={date} id={`day-${date}`} className="fs-day">
                  <div className="fs-day-header">
                    <span className="fs-day-label">{fmtDate(date)}</span>
                    <span className="fs-day-count">{items.length} session{items.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="fs-day-items">
                    {items.map((c, i) => {
                      const subjCls = subjectClass(c.code);
                      const showSection = c.section && c.section !== "Single";
                      const isNow = date === TODAY && nowMin >= toMin(c.start) && nowMin <= toMin(c.end);
                      const isNext = c === nextUpcomingCls;
                      let countdownStr = null;
                      if (isNext) {
                        const nextTime = new Date(`${c.date}T${c.start}:00`);
                        const nowTime = new Date();
                        const diffMin = Math.floor((nextTime - nowTime) / 60000);
                        if (diffMin > 0 && diffMin < 24 * 60) {
                           const h = Math.floor(diffMin / 60);
                           const m = diffMin % 60;
                           countdownStr = h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
                        } else if (diffMin > 0) {
                           countdownStr = `in ${Math.floor(diffMin/1440)}d`;
                        }
                      }
                      
                      if (c.isExam) {
                        const cat = examCategory(c.name, c.session);
                        return (
                          <div
                            key={i}
                            data-class-key={`${c.date}-${c.code}-${c.start}`}
                            className="fs-card fs-card-exam"
                            style={{ animationDelay: `${i * 0.055}s` }}
                          >
                            <div className="fs-card-accent fs-exam-accent" />
                            <div className="fs-card-body">
                              <div className="fs-card-top">
                                <span className="fs-card-name fs-exam-name">
                                  <GraduationCap size={14} className="fs-exam-icon" />
                                  {c.name || (c.code ? `${c.code} Exam` : "Exam")}
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
                                  <span className="fs-exam-cat-badge">{cat}</span>
                                  {c.code && <span className={`ses ${subjectClass(c.code)} fs-exam-code`}>{c.code}</span>}
                                </div>
                              </div>
                              <div className="fs-card-meta">
                                <span className="fs-meta-item"><Clock size={13} /> {c.start} – {c.end}</span>
                                {c.room && (
                                  <span className="fs-meta-item"><MapPin size={13} />
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.room + " exam hall")}`} target="_blank" rel="noreferrer" className="fs-meta-link">
                                      {c.room}
                                    </a>
                                  </span>
                                )}
                                {c.faculty && <span className="fs-meta-item"><User size={13} /> {c.faculty}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={i}
                          data-class-key={`${c.date}-${c.code}-${c.start}`}
                          className={`fs-card ${isNow ? "fs-card-now" : ""}`}
                          style={{ animationDelay: `${i * 0.055}s` }}
                        >
                          <div className={`fs-card-accent ${subjCls}`} />
                          <div className="fs-card-body">
                            <div className="fs-card-top">
                              <span className="fs-card-name">
                                {isNow && <span className="fs-live-pulse" style={{ display: 'inline-block' }} />}
                                {c.name}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
                                {showSection && (
                                  <span style={{
                                    fontSize: "10px", fontWeight: "700", padding: "2px 6px",
                                    background: "var(--surface)", borderRadius: "6px",
                                    color: "var(--muted)", letterSpacing: "0.5px", textTransform: "uppercase"
                                  }}>
                                    Sec {c.section}
                                  </span>
                                )}
                                <span className={`ses ${subjCls}`}>{c.code} {c.session}</span>
                              </div>
                              {countdownStr && <span className="fs-upcoming-badge">{countdownStr}</span>}
                            </div>
                            <div className="fs-card-meta">
                              <span className="fs-meta-item"><Clock size={13} /> {c.start} – {c.end}</span>
                              <span className="fs-meta-item">
                                <MapPin size={13} /> 
                                {c.room ? (
                                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.room + " classroom")}`} target="_blank" rel="noreferrer" className="fs-meta-link">
                                    {c.room}
                                  </a>
                                ) : "TBA"}
                              </span>
                              {c.faculty && <span className="fs-meta-item"><User size={13} /> {c.faculty}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── WEEK CALENDAR VIEW ── */}
      {viewMode === "calendar" && (
        <div className="cal-week">
          {/* Week navigation */}
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={() => shiftWeek(-1)} aria-label="Previous week">
              <ChevronLeft size={16} />
            </button>
            <span className="cal-nav-label">{weekLabel}</span>
            <button className="cal-nav-btn" onClick={() => shiftWeek(1)} aria-label="Next week">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Horizontal timeline — days as rows, time flows left→right */}
          <div className="cal-h-outer">
            {/* Time-of-day header — uses absolute labels so coordinate system matches event blocks exactly */}
            <div className="cal-h-head" style={{ minWidth: 64 + (hourSlots.length - 1) * HOUR_W }}>
              <div className="cal-h-corner" />
              {/* Absolutely-positioned labels: label for hour h sits at offset (h-startH)*HOUR_W */}
              <div className="cal-h-timebar" style={{ position: "relative", flex: 1, minWidth: (hourSlots.length - 1) * HOUR_W }}>
                {hourSlots.map((h, i) => (
                  <div
                    key={h}
                    className="cal-h-tc"
                    style={{ left: i * HOUR_W }}
                  >
                    {`${String(h).padStart(2, "0")}:00`}
                  </div>
                ))}
              </div>
            </div>

            {/* One row per day */}
            {weekDays.map(date => {
              const [Y, M, D] = date.split("-").map(Number);
              const dt = new Date(Y, M - 1, D);
              const isToday = date === TODAY;
              const dayClasses = dateClassMap.get(date) || [];
              const lanes = assignLanes(dayClasses);
              const maxLanes = lanes.length || 1;
              const rowH = maxLanes * LANE_H;
              const events = lanes.flatMap((lane, li) =>
                lane.map(cls => ({ ...cls, laneIdx: li, totalLanes: maxLanes }))
              );
              // totalW uses (length-1) because the last hour label marks the END of the grid,
              // we don't need a full extra column after it.
              const totalW = (hourSlots.length - 1) * HOUR_W;
              const nowLeft = (nowMin - timeRange.startH * 60) / 60 * HOUR_W;
              const showNow = isToday && nowMin >= timeRange.startH * 60 && nowMin <= timeRange.endH * 60;

              return (
                <div key={date} className={`cal-h-row${isToday ? " cal-h-row-today" : ""}`}>
                  {/* Sticky day label */}
                  <div className={`cal-h-daylabel${isToday ? " cal-h-day-today" : ""}`} style={{ height: rowH }}>
                    <span className="cal-h-dow">
                      {dt.toLocaleDateString([], { weekday: "short" }).slice(0, 3)}
                    </span>
                    <span className={`cal-h-dnum${isToday ? " cal-h-dnum-today" : ""}${dayClasses.length > 0 && !isToday ? " cal-h-dnum-has" : ""}`}>
                      {D}
                    </span>
                  </div>

                  {/* Row content — shares pixel coordinate system with timebar */}
                  <div className="cal-h-rowbody" style={{ height: rowH, minWidth: totalW }}>
                    {/* Vertical hour + half-hour dividers at exact same positions as header labels */}
                    {hourSlots.map((h, i) => (
                      <React.Fragment key={h}>
                        <div className="cal-h-vline" style={{ left: i * HOUR_W }} />
                        {i < hourSlots.length - 1 && (
                          <div className="cal-h-vhalf" style={{ left: i * HOUR_W + HOUR_W / 2 }} />
                        )}
                      </React.Fragment>
                    ))}

                    {/* Current time indicator */}
                    {showNow && (
                      <div className="cal-h-now" style={{ left: nowLeft }}>
                        <div className="cal-h-now-dot" />
                      </div>
                    )}

                    {/* Class event blocks */}
                    {events.map((cls, i) => {
                      const left = (toMin(cls.start) - timeRange.startH * 60) / 60 * HOUR_W;
                      const width = Math.max((toMin(cls.end) - toMin(cls.start)) / 60 * HOUR_W - 6, 40);
                      const top = cls.laneIdx * LANE_H + 5;
                      const height = LANE_H - 10;
                      if (cls.isExam) {
                        return (
                          <div
                            key={i}
                            className="cal-h-event cal-h-event-exam"
                            style={{ left, width, top, height }}
                            onMouseEnter={(e) => showTooltip(e, cls)}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            <span className="cal-ev-top">
                              <GraduationCap size={10} style={{ flexShrink: 0 }} />
                              <span className="cal-ev-code">{cls.code || "EXAM"}</span>
                              {width > 128 && <span className="cal-ev-time">{cls.start}–{cls.end}</span>}
                            </span>
                            {width > 88 && <span className="cal-ev-name">{examCategory(cls.name, cls.session)}</span>}
                            {width <= 128 && width > 54 && <span className="cal-ev-time">{cls.start}–{cls.end}</span>}
                          </div>
                        );
                      }
                      return (
                        <div
                          key={i}
                          className={`cal-h-event ${subjectClass(cls.code)}`}
                          style={{ left, width, top, height }}
                          onMouseEnter={(e) => showTooltip(e, cls)}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          <span className="cal-ev-top">
                            <span className="cal-ev-dot" />
                            <span className="cal-ev-code">{cls.code}</span>
                            {width > 128 && <span className="cal-ev-time">{cls.start}–{cls.end}</span>}
                          </span>
                          {width > 88 && <span className="cal-ev-name">{cls.name}</span>}
                          {width <= 128 && width > 54 && <span className="cal-ev-time">{cls.start}–{cls.end}</span>}
                        </div>
                      );
                    })}

                    {/* Break / free-slot highlights between consecutive classes */}
                    {(() => {
                      // Only use lane-0 events, sorted by start time, to find gaps
                      const lane0 = (lanes[0] || []).slice().sort((a, b) => toMin(a.start) - toMin(b.start));
                      const gaps = [];
                      for (let gi = 0; gi < lane0.length - 1; gi++) {
                        const gapStart = toMin(lane0[gi].end);
                        const gapEnd   = toMin(lane0[gi + 1].start);
                        const gapMin   = gapEnd - gapStart;
                        if (gapMin < 15) continue; // ignore tiny overlaps/buffers
                        const left  = (gapStart - timeRange.startH * 60) / 60 * HOUR_W + 3;
                        const width = (gapMin / 60) * HOUR_W - 6;
                        const label = gapMin >= 60
                          ? `${Math.floor(gapMin / 60)}h${gapMin % 60 ? ` ${gapMin % 60}m` : ""} free`
                          : `${gapMin}m free`;
                        gaps.push({ left, width, label, key: gi });
                      }
                      return gaps.map(g => (
                        <div
                          key={`gap-${g.key}`}
                          className="cal-h-break"
                          style={{ left: g.left, width: g.width, top: 5, height: LANE_H - 10 }}
                        >
                          {g.width > 44 && <span className="cal-h-break-label">{g.label}</span>}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0", fontSize: "14px" }}>
              No sessions found.
            </p>
          )}
        </div>
      )}

      {/* ── MONTH CALENDAR VIEW ── */}
      {viewMode === "month" && (
        <div className="cal-month">
          {/* Month navigation */}
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <span className="cal-nav-label">{monthLabel}</span>
            <button className="cal-nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>

          {/* Day-of-week headers */}
          <div className="cal-month-headers">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
              <div key={d} className="cal-month-dow">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="cal-month-grid">
            {monthGrid.map((cell, i) => {
              const classes = dateClassMap.get(cell.iso) || [];
              const isToday = cell.iso === TODAY;
              const isSelected = cell.iso === selectedDate;
              const regularClasses = classes.filter(c => !c.isExam);
              const examClasses = classes.filter(c => c.isExam);
              const hasCls = cell.inMonth && classes.length > 0;
              const hasExam = cell.inMonth && examClasses.length > 0;
              const D = parseInt(cell.iso.split("-")[2]);
              return (
                <div
                  key={i}
                  className={`cal-month-cell${!cell.inMonth ? " cal-month-out" : ""}${isToday ? " cal-month-cell-today" : ""}${isSelected ? " cal-month-selected" : ""}${hasCls ? " cal-month-has-cls" : ""}${hasExam ? " cal-month-has-exam" : ""}`}
                  onClick={() => hasCls && setSelectedDate(isSelected ? null : cell.iso)}
                >
                  <span className={`cal-month-dnum${isToday ? " cal-dnum-today" : ""}`}>{D}</span>
                  {hasExam && (
                    <div className="cal-month-exam-dot" title={`${examClasses.length} exam${examClasses.length > 1 ? "s" : ""}`}>
                      <GraduationCap size={9} />
                    </div>
                  )}
                  {hasCls && (
                    <div className="cal-month-count-wrap">
                      {regularClasses.length > 0 && <span className="cal-month-count">{regularClasses.length}</span>}
                      {regularClasses.length > 0 && <span className="cal-month-count-label">{regularClasses.length === 1 ? "class" : "classes"}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected day detail panel */}
          {selectedDate && (
            <div className="cal-day-panel">
              <div className="cal-day-panel-header">
                <span className="cal-day-panel-date">{fmtDate(selectedDate)}</span>
                <button className="cal-day-panel-close" onClick={() => setSelectedDate(null)}><X size={16} /></button>
              </div>
              <div className="cal-day-panel-items">
                {(dateClassMap.get(selectedDate) || []).map((c, i) => {
                  const subjCls = subjectClass(c.code);
                  const showSection = c.section && c.section !== "Single";
                  return (
                    <div key={i} className="fs-card">
                      <div className={`fs-card-accent ${subjCls}`} />
                      <div className="fs-card-body">
                        <div className="fs-card-top">
                          <span className="fs-card-name">{c.name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {showSection && (
                              <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 6px", background: "var(--surface)", borderRadius: "6px", color: "var(--muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                                Sec {c.section}
                              </span>
                            )}
                            <span className={`ses ${subjCls}`}>{c.code} {c.session}</span>
                          </div>
                        </div>
                        <div className="fs-card-meta">
                          <span className="fs-meta-item"><Clock size={13} /> {c.start} – {c.end}</span>
                          <span className="fs-meta-item"><MapPin size={13} /> {c.room || "TBA"}</span>
                          {c.faculty && <span className="fs-meta-item"><User size={13} /> {c.faculty}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Premium floating tooltip */}
      {tooltip && (
        <div
          className={`ev-tooltip${tooltip.above ? " ev-tip-above" : " ev-tip-below"}`}
          style={{
            left: Math.max(8, Math.min(tooltip.x - 130, window.innerWidth - 284)),
            top: tooltip.y,
          }}
        >
          <div className="ev-tip-code">{tooltip.cls.code} · Session {tooltip.cls.session}</div>
          <div className="ev-tip-name">{tooltip.cls.name}</div>
          <div className="ev-tip-divider" />
          <div className="ev-tip-row"><Clock size={12} />{tooltip.cls.start} – {tooltip.cls.end}</div>
          {tooltip.cls.room && <div className="ev-tip-row"><MapPin size={12} />{tooltip.cls.room}</div>}
          {tooltip.cls.faculty && <div className="ev-tip-row"><User size={12} />{tooltip.cls.faculty}</div>}
        </div>
      )}

      {/* Scroll to top FAB */}
      {showScrollTop && (
        <button
          className="fs-scroll-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
        >
          <ArrowUp size={22} />
        </button>
      )}
    </div>
  );
});
