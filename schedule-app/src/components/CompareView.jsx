import { useState, useMemo } from "react";
import { ArrowLeft, Columns, Layers, Clock, BookOpen, UserCheck, Sparkles } from "lucide-react";
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
  myClasses, allClasses, enrolled, legend, now, onExit,
}) {
  const [viewMode, setViewMode] = useState("merged"); // "merged" | "side"
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, 1 = tomorrow

  const selectedDate = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    return ymd(d);
  }, [now, dayOffset]);

  const prettyDateLabel = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  }, [now, dayOffset]);

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

  // My classes for the selected date
  const myDayClasses = useMemo(
    () => myClasses.filter(c => c.date === selectedDate).sort((a, b) => toMin(a.start) - toMin(b.start)),
    [myClasses, selectedDate]
  );

  // Each target's classes for the selected date
  const targetDayClasses = useMemo(() => {
    return targets.map(t => {
      const vis = friendVisibleClasses(allClasses, t.courses);
      return vis.filter(c => c.date === selectedDate).sort((a, b) => toMin(a.start) - toMin(b.start));
    });
  }, [targets, allClasses, selectedDate]);

  // Free slots
  const freeSlots = useMemo(() => {
    if (targets.length === 1) {
      const theirClasses = friendVisibleClasses(allClasses, targets[0].courses);
      return findFreeSlots(myClasses, theirClasses, selectedDate);
    }
    // Group mode
    const allLists = [
      myClasses,
      ...targets.map(t => friendVisibleClasses(allClasses, t.courses)),
    ];
    return findGroupFreeSlots(allLists, selectedDate);
  }, [myClasses, allClasses, targets, selectedDate]);

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
  const DAY_END = 1080;  // 18:00
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
      <div className="cv-day-selector">
        <button className={`cv-day-btn ${dayOffset === 0 ? "on" : ""}`} onClick={() => setDayOffset(0)}>Today</button>
        <button className={`cv-day-btn ${dayOffset === 1 ? "on" : ""}`} onClick={() => setDayOffset(1)}>Tomorrow</button>
        <span className="cv-day-label">{prettyDateLabel}</span>
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
        />
      )}

      {/* Free time blocks detail */}
      <section className="cv-free-section">
        <h3 className="cv-section-title"><Clock size={15} /> Free Time Together</h3>
        {freeSlots.length === 0 ? (
          <p className="cv-empty">No common free time on this day.</p>
        ) : (
          <div className="cv-free-list">
            {freeSlots.map((slot, i) => (
              <div key={i} className="cv-free-block">
                <div className="cv-free-time">
                  <span className="cv-free-range">{fmtTime(slot.start)} – {fmtTime(slot.end)}</span>
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

/* ── Merged Timeline ── */
function MergedTimeline({ myClasses, targetClasses, targets, freeSlots, blockStyle, TOTAL_MIN, DAY_START, DAY_END, legend }) {
  const hours = [];
  for (let h = Math.floor(DAY_START / 60); h <= Math.floor(DAY_END / 60); h++) {
    hours.push(h);
  }

  return (
    <div className="cv-timeline cv-merged">
      <div className="cv-time-labels">
        {hours.map(h => (
          <div key={h} className="cv-time-label" style={{ top: `${((h * 60 - DAY_START) / TOTAL_MIN) * 100}%` }}>
            {h}:00
          </div>
        ))}
      </div>
      <div className="cv-track-area">
        {/* Hour grid lines */}
        {hours.map(h => (
          <div key={h} className="cv-grid-line" style={{ top: `${((h * 60 - DAY_START) / TOTAL_MIN) * 100}%` }} />
        ))}
        {/* Free blocks */}
        {freeSlots.map((slot, i) => (
          <div key={`free-${i}`} className="cv-block cv-block-free" style={blockStyle(slot.start, slot.end)}>
            <span className="cv-block-label">Free · {fmtDuration(slot.durationMin)}</span>
          </div>
        ))}
        {/* My classes */}
        {myClasses.map((c, i) => (
          <div key={`my-${i}`} className="cv-block cv-block-mine" style={blockStyle(c.start, c.end)}>
            <span className="cv-block-label">{c.name}</span>
            <span className="cv-block-time">{c.start}–{c.end}</span>
            <span className="cv-block-owner">You</span>
          </div>
        ))}
        {/* Their classes */}
        {targetClasses.flatMap((classes, ti) =>
          classes.map((c, ci) => (
            <div key={`t-${ti}-${ci}`} className="cv-block cv-block-theirs" style={{
              ...blockStyle(c.start, c.end),
              left: `${50 + ti * 4}%`,
              width: `${48 - ti * 4}%`,
            }}>
              <span className="cv-block-label">{c.name}</span>
              <span className="cv-block-time">{c.start}–{c.end}</span>
              <span className="cv-block-owner">{targets[ti]?.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Side by Side ── */
function SideBySide({ myClasses, targetClasses, targets, freeSlots, blockStyle, TOTAL_MIN, DAY_START, DAY_END, legend, userName }) {
  const hours = [];
  for (let h = Math.floor(DAY_START / 60); h <= Math.floor(DAY_END / 60); h++) {
    hours.push(h);
  }

  const columns = [
    { label: "You", classes: myClasses, colorClass: "cv-block-mine" },
    ...targets.map((t, i) => ({ label: t.name, classes: targetClasses[i] || [], colorClass: "cv-block-theirs" })),
  ];

  return (
    <div className="cv-timeline cv-side">
      <div className="cv-side-headers">
        {columns.map((col, i) => (
          <div key={i} className="cv-side-header">{col.label}</div>
        ))}
      </div>
      <div className="cv-side-body">
        <div className="cv-time-labels">
          {hours.map(h => (
            <div key={h} className="cv-time-label" style={{ top: `${((h * 60 - DAY_START) / TOTAL_MIN) * 100}%` }}>
              {h}:00
            </div>
          ))}
        </div>
        {columns.map((col, ci) => (
          <div key={ci} className="cv-side-col">
            {hours.map(h => (
              <div key={h} className="cv-grid-line" style={{ top: `${((h * 60 - DAY_START) / TOTAL_MIN) * 100}%` }} />
            ))}
            {/* Free blocks in each column */}
            {freeSlots.map((slot, i) => (
              <div key={`free-${i}`} className="cv-block cv-block-free cv-block-side-free" style={blockStyle(slot.start, slot.end)}>
                {ci === 0 && <span className="cv-block-label-sm">Free</span>}
              </div>
            ))}
            {col.classes.map((c, i) => (
              <div key={i} className={`cv-block ${col.colorClass}`} style={blockStyle(c.start, c.end)}>
                <span className="cv-block-label">{c.name}</span>
                <span className="cv-block-time">{c.start}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
