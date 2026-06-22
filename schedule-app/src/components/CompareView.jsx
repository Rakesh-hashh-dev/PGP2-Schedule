import { useState, useMemo, useRef, useEffect } from "react";
import { ArrowLeft, Columns, Layers, Clock, BookOpen, UserCheck, Sparkles, ChevronDown } from "lucide-react";
import { findFreeSlots, findGroupFreeSlots, scheduleInsights, friendVisibleClasses } from "../lib/friends.js";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

function fmtDuration(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(t) {
  const [h, m] = t.split(":");
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? "PM" : "AM";
  const hr12 = hr % 12 || 12;
  return `${hr12}:${m} ${ampm}`;
}

const RANGE_OPTIONS = [
  { key: "3",      label: "3 Days" },
  { key: "7",      label: "1 Week" },
  { key: "14",     label: "2 Weeks" },
  { key: "30",     label: "1 Month" },
  { key: "custom", label: "Custom" },
];

function RangeDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = RANGE_OPTIONS.find(o => o.key === value);

  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="cv-range-drop" ref={ref}>
      <button
        className={`cv-day-btn cv-range-btn ${selected ? "on" : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        {selected ? selected.label : "Select Range"}
        <ChevronDown size={12} className={`cv-range-caret ${open ? "open" : ""}`} />
      </button>
      {open && (
        <div className="cv-range-menu">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              className={`cv-range-opt ${value === opt.key ? "on" : ""}`}
              onClick={() => { onChange(opt.key); setOpen(false); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * CompareView — renders merged or side-by-side schedule comparison
 *
 * Props:
 *   mode: "friend" | "group"
 *   friendData: { name, courses } (for friend mode)
 *   groupData: { name, members: [{ name, courses }] } (for group mode)
 *   myClasses: visible classes for the current user
 *   allClasses: all CLASSES from schedule data
 *   enrolled: current user's enrolled courses
 *   legend: course legend
 *   now: Date
 *   onExit: callback to exit compare mode
 */
export default function CompareView({
  mode, friendData, groupData,
  myClasses, mine, allClasses, enrolled, legend, now, onExit,
}) {
  const [viewMode, setViewMode] = useState("merged"); // "merged" | "side"
  const [dayFilter, setDayFilter] = useState("today"); // "today", "tomorrow", "week"
  const [customRange, setCustomRange] = useState({ start: ymd(now), end: ymd(now) });

  const selectedDates = useMemo(() => {
    if (dayFilter === "today") return [ymd(now)];
    if (dayFilter === "tomorrow") {
      const d = new Date(now); d.setDate(d.getDate() + 1); return [ymd(d)];
    }
    if (dayFilter === "custom") {
      const dates = [];
      let current = new Date(customRange.start);
      const end = new Date(customRange.end);
      if (isNaN(current) || isNaN(end) || current > end) return [];
      let count = 0;
      while(current <= end && count < 60) {
        dates.push(ymd(current));
        const next = new Date(current);
        next.setDate(next.getDate() + 1);
        current = next;
        count++;
      }
      return dates;
    }
    const days = parseInt(dayFilter, 10);
    if (!isNaN(days)) {
      const dates = [];
      for(let i=0; i<days; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i); dates.push(ymd(d));
      }
      return dates;
    }
    return [ymd(now)];
  }, [now, dayFilter]);

  const prettyDateLabel = useMemo(() => {
    if (dayFilter === "custom") return "";
    if (dayFilter === "today") return new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
    if (dayFilter === "tomorrow") {
      const d = new Date(now); d.setDate(d.getDate() + 1);
      return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
    }
    const days = parseInt(dayFilter, 10);
    if (!isNaN(days)) {
      const start = new Date(now);
      const end = new Date(now); end.setDate(end.getDate() + days - 1);
      const fmt = d => d.toLocaleDateString([], { day: "numeric", month: "short" });
      return `${fmt(start)} – ${fmt(end)}`;
    }
    return "";
  }, [now, dayFilter]);

  // Determine comparison targets
  const targets = useMemo(() => {
    if (mode === "friend" && friendData) {
      return [{ name: friendData.name, courses: friendData.courses }];
    }
    if (mode === "group" && groupData?.members) {
      return groupData.members;
    }
    return [];
  }, [mode, friendData, groupData]);

  const label = mode === "friend" ? friendData?.name : groupData?.name;

  // My classes for the selected dates
  const myDayClasses = useMemo(
    () => myClasses.filter(c => selectedDates.includes(c.date)).sort((a, b) => a.date.localeCompare(b.date) || toMin(a.start) - toMin(b.start)),
    [myClasses, selectedDates]
  );

  // Each target's classes for the selected dates
  const targetDayClasses = useMemo(() => {
    return targets.map(t => {
      let vis = friendVisibleClasses(allClasses, t.courses);
      if (mine && enrolled) {
        vis = vis.filter(c => !(enrolled[c.code] && !mine.has(c.code)));
      }
      return vis.filter(c => selectedDates.includes(c.date)).sort((a, b) => a.date.localeCompare(b.date) || toMin(a.start) - toMin(b.start));
    });
  }, [targets, allClasses, selectedDates, mine, enrolled]);

  // Free slots
  const freeSlots = useMemo(() => {
    let slots = [];
    if (targets.length === 1) {
      let theirClasses = friendVisibleClasses(allClasses, targets[0].courses);
      if (mine && enrolled) {
        theirClasses = theirClasses.filter(c => !(enrolled[c.code] && !mine.has(c.code)));
      }
      for (const d of selectedDates) {
        const daySlots = findFreeSlots(myClasses, theirClasses, d);
        slots.push(...daySlots.map(s => ({ ...s, date: d })));
      }
    } else {
      // Group mode
      const allLists = [
        myClasses,
        ...targets.map(t => {
          let vis = friendVisibleClasses(allClasses, t.courses);
          if (mine && enrolled) {
            vis = vis.filter(c => !(enrolled[c.code] && !mine.has(c.code)));
          }
          return vis;
        }),
      ];
      for (const d of selectedDates) {
        const daySlots = findGroupFreeSlots(allLists, d);
        slots.push(...daySlots.map(s => ({ ...s, date: d })));
      }
    }
    return slots;
  }, [myClasses, allClasses, targets, selectedDates, mine, enrolled]);

  // Insights (for friend mode — 1:1)
  const insights = useMemo(() => {
    if (targets.length === 1) {
      return scheduleInsights(enrolled, targets[0].courses);
    }
    // Group: compute against each member
    const allMatching = new Set();
    const allSameClass = [];
    for (const t of targets) {
      const ins = scheduleInsights(enrolled, t.courses);
      ins.matching.forEach(c => allMatching.add(c));
      ins.sameClass.forEach(sc => {
        if (!allSameClass.find(x => x.code === sc.code && x.section === sc.section)) {
          allSameClass.push(sc);
        }
      });
    }
    return { matching: [...allMatching], sameClass: allSameClass, uniqueToMe: [], uniqueToThem: [] };
  }, [enrolled, targets]);

  // Timeline rendering helpers
  const DAY_START = 480; // 8:00
  const DAY_END = 1320;  // 22:00
  const TOTAL_MIN = DAY_END - DAY_START;

  function blockStyle(start, end) {
    const s = Math.max(toMin(start), DAY_START);
    const e = Math.min(toMin(end), DAY_END);
    return {
      top: `${((s - DAY_START) / TOTAL_MIN) * 100}%`,
      height: `${((e - s) / TOTAL_MIN) * 100}%`,
    };
  }

  return (
    <div className="cv-page">
      {/* Header */}
      <div className="cv-header">
        <button className="cv-back" onClick={onExit}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="cv-header-info">
          <span className="cv-header-title">
            {mode === "friend" ? `Comparing with ${label}` : label}
          </span>
          <span className="cv-header-sub">
            {mode === "group" ? `${targets.length} member${targets.length !== 1 ? "s" : ""} + you` : "You vs. them"}
          </span>
        </div>
        <div className="cv-view-toggle">
          <button className={`cv-toggle-btn ${viewMode === "merged" ? "on" : ""}`} onClick={() => setViewMode("merged")} title="Merged view">
            <Layers size={15} />
          </button>
          <button className={`cv-toggle-btn ${viewMode === "side" ? "on" : ""}`} onClick={() => setViewMode("side")} title="Side by side">
            <Columns size={15} />
          </button>
        </div>
      </div>

      {/* Day selector */}
      <div className="cv-filters">
        <div className="cv-day-selector">
          <button className={`cv-day-btn ${dayFilter === "today" ? "on" : ""}`} onClick={() => setDayFilter("today")}>Today</button>
          <button className={`cv-day-btn ${dayFilter === "tomorrow" ? "on" : ""}`} onClick={() => setDayFilter("tomorrow")}>Tomorrow</button>
          <RangeDropdown
            value={RANGE_OPTIONS.some(o => o.key === dayFilter) ? dayFilter : null}
            onChange={setDayFilter}
          />
          {dayFilter !== "custom" && prettyDateLabel && (
            <span className="cv-day-label">{prettyDateLabel}</span>
          )}
        </div>

        {dayFilter === "custom" && (
          <div className="cv-custom-range">
            <div className="cv-range-field">
              <label className="cv-range-label">From</label>
              <input
                type="date"
                className="cv-range-input"
                value={customRange.start}
                onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))}
              />
            </div>
            <span className="cv-range-arrow">→</span>
            <div className="cv-range-field">
              <label className="cv-range-label">To</label>
              <input
                type="date"
                className="cv-range-input"
                value={customRange.end}
                onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Free time summary */}
      {freeSlots.length > 0 && (
        <div className="cv-free-summary">
          <Sparkles size={15} />
          <span>{freeSlots.length} free slot{freeSlots.length !== 1 ? "s" : ""} found</span>
        </div>
      )}

      {/* Timeline */}
      {viewMode === "merged" ? (
        <MergedTimeline
          myClasses={myDayClasses}
          targetClasses={targetDayClasses}
          targets={targets}
          freeSlots={freeSlots}
          blockStyle={blockStyle}
          TOTAL_MIN={TOTAL_MIN}
          DAY_START={DAY_START}
          DAY_END={DAY_END}
          legend={legend}
          dayFilter={dayFilter}
        />
      ) : (
        <SideBySide
          myClasses={myDayClasses}
          targetClasses={targetDayClasses}
          targets={targets}
          freeSlots={freeSlots}
          blockStyle={blockStyle}
          TOTAL_MIN={TOTAL_MIN}
          DAY_START={DAY_START}
          DAY_END={DAY_END}
          legend={legend}
          userName={/* current user name */ "You"}
          dayFilter={dayFilter}
        />
      )}

      {/* Free time blocks detail */}
      <section className="cv-free-section">
        <h3 className="cv-section-title"><Clock size={15} /> Matching Free Time</h3>
        {freeSlots.length === 0 ? (
          <p className="cv-empty">No common free time on this day.</p>
        ) : (
          <div className="cv-free-list">
            {freeSlots.map((slot, i) => (
              <div key={i} className="cv-free-block">
                <div className="cv-free-time">
                  <span className="cv-free-range">
                    {["3", "7", "14", "30", "custom"].includes(dayFilter) && <span style={{opacity: 0.7, marginRight: "8px"}}>{new Date(slot.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>}
                    {fmtTime(slot.start)} – {fmtTime(slot.end)}
                  </span>
                  <span className="cv-free-dur">{fmtDuration(slot.durationMin)} free</span>
                </div>
                <div className="cv-free-bar">
                  <div className="cv-free-bar-fill" style={{ width: `${Math.min(100, (slot.durationMin / 120) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Insights */}
      <section className="cv-insights">
        <h3 className="cv-section-title"><BookOpen size={15} /> Schedule Insights</h3>
        <div className="cv-insight-grid">
          {insights.sameClass.length > 0 && (
            <div className="cv-insight-card cv-insight-same">
              <UserCheck size={18} />
              <div>
                <span className="cv-insight-num">{insights.sameClass.length}</span>
                <span className="cv-insight-label">Same class{insights.sameClass.length !== 1 ? "es" : ""}</span>
              </div>
              <div className="cv-insight-detail">
                {insights.sameClass.map(sc => (
                  <span key={sc.code} className="cv-insight-tag">{legend[sc.code]?.name || sc.code} ({sc.section})</span>
                ))}
              </div>
            </div>
          )}
          {insights.matching.length > 0 && (
            <div className="cv-insight-card cv-insight-match">
              <BookOpen size={18} />
              <div>
                <span className="cv-insight-num">{insights.matching.length}</span>
                <span className="cv-insight-label">Matching subject{insights.matching.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="cv-insight-detail">
                {insights.matching.map(code => (
                  <span key={code} className="cv-insight-tag">{legend[code]?.name || code}</span>
                ))}
              </div>
            </div>
          )}
          {insights.matching.length === 0 && insights.sameClass.length === 0 && (
            <p className="cv-empty">No matching courses found.</p>
          )}
        </div>
      </section>
    </div>
  );
}

/* ── Merged Agenda Timeline ── */
function MergedTimeline({ myClasses, targetClasses, targets, freeSlots, dayFilter }) {
  const events = [];
  freeSlots.forEach(s => events.push({ type: "free", start: toMin(s.start), end: toMin(s.end), data: s, date: s.date }));
  myClasses.forEach(c => {
    events.push({ 
      type: (c.type === "holiday" || c.type === "break") ? "shared" : "mine", 
      start: toMin(c.start), 
      end: toMin(c.end), 
      data: c, 
      date: c.date,
      owner: (c.type === "holiday" || c.type === "break") ? "All" : "You"
    });
  });
  
  targetClasses.forEach((classes, i) => {
    classes.forEach(c => {
      if (c.type === "holiday" || c.type === "break") {
        const exists = events.find(e => e.date === c.date && e.data.name === c.name && e.start === toMin(c.start));
        if (!exists) {
          events.push({ type: "shared", start: toMin(c.start), end: toMin(c.end), data: c, owner: "All", date: c.date });
        }
      } else {
        events.push({ type: "theirs", start: toMin(c.start), end: toMin(c.end), data: c, owner: targets[i]?.name, date: c.date });
      }
    });
  });

  events.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);

  if (events.length === 0) {
    return <div className="cv-empty">No events scheduled.</div>;
  }

  // Group by date, then by start time
  const grouped = [];
  let curDate = null;
  let curGroup = null;
  for (const e of events) {
    if (e.date !== curDate) {
      curDate = e.date;
      curGroup = { date: curDate, timeGroups: [] };
      grouped.push(curGroup);
    }
    
    let curTimeGroup = curGroup.timeGroups[curGroup.timeGroups.length - 1];
    if (!curTimeGroup || curTimeGroup.start !== e.start) {
      curTimeGroup = { start: e.start, end: e.end, events: [] };
      curGroup.timeGroups.push(curTimeGroup);
    }
    curTimeGroup.events.push(e);
  }

  return (
    <div className="cv-agenda">
      {grouped.map((g, gi) => (
        <div key={gi} className="cv-agenda-day-group">
          {["3", "7", "14", "30", "custom"].includes(dayFilter) && (
            <div style={{ padding: "12px 10px 4px 10px", fontSize: "12px", fontWeight: "600", color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {new Date(g.date).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
            </div>
          )}
          {g.timeGroups.map((tg, ti) => {
            let groupType = tg.events[0].type;
            if (tg.events.some(e => e.type !== groupType)) groupType = "shared";

            return (
              <div key={ti} className={`cva-item cva-${groupType}`}>
                <div className="cva-time">
                  <span>{fmtTime(tg.events[0].data.start)}</span>
                  <span className="cva-time-end">{fmtTime(tg.events[0].data.end)}</span>
                </div>
                <div className="cva-node">
                  <div className="cva-dot" />
                  <div className="cva-line" />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "16px" }}>
                  {tg.events.map((e, ei) => (
                    <div key={ei} className={`cva-card cva-${e.type}`} style={{ margin: 0 }}>
                      <div className="cva-title">
                        {e.type === "free" ? "Matching Free Time" : e.data.name}
                      </div>
                      <div className="cva-sub">
                        {e.type === "free" ? fmtDuration(e.data.durationMin) : e.type === "mine" ? "You" : e.owner}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── Side by Side Agenda ── */
function SideBySide({ myClasses, targetClasses, targets, dayFilter, freeSlots = [] }) {
  const FRIEND_COLORS = ["cva-theirs", "cva-friend2", "cva-friend3"];
  const columnsDef = [
    { label: "You", colorClass: "cva-mine" },
    ...targets.map((t, i) => ({ label: t.name, colorClass: FRIEND_COLORS[i % FRIEND_COLORS.length] }))
  ];

  const allItems = [];
  myClasses.forEach(c => allItems.push({ ...c, ownerIndex: 0 }));
  targetClasses.forEach((classes, i) => {
    classes.forEach(c => allItems.push({ ...c, ownerIndex: i + 1 }));
  });
  freeSlots.forEach(fs => allItems.push({ ...fs, isFreeSlot: true, ownerIndex: -1 }));

  const dates = Array.from(new Set(allItems.map(x => x.date))).sort();

  const dateGroups = dates.map(date => {
    const dayItems = allItems.filter(x => x.date === date);
    
    // Group by start time
    const timeMap = {};
    dayItems.forEach(item => {
      const t = toMin(item.start);
      if (!timeMap[t]) timeMap[t] = { freeSlots: [], columns: Array(columnsDef.length).fill().map(() => []) };
      
      if (item.isFreeSlot) {
        timeMap[t].freeSlots.push(item);
      } else {
        timeMap[t].columns[item.ownerIndex].push(item);
      }
    });

    const startTimes = Object.keys(timeMap).map(Number).sort((a, b) => a - b);
    const rows = startTimes.map(t => timeMap[t]);

    return { date, rows };
  });

  return (
    <div>
      {/* Sticky column name bar — lives outside overflow-x container so it actually sticks */}
      <div className="cv-sbs-sticky-header">
        {columnsDef.map((col, i) => {
          const pillClass = i === 0 ? "you" : i === 1 ? "them" : i === 2 ? "them2" : "them3";
          return (
            <div key={i} className={`cv-sbs-name-pill ${pillClass}`}>
              {col.label}
            </div>
          );
        })}
      </div>

      <div className="cv-side-agenda" style={{ display: "block" }}>
        <div style={{ minWidth: Math.max(100, columnsDef.length * 150) + "px" }}>
        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {dateGroups.length === 0 && <div className="cv-empty" style={{ padding: "20px 0", textAlign: "center" }}>No classes</div>}
          
          {dateGroups.map((dg, dgi) => (
            <div key={dgi} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {["3", "7", "14", "30", "custom"].includes(dayFilter) && (
                <div style={{ padding: "4px 8px", fontSize: "12px", fontWeight: "700", color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {new Date(dg.date).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                </div>
              )}
              
              {dg.rows.map((row, ri) => (
                <div key={ri} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {row.freeSlots.map((fs, fsi) => (
                    <div key={fsi} className="cva-free-pill" style={{ background: "rgba(31,169,113,.18)", border: "1px solid rgba(31,169,113,.35)", color: "var(--live)", padding: "9px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: "700", textAlign: "center", display: "flex", justifyContent: "center", gap: "8px", alignItems: "center", margin: "0 4px" }}>
                      <span>{fmtTime(fs.start)} – {fmtTime(fs.end)}</span>
                      <span style={{ fontSize: "10px", fontWeight: "600", background: "rgba(31,169,113,.20)", padding: "2px 7px", borderRadius: "10px" }}>Free</span>
                    </div>
                  ))}
                  
                  {row.columns.some(col => col.length > 0) && (
                    <div style={{ display: "flex" }}>
                      {row.columns.map((colItems, ci) => (
                        <div key={ci} style={{ flex: 1, padding: "0 6px", display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
                          {colItems.length === 0 ? (
                            <div className="cva-card" style={{ margin: 0, height: "100%", background: "var(--surface)", border: "1px dashed var(--border-hi)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "64px" }}>
                              <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: "600", letterSpacing: "0.03em", textTransform: "uppercase" }}>Free</span>
                            </div>
                          ) : colItems.map((c, cii) => {
                            const isShared = c.type === "holiday" || c.type === "break";
                            return (
                              <div key={cii} className={`cva-card ${isShared ? "cva-shared" : columnsDef[ci].colorClass}`} style={{ margin: 0, height: "100%" }}>
                                <div className="cva-time-sm">{fmtTime(c.start)} – {fmtTime(c.end)}</div>
                                <div className="cva-title">{c.name}</div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
