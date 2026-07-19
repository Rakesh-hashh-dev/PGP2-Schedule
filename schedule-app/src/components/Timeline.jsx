import React, { useState, useRef, useEffect } from "react";
import { MapPin, CheckCircle2, XCircle, AlertTriangle, TrendingDown } from "lucide-react";
import { sessionKey, isExamSession } from "../lib/attendance.js";
import { subjectClass } from "../lib/subjectColors.js";
import { haptic } from "../lib/haptics.js";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmtClock(d) { return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }); }

function TypeBadge({ type }) {
  if (type === "holiday") return <span className="tb holiday">Holiday</span>;
  if (type === "exam") return <span className="tb exam">Exam / Admin</span>;
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
        {bad ? "skip → grade penalty" : <>skip → {info.pctIfSkip}% · {info.skipsRemaining} left</>}
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

export default React.memo(function Timeline({ list, current, now, showNowLine = true, label = "Today", dateLabel, attendance = {}, markAttendance, skipInfo, syncStatus, onRefresh, isSyncing }) {
  const ptr = usePullToRefresh(onRefresh, isSyncing);
  if (!list.length)
    return (
      <section className="panel">
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
  const allDone = showNowLine && list.every(c => nowMin >= toMin(c.end));
  // Find the first upcoming class (not break/holiday) for the "next" badge
  // If we're not showing the now line (e.g. Tomorrow view), just highlight the very first class
  const nextUpIdx = showNowLine 
    ? list.findIndex(c => c.type === "class" && toMin(c.start) > nowMin) 
    : list.findIndex(c => c.type === "class");

  return (
    <section className="panel">
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
        <span className="count">{(() => {
          const n = list.filter((c) => c.type === "class").length;
          return `${n} ${n === 1 ? "class" : "classes"}`;
        })()}</span>
      </div>
      <ol className="rail">
        {list.map((c, i) => {
          const isCur = current && current.date === c.date && current.start === c.start && current.name === c.name;
          // For non-class items (breaks/holidays), use start time as "done" since they aren't attended
          const prevDone = i === 0 || (() => {
            const prev = list[i - 1];
            const threshold = prev.type !== "class" ? toMin(prev.start) : toMin(prev.end);
            return nowMin >= threshold;
          })();
          const showNow = showNowLine && !isCur && nowMin < toMin(c.start) && prevDone;
          const isPast = showNowLine && !isCur && nowMin >= (c.type !== "class" ? toMin(c.start) : toMin(c.end));
          const isNext = showNowLine && i === nextUpIdx;
          const isFirst = !showNowLine && i === nextUpIdx;
          const canMark = c.type === "class" && !isExamSession(c) && !!markAttendance && clsStart(c) <= now;
          const attKey = c.type === "class" && !isExamSession(c) ? sessionKey(c) : null;
          const attStatus = attKey ? attendance[attKey] : null;

          let progress = 0;
          if (isCur) {
            const startMin = toMin(c.start);
            const endMin = c.type !== "class" ? toMin(c.start) + 15 : toMin(c.end); // fallback for breaks
            progress = Math.max(0, Math.min(100, ((nowMin - startMin) / (endMin - startMin)) * 100));
          }

          return (
            <React.Fragment key={i}>
              {showNow && (
                <li className="nowline">
                  <span className="nowdot" />
                  <span className="nowtime">{fmtClock(now)}</span>
                  <span className="nowrule" />
                </li>
              )}
              <li className={`row${isCur ? " cur" : ""}${c.type !== "class" ? " soft" : ""}${isPast ? " past" : ""}${isNext ? " next-up" : ""}${isFirst ? " first-up" : ""}`}>
                <div className="row-time">
                  <span className="rt-start">{c.start}</span>
                  <span className="rt-end">{c.end}</span>
                </div>
                <div className={`row-body${c.type === "class" && c.code ? ` subj-edge ${subjectClass(c.code)}` : ""}`} style={{ position: "relative" }}>
                  {isCur && (
                    <div className="cur-progress-track">
                      <div className="cur-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  <div className="row-head">
                    <div className="row-course">
                      {c.name} {c.session && (
                        <span className={`ses ${subjectClass(c.code)}`}>
                          {c.code} {c.session}
                        </span>
                      )}
                    </div>
                    {isCur && <span className="row-flag">now</span>}
                    {isNext && !isCur && <span className="row-flag row-flag-next">next</span>}
                    {isFirst && !isCur && <span className="row-flag row-flag-first">1st class</span>}
                  </div>
                  <div className="row-meta">
                    {c.type === "class"
                      ? <>
                          <span className="row-loc"><MapPin size={13} /> {c.room || "TBA"}</span>
                          {c.faculty && <span className="row-faculty">{c.faculty}</span>}
                          {c.section === "Single" && <span className="single-tag">all</span>}
                          {!isPast && attKey && !attStatus && <SkipHint info={skipInfo?.[c.code]} name={c.name} />}
                        </>
                      : <TypeBadge type={c.type} />}
                  </div>
                </div>
                {canMark && (
                  <div className="att-tog">
                    <button
                      className={`att-btn att-p${attStatus === "present" ? " on" : ""}`}
                      onClick={() => markAttendance(c, attStatus === "present" ? null : "present")}
                      title="Mark present"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                    <button
                      className={`att-btn att-a${attStatus === "absent" ? " on" : ""}`}
                      onClick={() => markAttendance(c, attStatus === "absent" ? null : "absent")}
                      title="Mark absent"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                )}
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
