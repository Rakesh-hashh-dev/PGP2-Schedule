import React from "react";
import { MapPin, CheckCircle2, XCircle } from "lucide-react";
import { sessionKey } from "../lib/attendance.js";

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

export default React.memo(function Timeline({ list, current, now, showNowLine = true, label = "Today", dateLabel, attendance = {}, markAttendance, syncStatus }) {
  if (!list.length)
    return (
      <section className="panel">
        <div className="panel-head">
          <div className="panel-head-left">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2>{label}</h2>
              {syncStatus && <div className="desk-only desk-live-pill">{syncStatus}</div>}
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
      <div className="panel-head">
        <div className="panel-head-left">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2>{label}</h2>
            {syncStatus && <div className="desk-only desk-live-pill">{syncStatus}</div>}
          </div>
          {dateLabel && <span className="panel-date">{dateLabel}</span>}
        </div>
        <span className="count">{list.filter((c) => c.type === "class").length} classes</span>
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
          const canMark = c.type === "class" && !!markAttendance && clsStart(c) <= now;
          const attKey = c.type === "class" ? sessionKey(c) : null;
          const attStatus = attKey ? attendance[attKey] : null;
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
                <div className="row-body">
                  <div className="row-course">
                    {c.name} {c.session && (
                      <span className={`ses ses-${(Array.from(c.code).reduce((h, char) => h + char.charCodeAt(0), 0)) % 6}`}>
                        {c.code} {c.session}
                      </span>
                    )}
                  </div>
                  <div className="row-meta">
                    {c.type === "class"
                      ? <>
                          <><MapPin size={13} /> {c.room || "TBA"}</>
                          {c.faculty && <> · {c.faculty}</>}
                          {c.section === "Single" && <span className="single-tag">all</span>}
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
                {isCur && <span className="row-flag">now</span>}
                {isNext && !isCur && <span className="row-flag row-flag-next">next</span>}
                {isFirst && !isCur && <span className="row-flag row-flag-first">1st class</span>}
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
}
