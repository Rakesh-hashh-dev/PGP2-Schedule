import React, { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Clock, MapPin, User, SlidersHorizontal, X, ArrowUp, Calendar } from "lucide-react";

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

export default React.memo(function FullSchedulePage({ allClasses, enrolled, legend, termLabel, onBack, jumpToDate, setJumpToDate }) {
  const [filterCode, setFilterCode] = useState(null); // null = show all
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (jumpToDate) {
      const t = setTimeout(() => {
        const el = document.getElementById(`day-${jumpToDate}`);
        if (el) {
          const headerOffset = 100;
          const elementPosition = el.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: "smooth" });
        }
        if (setJumpToDate) setJumpToDate(null);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [jumpToDate, setJumpToDate]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Get base classes (either user's enrolled classes or the entire master schedule)
  const baseClasses = useMemo(() => {
    const classOnly = allClasses.filter(c => c.type === "class");
    
    if (showAllClasses) {
      return classOnly.sort((a, b) => a.date.localeCompare(b.date) || toMin(a.start) - toMin(b.start));
    }

    if (!enrolled) return [];
    return classOnly
      .filter(c => {
        const sec = enrolled[c.code];
        return sec !== undefined && (c.section === sec || c.section === "Single");
      })
      .sort((a, b) => a.date.localeCompare(b.date) || toMin(a.start) - toMin(b.start));
  }, [allClasses, enrolled, showAllClasses]);

  // Group by subject code for filter chips
  const subjectCodes = useMemo(() => {
    const codes = [...new Set(baseClasses.map(c => c.code))];
    codes.sort((a, b) => (legend[a]?.name || a).localeCompare(legend[b]?.name || b));
    return codes;
  }, [baseClasses, legend]);

  // Apply filter
  const filtered = filterCode ? baseClasses.filter(c => c.code === filterCode) : baseClasses;

  // Group by date, filling gaps between class days
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
            {filterCode ? (legend[filterCode]?.name || filterCode) : `${subjectCodes.length} subjects`} · {totalSessions} sessions
            {termLabel && <> · {termLabel}</>}
          </span>
        </div>
      </div>

      {/* Controls Bar (Filter + Select Date) */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px", flexWrap: "wrap" }}>
        <button 
          onClick={() => setFilterModalOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            border: "1px solid var(--border)", background: "var(--card)",
            color: "var(--text)", fontFamily: "var(--body)", fontWeight: 600, fontSize: "13px",
            padding: "8px 16px", borderRadius: "99px", cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            transition: "all 0.2s"
          }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.96)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          onTouchStart={e => e.currentTarget.style.transform = "scale(0.96)"}
          onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <SlidersHorizontal size={15} /> 
          {filterCode ? `Filter: ${filterCode}` : (!showAllClasses ? "Filter: My Schedule" : "Filter: All Subjects")}
        </button>

        <div style={{ position: "relative", display: "inline-block" }}>
          <div style={{ 
            display: "flex", alignItems: "center", gap: "6px",
            background: "var(--card)", padding: "8px 16px",
            borderRadius: "99px", border: "1px solid var(--border)",
            fontSize: "13px", fontWeight: "600", color: "var(--text)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            pointerEvents: "none"
          }}>
            <Calendar size={15} /> Select Date
          </div>
          <input 
            type="date"
            onChange={(e) => {
              const targetDate = e.target.value;
              if (!targetDate) return;
              const el = document.getElementById(`day-${targetDate}`);
              if (el) {
                const headerOffset = 100;
                const elementPosition = el.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({
                  top: offsetPosition,
                  behavior: "smooth"
                });
              } else {
                alert("There are no classes scheduled for the selected date.");
              }
              e.target.value = ""; // Reset after scrolling
            }}
            title="Jump to specific date"
            style={{ 
              position: "absolute", inset: 0, width: "100%", height: "100%",
              opacity: 0, cursor: "pointer"
            }}
          />
        </div>
      </div>

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
                  className={`fs-chip ${!filterCode && !showAllClasses ? "fs-chip-on" : ""}`}
                  onClick={() => { setFilterCode(null); setShowAllClasses(false); }}
                  style={{ flex: 1, justifyContent: "center", padding: "12px", fontSize: "13.5px" }}
                >
                  My Schedule
                </button>
                <button
                  className={`fs-chip ${!filterCode && showAllClasses ? "fs-chip-on" : ""}`}
                  onClick={() => { setFilterCode(null); setShowAllClasses(true); }}
                  style={{ flex: 1, justifyContent: "center", padding: "12px", fontSize: "13.5px" }}
                >
                  Whole Timetable
                </button>
              </div>

              <h4 style={{ fontSize: "11.5px", fontWeight: "700", color: "var(--muted)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Filter by Subject
              </h4>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {subjectCodes.map(code => {
                  const section = enrolled ? enrolled[code] : null;
                  const showSection = section && section !== "Single";
                  return (
                    <button
                      key={code}
                      className={`fs-chip ${filterCode === code ? "fs-chip-on" : ""}`}
                      onClick={() => { setFilterCode(filterCode === code ? null : code); setShowAllClasses(true); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      {code}
                      {showSection && !showAllClasses && (
                        <span style={{ 
                          background: filterCode === code ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)", 
                          color: filterCode === code ? "#fff" : "var(--muted)",
                          padding: "1px 6px", 
                          borderRadius: "6px", 
                          fontSize: "11px",
                          fontWeight: "700",
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
                    background: "var(--ink)", color: "#fff",
                    fontFamily: "var(--body)", fontSize: "15px", fontWeight: "700",
                    border: "none", cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(21,24,43,0.15)",
                    transition: "transform 0.1s"
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

      {/* Schedule grouped by date */}
      <div className="fs-list">
        {grouped.length === 0 ? (
          <p className="fr-empty" style={{ textAlign: "center", padding: "40px 0" }}>No sessions found.</p>
        ) : (
          grouped.map((entry, idx) => {
            if (entry.type === "free") {
              return (
                <div key={entry.date} id={`day-${entry.date}`} className="fs-free-day">
                  <span className="fs-free-date">{fmtDate(entry.date)}</span>
                  <span className="fs-free-label">No classes</span>
                </div>
              );
            }

            if (entry.type === "gap") {
              return (
                <div key={`gap-${idx}`} className="fs-gap-row">
                  <span className="fs-gap-range">{fmtShort(entry.from)} – {fmtShort(entry.to)}</span>
                  <span className="fs-gap-label">No classes · {entry.count} days</span>
                </div>
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
                    const colorIdx = (Array.from(c.code).reduce((h, ch) => h + ch.charCodeAt(0), 0)) % 6;
                    const showSection = c.section && c.section !== "Single";
                    return (
                      <div key={i} className="fs-card">
                        <div className={`fs-card-accent accent-${colorIdx}`} />
                        <div className="fs-card-body">
                          <div className="fs-card-top">
                            <span className="fs-card-name">{c.name}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {showSection && (
                                <span style={{
                                  fontSize: "10px", fontWeight: "700", padding: "2px 6px",
                                  background: "var(--surface)", borderRadius: "6px",
                                  color: "var(--muted)", letterSpacing: "0.5px", textTransform: "uppercase"
                                }}>
                                  Sec {c.section}
                                </span>
                              )}
                              <span className={`ses ses-${colorIdx}`}>{c.code} {c.session}</span>
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
            );
          })
        )}
      </div>

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
