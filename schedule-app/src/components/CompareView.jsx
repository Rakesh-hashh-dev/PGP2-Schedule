import { useState, useMemo, useRef, useEffect } from "react";
import "../styles/compare.css";
import { ArrowLeft, Columns, Layers, Clock, BookOpen, UserCheck, Sparkles, ChevronDown, Copy, Check, CalendarDays, ArrowRight as ArrowRightIcon, Flame, X, CalendarX2, PartyPopper, CalendarPlus } from "lucide-react";
import { EmptyState } from "./ui.jsx";
import { findFreeSlots, findGroupFreeSlots, scheduleInsights, friendVisibleClasses, avatarGradient } from "../lib/friends.js";
import { isNationalHoliday } from "../lib/nationalHolidays.js";
import IndiaFlagIcon from "./IndiaFlagIcon.jsx";

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

function Avatar({ name, size = 30, style }) {
  const [c1, c2] = avatarGradient(name);
  return (
    <div
      className="cv-avatar"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
        fontSize: size * 0.42,
        ...style,
      }}
    >
      {(name || "?")[0]?.toUpperCase()}
    </div>
  );
}

function HeaderIdentity({ mode, label, targets }) {
  if (mode === "group") {
    const shown = targets.slice(0, 3);
    return (
      <div className="cv-avatar-stack">
        {shown.map((t, i) => (
          <Avatar key={t.name + i} name={t.name} size={30} style={{ zIndex: 10 - i, marginLeft: i === 0 ? 0 : -10 }} />
        ))}
        {targets.length > 3 && (
          <div className="cv-avatar cv-avatar-more" style={{ marginLeft: -10 }}>+{targets.length - 3}</div>
        )}
      </div>
    );
  }
  return <Avatar name={label} size={32} />;
}

function FreeSlotGroups({ groups, isMultiDay, longestFreeIdx, maxFreeDuration, totalSlots, onPlanSlot }) {
  return (
    <>
      {groups.map((group, gi) => (
        <div key={gi} className="cv-free-group" data-date={group.date || undefined}>
          {isMultiDay && group.date && (
            <div className="cv-day-heading">
              {new Date(group.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            </div>
          )}
          {group.slots.map((slot) => (
            <div key={slot._idx} className={`cv-free-block${slot._idx === longestFreeIdx ? " cv-free-block-best" : ""}`}>
              <div className="cv-free-time">
                <span className="cv-free-range">
                  {fmtTime(slot.start)} – {fmtTime(slot.end)}
                </span>
                <span className="cv-free-dur">
                  {slot._idx === longestFreeIdx && totalSlots > 1 && (
                    <span className="cv-free-best-badge"><Flame size={11} /> Longest</span>
                  )}
                  {fmtDuration(slot.durationMin)} free
                </span>
                {onPlanSlot && (
                  <button className="cv-plan-btn" onClick={() => onPlanSlot(slot)} title="Turn this slot into a plan">
                    <CalendarPlus size={12} /> Plan
                  </button>
                )}
              </div>
              <div className="cv-free-bar">
                <div
                  className="cv-free-bar-fill"
                  style={{ width: `${Math.max(8, (slot.durationMin / maxFreeDuration) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
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
  myClasses, mine, allClasses, enrolled, legend, now, onExit, onPlanSlot,
}) {
  const [viewMode, setViewMode] = useState("side"); // "merged" | "side"
  const [dayFilter, setDayFilter] = useState("today"); // "today", "tomorrow", "week"
  const [customRange, setCustomRange] = useState({ start: ymd(now), end: ymd(now) });
  const [pendingRange, setPendingRange] = useState({ start: ymd(now), end: ymd(now) });
  // "idle" | "loading" | "applied"
  const [applyState, setApplyState] = useState("idle");
  const isApplyingRef = useRef(false);
  const [slotsCopied, setSlotsCopied] = useState(false);

  useEffect(() => {
    if (!isApplyingRef.current) return;
    const t = setTimeout(() => {
      isApplyingRef.current = false;
      setApplyState("applied");
    }, 400);
    return () => clearTimeout(t);
  }, [customRange]);

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
  }, [now, dayFilter, customRange.start, customRange.end]);

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

  const groupSubtitle = useMemo(() => {
    if (mode !== "group") return "You vs. them";
    const names = targets.map(t => t.name);
    if (names.length <= 2) return `${names.join(", ")} + you`;
    return `${names.slice(0, 2).join(", ")} + ${names.length - 2} more`;
  }, [mode, targets]);

  function copyFreeSlots() {
    if (!freeSlots.length) return;
    const header = `Free time with ${label}:`;
    const lines = freeSlots.map(s => {
      const datePart = ["3","7","14","30","custom"].includes(dayFilter)
        ? `${new Date(s.date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · `
        : "";
      return `• ${datePart}${fmtTime(s.start)} – ${fmtTime(s.end)} (${fmtDuration(s.durationMin)})`;
    });
    navigator.clipboard.writeText(`${header}\n${lines.join("\n")}`).then(() => {
      setSlotsCopied(true);
      setTimeout(() => setSlotsCopied(false), 2000);
    });
  }

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
    const slots = [];
    if (targets.length === 1) {
      const visible = friendVisibleClasses(allClasses, targets[0].courses);
      const theirClasses = (mine && enrolled)
        ? visible.filter(c => !(enrolled[c.code] && !mine.has(c.code)))
        : visible;
      for (const d of selectedDates) {
        const daySlots = findFreeSlots(myClasses, theirClasses, d);
        slots.push(...daySlots.map(s => ({ ...s, date: d })));
      }
    } else {
      // Group mode
      const allLists = [
        myClasses,
        ...targets.map(t => {
          const vis = friendVisibleClasses(allClasses, t.courses);
          return (mine && enrolled) ? vis.filter(c => !(enrolled[c.code] && !mine.has(c.code))) : vis;
        }),
      ];
      for (const d of selectedDates) {
        const daySlots = findGroupFreeSlots(allLists, d);
        slots.push(...daySlots.map(s => ({ ...s, date: d })));
      }
    }
    return slots;
  }, [myClasses, allClasses, targets, selectedDates, mine, enrolled]);

  const maxFreeDuration = useMemo(
    () => freeSlots.reduce((m, s) => Math.max(m, s.durationMin), 0),
    [freeSlots]
  );
  const longestFreeIdx = useMemo(() => {
    if (!freeSlots.length) return -1;
    return freeSlots.reduce((best, s, i) => (s.durationMin > freeSlots[best].durationMin ? i : best), 0);
  }, [freeSlots]);
  const isMultiDay = ["3", "7", "14", "30", "custom"].includes(dayFilter);
  const groupedFreeSlots = useMemo(() => {
    if (!isMultiDay) return [{ date: null, slots: freeSlots.map((s, i) => ({ ...s, _idx: i })) }];
    const groups = [];
    let cur = null;
    freeSlots.forEach((s, i) => {
      if (!cur || cur.date !== s.date) {
        cur = { date: s.date, slots: [] };
        groups.push(cur);
      }
      cur.slots.push({ ...s, _idx: i });
    });
    return groups;
  }, [freeSlots, isMultiDay]);

  // Long-range preview: the page shows only the first 2 days; the full range
  // opens in a modal (bottom sheet on mobile, dialog on desktop).
  const PREVIEW_DAYS = 2;
  const canTruncate = isMultiDay && selectedDates.length > PREVIEW_DAYS;
  const [moreModal, setMoreModal] = useState(null); // null | "timeline" | "free"
  const [modalJumpOpen, setModalJumpOpen] = useState(false);
  const moreBodyRef = useRef(null);
  const modalJumpRef = useRef(null);

  function closeMoreModal() {
    setMoreModal(null);
    setModalJumpOpen(false);
  }

  useEffect(() => {
    if (!moreModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = e => { if (e.key === "Escape") closeMoreModal(); };
    const onDown = e => {
      if (modalJumpRef.current && !modalJumpRef.current.contains(e.target)) setModalJumpOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [moreModal]);

  // Scroll the modal's own list to a given day (day groups carry data-date)
  function jumpInModal(d) {
    setModalJumpOpen(false);
    const body = moreBodyRef.current;
    if (!body) return;
    const el = body.querySelector(`[data-date="${d}"]`);
    if (!el) return;
    const top = el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 64;
    body.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  const timelineDates = useMemo(
    () => canTruncate ? selectedDates.slice(0, PREVIEW_DAYS) : selectedDates,
    [canTruncate, selectedDates]
  );
  const tlMyClasses = useMemo(() => {
    const set = new Set(timelineDates);
    return myDayClasses.filter(c => set.has(c.date));
  }, [myDayClasses, timelineDates]);
  const tlTargetClasses = useMemo(() => {
    const set = new Set(timelineDates);
    return targetDayClasses.map(list => list.filter(c => set.has(c.date)));
  }, [targetDayClasses, timelineDates]);
  const tlFreeSlots = useMemo(() => {
    const set = new Set(timelineDates);
    return freeSlots.filter(s => set.has(s.date));
  }, [freeSlots, timelineDates]);
  const hiddenTimelineDays = selectedDates.length - PREVIEW_DAYS;

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
        <button className="cv-back" onClick={onExit} aria-label="Back">
          <ArrowLeft size={18} /> <span className="cv-back-label">Back</span>
        </button>
        <HeaderIdentity mode={mode} label={label} targets={targets} />
        <div className="cv-header-info">
          <span className="cv-header-title">
            {mode === "friend" ? `Comparing with ${label}` : label}
          </span>
          <span className="cv-header-sub">{groupSubtitle}</span>
        </div>
        <div className="cv-view-toggle">
          <button className={`cv-toggle-btn ${viewMode === "merged" ? "on" : ""}`} onClick={() => setViewMode("merged")} title="Merged view" aria-label="Merged view">
            <Layers size={15} /> <span className="cv-toggle-label">Merged</span>
          </button>
          <button className={`cv-toggle-btn ${viewMode === "side" ? "on" : ""}`} onClick={() => setViewMode("side")} title="Side by side" aria-label="Side by side view">
            <Columns size={15} /> <span className="cv-toggle-label">Columns</span>
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
        </div>
        {/* In multi-day Columns view the range label rides in the sticky bar instead */}
        {dayFilter !== "custom" && prettyDateLabel && !(viewMode === "side" && isMultiDay) && (
          <span className="cv-day-label">{prettyDateLabel}</span>
        )}

        {dayFilter === "custom" && (
          <div className="cv-custom-range">
            <div className="cv-custom-range-inner">
              <CalendarDays size={16} className="cv-custom-range-icon" />
              <div className="cv-range-field">
                <label className="cv-range-label">From</label>
                <input
                  type="date"
                  className="cv-range-input"
                  value={pendingRange.start}
                  onChange={e => { setPendingRange(p => ({ ...p, start: e.target.value })); setApplyState("idle"); }}
                />
              </div>
              <div className="cv-range-divider">
                <div className="cv-range-divider-line" />
                <ArrowRightIcon size={12} className="cv-range-divider-arrow" />
                <div className="cv-range-divider-line" />
              </div>
              <div className="cv-range-field">
                <label className="cv-range-label">To</label>
                <input
                  type="date"
                  className="cv-range-input"
                  value={pendingRange.end}
                  min={pendingRange.start}
                  onChange={e => { setPendingRange(p => ({ ...p, end: e.target.value })); setApplyState("idle"); }}
                />
              </div>
              {pendingRange.start && pendingRange.end && applyState === "idle" && (() => {
                const s = new Date(pendingRange.start);
                const e = new Date(pendingRange.end);
                const diff = !isNaN(s) && !isNaN(e) && e >= s ? Math.round((e - s) / 86400000) + 1 : null;
                return diff ? <span className="cv-range-day-count">{diff}d</span> : null;
              })()}
            </div>
            <button
              className={`cv-range-apply${applyState === "applied" ? " done" : ""}${applyState === "loading" ? " loading" : ""}`}
              disabled={applyState === "loading" || !pendingRange.start || !pendingRange.end || new Date(pendingRange.start) > new Date(pendingRange.end)}
              onClick={() => {
                setApplyState("loading");
                isApplyingRef.current = true;
                setTimeout(() => {
                  setCustomRange({ ...pendingRange });
                }, 0);
              }}
            >
              {applyState === "loading"
                ? <span className="cv-range-apply-spinner" />
                : applyState === "applied"
                  ? <><Check size={14} /> Applied</>  
                  : <>Apply</>}
            </button>
          </div>
        )}
      </div>

      {applyState === "loading" && (
        <div className="cv-applying-loader">
          <span className="cv-range-apply-spinner cv-range-apply-spinner--lg" />
        </div>
      )}
      <div className={`cv-body-grid${applyState === "loading" ? " cv-applying" : ""}`}>
        {/* Left / main column: free summary + timeline */}
        <div className="cv-body-main">
          {/* Free time summary */}
          {freeSlots.length > 0 && (
            <div className="cv-free-summary">
              <Sparkles size={15} />
              <span>
                {freeSlots.length} free slot{freeSlots.length !== 1 ? "s" : ""} found
                {isMultiDay ? ` across ${selectedDates.length} days` : ""}
              </span>
            </div>
          )}

          {/* Timeline */}
          {viewMode === "merged" ? (
            <MergedTimeline
              myClasses={tlMyClasses}
              targetClasses={tlTargetClasses}
              targets={targets}
              freeSlots={tlFreeSlots}
              blockStyle={blockStyle}
              TOTAL_MIN={TOTAL_MIN}
              DAY_START={DAY_START}
              DAY_END={DAY_END}
              legend={legend}
              dayFilter={dayFilter}
            />
          ) : (
            <SideBySide
              myClasses={tlMyClasses}
              targetClasses={tlTargetClasses}
              targets={targets}
              freeSlots={tlFreeSlots}
              blockStyle={blockStyle}
              TOTAL_MIN={TOTAL_MIN}
              DAY_START={DAY_START}
              DAY_END={DAY_END}
              legend={legend}
              userName={/* current user name */ "You"}
              dayFilter={dayFilter}
              rangeLabel={prettyDateLabel}
            />
          )}

          {canTruncate && (
            <button className="cv-show-more" onClick={() => setMoreModal("timeline")}>
              <ChevronDown size={14} /> Show {hiddenTimelineDays} more day{hiddenTimelineDays !== 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Right / side column: free slots detail + insights */}
        <div className="cv-body-side">
          {/* Free time blocks detail */}
          <section className="cv-free-section">
            <div className="cv-free-section-head">
              <h3 className="cv-section-title"><Clock size={15} /> Matching Free Time</h3>
              {freeSlots.length > 0 && (
                <button className="cv-copy-btn" onClick={copyFreeSlots}>
                  {slotsCopied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                </button>
              )}
            </div>
            {freeSlots.length === 0 ? (
              <EmptyState compact icon={CalendarX2} title="No common free time" sub="Try a different day or range." />
            ) : (
              <div className="cv-free-list">
                <FreeSlotGroups
                  groups={canTruncate ? groupedFreeSlots.slice(0, PREVIEW_DAYS) : groupedFreeSlots}
                  isMultiDay={isMultiDay}
                  longestFreeIdx={longestFreeIdx}
                  maxFreeDuration={maxFreeDuration}
                  totalSlots={freeSlots.length}
                  onPlanSlot={onPlanSlot}
                />
                {canTruncate && groupedFreeSlots.length > PREVIEW_DAYS && (
                  <button className="cv-show-more" onClick={() => setMoreModal("free")}>
                    <ChevronDown size={14} /> Show {groupedFreeSlots.length - PREVIEW_DAYS} more day{groupedFreeSlots.length - PREVIEW_DAYS !== 1 ? "s" : ""}
                  </button>
                )}
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
        </div>{/* /cv-body-side */}
      </div>{/* /cv-body-grid */}

      {/* Full-range modal: bottom sheet on mobile, dialog on desktop */}
      {moreModal && (
        <div className="cv-more-backdrop" onClick={closeMoreModal}>
          <div className="cv-more-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="cv-more-grab" aria-hidden="true" />
            <div className="cv-more-head">
              <div className={`cv-more-icon ${moreModal === "timeline" ? "cv-more-icon-violet" : "cv-more-icon-green"}`}>
                {moreModal === "timeline" ? <CalendarDays size={16} /> : <Clock size={16} />}
              </div>
              <div className="cv-more-titles">
                <h3>{moreModal === "timeline" ? "Full schedule" : "All free time"}</h3>
                <span className="cv-more-sub">
                  {prettyDateLabel || "Custom range"} · {selectedDates.length} day{selectedDates.length !== 1 ? "s" : ""}
                </span>
              </div>
              {selectedDates.length > 1 && (
                <div className="cv-range-drop" ref={modalJumpRef}>
                  <button className="cv-sbs-datechip" onClick={() => setModalJumpOpen(o => !o)} aria-label="Go to date">
                    <CalendarDays size={13} />
                    <span className="cv-more-jump-label">Go to</span>
                    <ChevronDown size={12} className={`cv-range-caret ${modalJumpOpen ? "open" : ""}`} />
                  </button>
                  {modalJumpOpen && (
                    <div className="cv-range-menu cv-sbs-datemenu cv-more-jumpmenu">
                      {selectedDates.map(d => (
                        <button key={d} className="cv-range-opt" onClick={() => jumpInModal(d)}>
                          {new Date(d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button className="cv-more-close" onClick={closeMoreModal} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="cv-more-body" ref={moreBodyRef}>
              {moreModal === "timeline" ? (
                viewMode === "merged" ? (
                  <MergedTimeline
                    myClasses={myDayClasses}
                    targetClasses={targetDayClasses}
                    targets={targets}
                    freeSlots={freeSlots}
                    legend={legend}
                    dayFilter={dayFilter}
                  />
                ) : (
                  <SideBySide
                    myClasses={myDayClasses}
                    targetClasses={targetDayClasses}
                    targets={targets}
                    freeSlots={freeSlots}
                    legend={legend}
                    dayFilter={dayFilter}
                  />
                )
              ) : (
                <div className="cv-free-list">
                  <FreeSlotGroups
                    groups={groupedFreeSlots}
                    isMultiDay={isMultiDay}
                    longestFreeIdx={longestFreeIdx}
                    maxFreeDuration={maxFreeDuration}
                    totalSlots={freeSlots.length}
                    onPlanSlot={onPlanSlot}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
        <div key={gi} className="cv-agenda-day-group" data-date={g.date}>
          {["3", "7", "14", "30", "custom"].includes(dayFilter) && (
            <div className="cv-day-heading cv-day-heading-agenda">
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
                        {e.type !== "free" && isNationalHoliday(e.data) && <IndiaFlagIcon size={12} className="row-flag-icon" />}
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
function SideBySide({ myClasses, targetClasses, targets, dayFilter, freeSlots = [], rangeLabel = "" }) {
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

  const isMultiDay = ["3", "7", "14", "30", "custom"].includes(dayFilter);
  const minTrackWidth = Math.max(100, columnsDef.length * 150);

  // Keep the sticky name pills horizontally aligned with their columns.
  // Bidirectional: swiping either the pills or the columns drags the other along.
  const agendaRef = useRef(null);
  const pillsClipRef = useRef(null);
  useEffect(() => {
    const agenda = agendaRef.current;
    const clip = pillsClipRef.current;
    if (!agenda || !clip) return;
    let source = null;
    let releaseTimer = 0;
    const makeSync = (from, to) => () => {
      // Ignore the echo scroll event fired on the element we just updated
      if (source && source !== from) return;
      source = from;
      to.scrollLeft = from.scrollLeft;
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => { source = null; }, 100);
    };
    const fromAgenda = makeSync(agenda, clip);
    const fromPills = makeSync(clip, agenda);
    agenda.addEventListener("scroll", fromAgenda, { passive: true });
    clip.addEventListener("scroll", fromPills, { passive: true });
    clip.scrollLeft = agenda.scrollLeft;
    return () => {
      agenda.removeEventListener("scroll", fromAgenda);
      clip.removeEventListener("scroll", fromPills);
      clearTimeout(releaseTimer);
    };
  }, []);

  // Track which date sits under the sticky bar while scrolling vertically
  const dayRefs = useRef({});
  const stickyRef = useRef(null);
  const [activeDate, setActiveDate] = useState(null);
  const datesKey = dates.join(",");
  // Bottom edge of the sticky bar (its CSS `top` offset varies: below the app's
  // mobile header/tabs on phones, at the viewport top on desktop)
  const stickyBottom = () => {
    const bar = stickyRef.current;
    if (!bar) return 140;
    return (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight;
  };
  useEffect(() => {
    if (!isMultiDay || !dates.length) return;
    let raf = 0;
    const measure = () => {
      const threshold = stickyBottom() + 10;
      let cur = dates[0];
      for (const d of dates) {
        const el = dayRefs.current[d];
        if (el && el.getBoundingClientRect().top <= threshold) cur = d;
      }
      setActiveDate(cur);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesKey, isMultiDay]);

  const [jumpOpen, setJumpOpen] = useState(false);
  const jumpRef = useRef(null);
  useEffect(() => {
    function onDown(e) { if (jumpRef.current && !jumpRef.current.contains(e.target)) setJumpOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function jumpToDate(d) {
    setJumpOpen(false);
    const el = dayRefs.current[d];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - stickyBottom() - 8;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  const fmtChip = d => new Date(d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <div>
      {/* Sticky bar — lives outside overflow-x container so it actually sticks */}
      <div className="cv-sbs-sticky-header" ref={stickyRef}>
        {isMultiDay && activeDate && dates.includes(activeDate) && (
          <div className="cv-sbs-datebar">
            <div className="cv-range-drop" ref={jumpRef}>
              <button className="cv-sbs-datechip" onClick={() => setJumpOpen(o => !o)} aria-label="Jump to date">
                <CalendarDays size={13} />
                {fmtChip(activeDate)}
                <ChevronDown size={12} className={`cv-range-caret ${jumpOpen ? "open" : ""}`} />
              </button>
              {jumpOpen && (
                <div className="cv-range-menu cv-sbs-datemenu">
                  {dates.map(d => (
                    <button key={d} className={`cv-range-opt ${d === activeDate ? "on" : ""}`} onClick={() => jumpToDate(d)}>
                      {fmtChip(d)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {rangeLabel && <span className="cv-day-label cv-sbs-rangelabel">{rangeLabel}</span>}
          </div>
        )}
        <div className="cv-sbs-pills-clip" ref={pillsClipRef}>
          <div className="cv-sbs-pills-track" style={{ minWidth: minTrackWidth + "px" }}>
            {columnsDef.map((col, i) => {
              const pillClass = i === 0 ? "you" : i === 1 ? "them" : i === 2 ? "them2" : "them3";
              return (
                <div key={i} className="cv-sbs-pill-cell">
                  <div className={`cv-sbs-name-pill ${pillClass}`}>{col.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="cv-side-agenda-wrap">
      <div className="cv-side-agenda" ref={agendaRef}>
        <div className="cv-sbs-inner" style={{ minWidth: minTrackWidth + "px" }}>
        {/* Body */}
        <div className="cv-sbs-body">
          {dateGroups.length === 0 && <div className="cv-empty cv-sbs-noclasses">No classes</div>}

          {dateGroups.map((dg) => {
            const isFreeDay = isMultiDay && dg.rows.every(r => r.columns.every(c => c.length === 0));
            const daySlots = dg.rows.flatMap(r => r.freeSlots);
            return (
              <div key={dg.date} className="cv-sbs-day" data-date={dg.date} ref={el => { dayRefs.current[dg.date] = el; }}>
                {isMultiDay && (
                  <div className="cv-day-heading">
                    {new Date(dg.date).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                  </div>
                )}

                {isFreeDay ? (
                  <div className="cv-sbs-freeday">
                    <span className="cv-sbs-freeday-badge">All free</span>
                    <span className="cv-sbs-freeday-text">
                      No classes for anyone{daySlots.length ? ` · ${fmtTime(daySlots[0].start)} – ${fmtTime(daySlots[daySlots.length - 1].end)}` : ""} <PartyPopper size={12} aria-hidden="true" />
                    </span>
                  </div>
                ) : dg.rows.map((row, ri) => (
                  <div key={ri} className="cv-sbs-row">
                    {row.freeSlots.map((fs, fsi) => (
                      <div key={fsi} className="cv-sbs-freepill">
                        <span>{fmtTime(fs.start)} – {fmtTime(fs.end)}</span>
                        <span className="cv-sbs-freepill-tag">Free</span>
                      </div>
                    ))}

                    {row.columns.some(col => col.length > 0) && (
                      <div className="cv-sbs-cols">
                        {row.columns.map((colItems, ci) => (
                          <div key={ci} className="cv-sbs-col">
                            {colItems.length === 0 ? (
                              <div className="cva-card cv-sbs-emptycell">
                                <span>Free</span>
                              </div>
                            ) : colItems.map((c, cii) => {
                              const isShared = c.type === "holiday" || c.type === "break";
                              return (
                                <div key={cii} className={`cva-card cv-sbs-card ${isShared ? "cva-shared" : columnsDef[ci].colorClass}`}>
                                  <div className="cva-time-sm">{fmtTime(c.start)} – {fmtTime(c.end)}</div>
                                  <div className="cva-title">
                                    {isNationalHoliday(c) && <IndiaFlagIcon size={12} className="row-flag-icon" />}
                                    {c.name}
                                  </div>
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
            );
          })}
        </div>
        </div>
      </div>
      <div className="cv-side-agenda-fade" aria-hidden="true" />
      </div>
    </div>
  );
}
