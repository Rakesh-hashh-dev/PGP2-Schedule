import React, { useState, useRef, useEffect } from "react";
import { MapPin, CheckCircle2, XCircle, AlertTriangle, TrendingDown, ChevronRight, Timer } from "lucide-react";
import { ExamIcon, CelebrationIcon, PlacementIcon } from "./PremiumIcons.jsx";
import { sessionKey, isExamSession } from "../lib/attendance.js";
import { subjectClass, cleanSessionLabel } from "../lib/subjectColors.js";
import { haptic } from "../lib/haptics.js";
import IndiaFlagIcon from "./IndiaFlagIcon.jsx";
import { CancellationStripe, CancelledClassActions } from "./CancelledClassNotice.jsx";
import { isNationalHoliday } from "../lib/nationalHolidays.js";
import { fmtTime12 } from "../lib/datetime.js";
import { isScheduleBreak, timelineActivitySummary } from "../lib/scheduleBreaks.js";
import ClassNoteReminder from "./ClassNoteReminder.jsx";
import { reminderNotes } from "../lib/classNoteReminder.js";
import { useTodayCourseNotes } from "../lib/useTodayCourseNotes.js";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmtClock(d) { return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }); }
function fmtDuration(start, end) {
  return fmtMinutes(Math.max(0, toMin(end) - toMin(start)));
}
function fmtMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function TypeBadge({ type, name }) {
  if (type === "cancelled") return <span className="tb" style={{ color: "var(--danger)" }}><XCircle size={12} />Cancelled</span>;
  if (type === "holiday") {
    const isNational = isNationalHoliday({ type, name });
    return (
      <span className={`tb holiday${isNational ? " tb-tricolor" : ""}`}>Holiday</span>
    );
  }
  if (type === "exam") return <span className="tb exam"><ExamIcon size={12} />Exam / Admin</span>;
  if (type === "event") return <span className="tb event celebration"><CelebrationIcon size={12} />Event</span>;
  if (type === "placement") return <span className="tb placement"><PlacementIcon size={12} />Placement</span>;
  if (type === "break") return <span className="tb break">Break</span>;
  return null;
}

function clsStart(c) {
  const [Y, Mo, D] = c.date.split("-").map(Number);
  const [h, m] = c.start.split(":").map(Number);
  return new Date(Y, Mo - 1, D, h, m);
}
import { RefreshCw } from "lucide-react";

// "What if I skip this one" hint for unmarked upcoming classes; math comes
// from courseSkipStats in lib/attendance.js (same source as Attendance panel)
function SkipHint({ info, name }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  if (!info || info.totalAllowedSkips === 0) return null;

  const bad = info.skipsRemaining === 0;
  const tone = bad ? "skip-hint-bad" : info.skipsRemaining === 1 || info.pctIfSkip < 80 ? "skip-hint-warn" : "skip-hint-ok";
  const skipsUsed = info.totalAllowedSkips - info.skipsRemaining;

  return (
    <span
      className="skip-hint-wrap"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className={`skip-hint ${tone}`}
        tabIndex={0}
        role="button"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
          if (e.key === "Escape") setOpen(false);
        }}
      >
        {bad ? "Skip → grade penalty" : <>Skip → {info.pctIfSkip}% · {info.skipsRemaining} left</>}
      </span>
      {open && (
        <div className="skip-tip" role="tooltip">
          <div className={`skip-tip-icon skip-tip-icon-${bad ? "bad" : tone === "skip-hint-warn" ? "warn" : "ok"}`}>
            {bad ? <AlertTriangle size={13} /> : <TrendingDown size={13} />}
          </div>
          <div className="skip-tip-body">
            <div className="skip-tip-headline">
              {bad ? "Grade penalty risk" : `Drops to ${info.pctIfSkip}% if skipped`}
            </div>
            <div className="skip-tip-sub">{name}</div>
            <div className="skip-tip-meter">
              <div className="skip-tip-meter-track">
                {Array.from({ length: info.totalAllowedSkips }).map((_, i) => (
                  <span key={i} className={`skip-tip-dot${i < skipsUsed ? " used" : ""}`} />
                ))}
              </div>
              <span className="skip-tip-meter-label">
                {skipsUsed}/{info.totalAllowedSkips} skips used
              </span>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

// Pull-to-refresh (touch devices): drag down from the top of the page to
// trigger onRefresh. Native listeners because React's root touch handlers are
// passive — preventDefault() there can't stop the browser's own overscroll.
function usePullToRefresh(onRefresh, isSyncing) {
  const [pull, setPull] = useState(0);       // indicator height in px
  const [armed, setArmed] = useState(false); // past release threshold
  const [dragging, setDragging] = useState(false);
  const holdRef = useRef(false);             // spinner held open while syncing
  const [holding, setHolding] = useState(false); // render mirror of holdRef
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; });

  const enabled = !!onRefresh && typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  useEffect(() => {
    if (!enabled) return;
    const THRESHOLD = 64;
    let startY = 0, pulling = false, hijacked = false, dist = 0, raf = 0, wasArmed = false;

    const reset = () => { dist = 0; hijacked = false; setPull(0); setArmed(false); wasArmed = false; };
    const onStart = (e) => {
      if (window.scrollY > 0 || holdRef.current) return;
      startY = e.touches[0].clientY;
      pulling = true;
      hijacked = false;
      dist = 0;
    };
    const onMove = (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      // Only take over once it's clearly a downward pull from the very top
      if (!hijacked) {
        if (dy < 8 || window.scrollY > 0) { if (dy < 0) pulling = false; return; }
        hijacked = true;
        setDragging(true);
      }
      if (e.cancelable) e.preventDefault();
      dist = Math.min(96, (dy - 8) * 0.45);
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        setPull(dist);
        const a = dist >= THRESHOLD;
        if (a !== wasArmed) {
          wasArmed = a;
          setArmed(a);
          if (a) haptic(10);
        }
      });
    };
    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      setDragging(false);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (hijacked && dist >= THRESHOLD) {
        // Hold the spinner open; the isSyncing effect below collapses it
        holdRef.current = true;
        setHolding(true);
        dist = 0; hijacked = false;
        setPull(48);
        setArmed(true);
        onRefreshRef.current?.();
      } else reset();
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);

  useEffect(() => {
    if (!isSyncing && holdRef.current) {
      holdRef.current = false;
      setHolding(false);
      setPull(0);
      setArmed(false);
    }
  }, [isSyncing]);

  return { pull, armed, dragging, holding };
}

function PullIndicator({ ptr, isSyncing }) {
  if (ptr.pull <= 0) return null;
  const spinning = isSyncing && ptr.holding;
  return (
    <div className={`ptr${ptr.dragging ? " ptr-dragging" : ""}${ptr.armed ? " ptr-armed" : ""}`} style={{ height: ptr.pull }} aria-hidden="true">
      <span className="ptr-ind">
        <RefreshCw size={16} className={spinning ? "spin-icon" : ""} style={spinning ? undefined : { transform: `rotate(${ptr.pull * 2.4}deg)` }} />
      </span>
    </div>
  );
}

// Flash only rows whose schedule details changed after this timeline mounted.
// The existing minute updates do not restart the animation.
function useChangedRows(list) {
  const previous = useRef(null);
  const [changed, setChanged] = useState(() => new Set());
  useEffect(() => {
    const current = new Map(list.map((item) => {
      const key = `${item.date}|${item.code || item.name}|${item.session || item.type}|${item.start}`;
      return [key, `${item.end}|${item.room}|${item.section}|${item.faculty}|${item.name}`];
    }));
    if (previous.current) {
      const updates = new Set([...current].filter(([key, value]) => previous.current.get(key) !== value).map(([key]) => key));
      if (updates.size) setChanged(updates);
    }
    previous.current = current;
  }, [list]);
  useEffect(() => {
    if (!changed.size) return;
    const timer = window.setTimeout(() => setChanged(new Set()), 700);
    return () => window.clearTimeout(timer);
  }, [changed]);
  return changed;
}

export default React.memo(function Timeline({ list, current, now, showNowLine = true, label = "Today", dateLabel, attendance = {}, markAttendance, skipInfo, syncStatus, onRefresh, isSyncing, onOpenSession, focusMode = false, termNumber, userId, notesEnabled = false }) {
  const ptr = usePullToRefresh(onRefresh, isSyncing);
  const changedRows = useChangedRows(list);
  const courseNotes = useTodayCourseNotes(notesEnabled, userId);
  const [editingAtt, setEditingAtt] = useState(null); // sessionKey whose marked chip was tapped to change
  if (!list.length)
    return (
      <section className={`panel timeline-panel${showNowLine ? " timeline-today" : ""}`}>
        <PullIndicator ptr={ptr} isSyncing={isSyncing} />
        <div className="panel-head">
          <div className="panel-head-left">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2>{label}</h2>
              {syncStatus && <div className="desk-only desk-live-pill">{syncStatus}</div>}
              {onRefresh && (
                <button onClick={onRefresh} className="sync" aria-label="Refresh" style={{ padding: "4px", margin: 0, background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)" }}>
                  <RefreshCw size={16} className={isSyncing ? "spin-icon" : ""} />
                </button>
              )}
            </div>
            {dateLabel && <span className="panel-date">{dateLabel}</span>}
          </div>
        </div>
        <div className="empty">No sessions {label.toLowerCase()} for your courses. Check the week view.</div>
      </section>
    );

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const summary = timelineActivitySummary(list, nowMin);
  const allDone = showNowLine && summary.allDone;
  // Find the first upcoming class (not break/holiday) for the "next" badge
  // If we're not showing the now line (e.g. Tomorrow view), just highlight the very first class
  const nextUpIdx = showNowLine 
    ? list.findIndex(c => c.type === "class" && !isScheduleBreak(c) && toMin(c.start) > nowMin)
    : list.findIndex(c => c.type === "class" && !isScheduleBreak(c));
  const nextVisibleIdx = showNowLine ? summary.nextIndex : -1;
  const { classCount, firstStart, lastEnd } = summary;
  const activityCount = summary.activities.length;
  const completedClasses = showNowLine ? summary.completedClasses : 0;
  const nextVisible = nextVisibleIdx >= 0 ? list[nextVisibleIdx] : null;
  const dayStatus = current && !isScheduleBreak(current)
    ? { tone: "live", label: "Happening now", detail: current.name, code: current.code }
    : nextVisible
      ? { tone: "next", label: "Up next", detail: `${nextVisible.name} · ${fmtTime12(nextVisible.start)}` }
      : { tone: "done", label: activityCount ? "Day complete" : "No activities today", detail: activityCount ? "Nothing else scheduled" : "Breaks only" };

  return (
    <section className={`panel timeline-panel${showNowLine ? " timeline-today" : " timeline-tomorrow"}${focusMode ? " is-focus-mode" : ""}`}>
      <PullIndicator ptr={ptr} isSyncing={isSyncing} />
      <div className="panel-head timeline-panel-head">
        <div className="panel-head-left">
          <span className="timeline-eyebrow">{showNowLine ? "Your day at a glance" : "Your schedule"}</span>
          <div className="timeline-title-row">
            <h2>{label}</h2>
            {syncStatus && <div className="desk-only desk-live-pill">{syncStatus}</div>}
            {onRefresh && (
              <button onClick={onRefresh} className="panel-refresh" aria-label="Refresh">
                <RefreshCw size={15} className={isSyncing ? "spin-icon" : ""} />
              </button>
            )}
          </div>
          {dateLabel && <span className="panel-date">{dateLabel}</span>}
        </div>
        {showNowLine ? (
          <div className="timeline-overview" aria-label={classCount ? `${classCount} classes, ${completedClasses} completed` : `${activityCount} activities`}>
            <div className={`timeline-status timeline-status-${dayStatus.tone}`}>
              <span className="timeline-status-dot" aria-hidden="true" />
              <span className="timeline-status-copy">
                <strong className="timeline-status-label">{dayStatus.label}</strong>
                {/* Phones swap the label for the live subject's code. */}
                {dayStatus.code && <strong className="timeline-status-code">{dayStatus.code}</strong>}
                <span>{dayStatus.detail}</span>
              </span>
            </div>
            <div className="timeline-progress-copy">
              <strong>{classCount ? `${completedClasses}/${classCount}` : activityCount}</strong>
              <span className="desk-only">{classCount ? "classes complete" : "activities"}</span>
              <span className="timeline-progress-mob-label">{classCount ? "done" : "activities"}</span>
            </div>
          </div>
        ) : (
          <div className="tomorrow-timeline-overview" aria-label={`${classCount} ${classCount === 1 ? "class" : "classes"}${firstStart ? `, ${fmtTime12(firstStart)} to ${fmtTime12(lastEnd)}` : ""}`}>
            <span className="tomorrow-timeline-range">{firstStart ? <>{fmtTime12(firstStart)} <span aria-hidden="true">→</span> {fmtTime12(lastEnd)}</> : "Breaks only"}</span>
            <span className="tomorrow-timeline-count">{classCount} {classCount === 1 ? "class" : "classes"}</span>
          </div>
        )}
      </div>
      <ol className="rail">
        {list.map((c, i) => {
          const gapMinutes = i > 0 ? toMin(c.start) - toMin(list[i - 1].end) : 0;
          const isBreak = isScheduleBreak(c);
          const isCancelled = c.type === "cancelled";
          const isCur = !isBreak && current && current.date === c.date && current.start === c.start && current.name === c.name;
          // For non-class items (breaks/holidays), use start time as "done" since they aren't attended
          const prevDone = i === 0 || (() => {
            const prev = list[i - 1];
            const threshold = prev.type !== "class" ? toMin(prev.start) : toMin(prev.end);
            return nowMin >= threshold;
          })();
          const showNow = showNowLine && !isBreak && !isCur && nowMin < toMin(c.start) && prevDone;
          const isPast = showNowLine && !isCur && nowMin >= (c.type !== "class" ? toMin(c.start) : toMin(c.end));
          const isNext = showNowLine && i === nextUpIdx;
          const isFirst = !showNowLine && i === nextUpIdx;
          const canMark = !isBreak && c.type === "class" && !isExamSession(c) && !!markAttendance && clsStart(c) <= now;
          const attKey = !isBreak && c.type === "class" && !isExamSession(c) ? sessionKey(c) : null;
          const attStatus = attKey ? attendance[attKey] : null;
          const minsLeft = isCur ? Math.max(0, toMin(c.end) - nowMin) : 0;
          const savedNotes = notesEnabled && c.type === "class" && !isExamSession(c) ? reminderNotes(c, courseNotes, termNumber) : null;
          const detailsBtn = c.type === "class" && onOpenSession && (
            <button type="button" className="prep-open" onClick={() => onOpenSession(c)} aria-label={`Open class details for ${c.name}`}>
              {!canMark && <span className="prep-open-label">Details</span>}
              <ChevronRight size={15} strokeWidth={2.4} className="prep-open-chev" />
            </button>
          );

          return (
            <React.Fragment key={i}>
              {!showNowLine && !isBreak && gapMinutes >= 15 && (
                <li className="tomorrow-timeline-gap" aria-label={`${fmtDuration(list[i - 1].end, c.start)} free before ${c.name}`}>
                  <span className="tomorrow-timeline-gap-line" aria-hidden="true" />
                  <span>Free for {fmtDuration(list[i - 1].end, c.start)}</span>
                </li>
              )}
              {showNow && (
                <li className="nowline">
                  <span className="nowdot" />
                  <span className="nowtime">{fmtClock(now)}</span>
                  <span className="nowrule" />
                </li>
              )}
              <li
                className={`row${isCancelled ? " row-cancelled" : ""}${isBreak ? " row-break" : ""}${!showNowLine && c.type === "class" && c.code ? ` ${subjectClass(c.code)}` : ""}${isCur ? " cur" : ""}${c.type !== "class" ? " soft" : ""}${c.type === "event" ? " row-event-celebration" : ""}${c.type === "placement" ? " row-placement" : ""}${isPast ? " past" : ""}${isNext ? " next-up" : ""}${isFirst ? " first-up" : ""}${showNowLine && i === nextVisibleIdx ? " timeline-up-next" : ""}${changedRows.has(`${c.date}|${c.code || c.name}|${c.session || c.type}|${c.start}`) ? " tf-row-updated" : ""}`}
                aria-current={isCur ? "true" : undefined}
              >
                <div className="row-time">
                  <time className="rt-start" dateTime={`${c.date}T${c.start}`}>{fmtTime12(c.start)}</time>
                  <span className="rt-separator" aria-hidden="true" />
                  <time className="rt-end" dateTime={`${c.date}T${c.end}`}>{fmtTime12(c.end)}</time>
                  {showNowLine && <span className="rt-duration">{fmtDuration(c.start, c.end)}</span>}
                </div>
                <span className="timeline-marker" aria-hidden="true"><span /></span>
                <div className={`row-body${c.type === "class" && c.code ? ` subj-edge ${subjectClass(c.code)}` : ""}`} style={{ position: "relative" }}>
                  {isCancelled && <CancellationStripe />}
                  <div className="row-head">
                    <div className="row-course">
                      {isNationalHoliday(c) && <IndiaFlagIcon size={19} className="row-flag-icon" />}
                      <span style={c.type === "cancelled" ? { textDecoration: "line-through" } : undefined}>{c.name}</span> {c.session && (
                        <span className={`ses ${subjectClass(c.code)}`}>
                          {c.code} {cleanSessionLabel(c.session)}
                        </span>
                      )}
                    </div>
                    {isCur && (
                      <span className={`row-left${minsLeft <= 10 ? " row-left-soon" : ""}`} role="timer">
                        <Timer size={13} strokeWidth={2.2} aria-hidden="true" />
                        {minsLeft <= 10 ? `Ends in ${minsLeft} min` : `${fmtMinutes(minsLeft)} left`}
                      </span>
                    )}
                    {isNext && !isCur && <span className="row-flag row-flag-next">next</span>}
                    {isFirst && !isCur && <span className="row-flag row-flag-first">1st class</span>}
                    {!canMark && detailsBtn}
                  </div>
                  <div className="row-meta">
                    {(c.type === "class" || isCancelled)
                      ? <>
                          <span className="row-loc"><MapPin size={13} /> {c.room || "TBA"}</span>
                          {c.section === "Single" && <span className="row-sec">All sections</span>}
                          {c.faculty && <span className="row-faculty" title={c.faculty}>{c.faculty}</span>}
                          {savedNotes?.notes.length > 0 && onOpenSession && <ClassNoteReminder key={`${userId || "device"}:${termNumber}:${sessionKey(c)}`} session={c} now={now} scope={`${userId || "device"}:${termNumber || "current"}`} previous={savedNotes.previous} eligible={showNowLine && isNext && !isCur} onOpen={() => onOpenSession({ ...c, notesFocus: true })} />}
                          {!isCancelled && !canMark && !isPast && attKey && !attStatus && <SkipHint info={skipInfo?.[c.code]} name={c.name} />}
                        </>
                      : <>
                          <TypeBadge type={c.type} name={c.name} />
                          {(c.type === "event" || c.type === "placement") && c.room && <span className="row-loc" style={{ marginLeft: 8 }}><MapPin size={13} /> {c.room}</span>}
                          {(c.type === "event" || c.type === "placement") && c.section && c.section !== "Single" && c.section !== "All" && <span className="single-tag">Sec {c.section}</span>}
                        </>}
                  </div>
                  {isCancelled && <CancelledClassActions actions={[...(markAttendance && !isExamSession(c) ? ["Attended", "Skipped"] : []), ...(onOpenSession ? ["Details"] : [])]} />}
                  {canMark && (
                    <div className="row-foot">
                      <div className="row-att" role="group" aria-label={`Attendance for ${c.name}`}>
                        <button
                          type="button"
                          className={`row-att-btn row-att-p${attStatus === "present" ? " on" : ""}`}
                          onClick={() => markAttendance(c, attStatus === "present" ? null : "present")}
                          aria-pressed={attStatus === "present"}
                        >
                          <CheckCircle2 size={13} strokeWidth={2.2} /> Attended
                        </button>
                        <button
                          type="button"
                          className={`row-att-btn row-att-a${attStatus === "absent" ? " on" : ""}`}
                          onClick={() => markAttendance(c, attStatus === "absent" ? null : "absent")}
                          aria-pressed={attStatus === "absent"}
                        >
                          <XCircle size={13} strokeWidth={2.2} /> Skipped
                        </button>
                      </div>
                      {/* V2 phone swaps the segmented pill for this (mobile-v2.css):
                          one-tap CTA while unmarked, a compact result chip once marked. */}
                      <div className="row-att-cta" role="group" aria-label={`Attendance for ${c.name}`}>
                        {attStatus && editingAtt !== attKey ? (
                          // The whole chip is the "change" control: tapping it reopens the buttons.
                          <button
                            type="button"
                            className={`row-att-done row-att-done-${attStatus}`}
                            onClick={() => setEditingAtt(attKey)}
                            aria-label={`${attStatus === "present" ? "Attended" : "Skipped"}${skipInfo?.[c.code]?.pct != null ? `, ${skipInfo[c.code].pct}%` : ""}. Tap to change`}
                          >
                            {attStatus === "present"
                              ? <CheckCircle2 size={15} strokeWidth={2.4} aria-hidden="true" />
                              : <XCircle size={15} strokeWidth={2.4} aria-hidden="true" />}
                            <strong>{attStatus === "present" ? "Attended" : "Skipped"}</strong>
                            {skipInfo?.[c.code]?.pct != null && (
                              <span className="row-att-done-sub">{skipInfo[c.code].pct}%</span>
                            )}
                            {/* Skip budget only surfaces once it's nearly gone */}
                            {attStatus === "absent" && skipInfo?.[c.code]?.totalAllowedSkips > 0 && skipInfo[c.code].skipsRemaining <= 1 && (
                              <span className={`row-att-warn${skipInfo[c.code].skipsRemaining === 0 ? " is-out" : ""}`}>
                                {skipInfo[c.code].skipsRemaining === 0 ? "No skips left" : "Last skip left"}
                              </span>
                            )}
                          </button>
                        ) : (
                          <>
                            {/* While changing, the current choice is highlighted; tapping it again clears the mark. */}
                            <button
                              type="button"
                              className={`row-att-primary${attStatus === "present" ? " is-on" : ""}`}
                              onClick={() => { markAttendance(c, attStatus === "present" ? null : "present"); setEditingAtt(null); }}
                              aria-pressed={attStatus ? attStatus === "present" : undefined}
                            >
                              <CheckCircle2 size={15} strokeWidth={2.4} aria-hidden="true" /> {isCur ? "I'm in class" : "Attended"}
                            </button>
                            <button
                              type="button"
                              className={`row-att-secondary${attStatus === "absent" ? " is-on" : ""}`}
                              onClick={() => { markAttendance(c, attStatus === "absent" ? null : "absent"); setEditingAtt(null); }}
                              aria-pressed={attStatus ? attStatus === "absent" : undefined}
                            >
                              Skipped
                            </button>
                          </>
                        )}
                      </div>
                      {!isPast && !attStatus && <SkipHint info={skipInfo?.[c.code]} name={c.name} />}
                      {detailsBtn}
                    </div>
                  )}
                </div>
              </li>
            </React.Fragment>
          );
        })}
        {allDone && (
          <li className="nowline nowline-end">
            <span className="nowdot" />
            <span className="nowtime">{fmtClock(now)}</span>
            <span className="nowrule" />
            <span className="nowlabel">All done</span>
          </li>
        )}
      </ol>
    </section>
  );
});
