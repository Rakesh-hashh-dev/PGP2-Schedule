import React from "react";
import { MapPin } from "lucide-react";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmtClock(d) { return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }); }

function TypeBadge({ type }) {
  if (type === "holiday") return <span className="tb holiday">Holiday</span>;
  if (type === "exam") return <span className="tb exam">Exam / Admin</span>;
  if (type === "break") return <span className="tb break">Break</span>;
  return null;
}

export default function Timeline({ list, current, now, showNowLine = true, label = "Today" }) {
  if (!list.length)
    return (
      <section className="panel">
        <div className="panel-head"><h2>{label}</h2></div>
        <div className="empty">No sessions {label.toLowerCase()} for your courses. Check the week view.</div>
      </section>
    );

  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{label}</h2>
        <span className="count">{list.filter((c) => c.type === "class").length} classes</span>
      </div>
      <ol className="rail">
        {list.map((c, i) => {
          const isCur = current && current.date === c.date && current.start === c.start && current.name === c.name;
          const showNow = showNowLine && !isCur && nowMin < toMin(c.start) && (i === 0 || nowMin >= toMin(list[i - 1].end));
          return (
            <React.Fragment key={i}>
              {showNow && (
                <li className="nowline">
                  <span className="nowdot" />
                  <span className="nowtime">{fmtClock(now)}</span>
                  <span className="nowrule" />
                </li>
              )}
              <li className={`row ${isCur ? "cur" : ""} ${c.type !== "class" ? "soft" : ""}`}>
                <div className="row-time">
                  <span className="rt-start">{c.start}</span>
                  <span className="rt-end">{c.end}</span>
                </div>
                <div className="row-body">
                  <div className="row-course">
                    {c.name} {c.session && <span className="ses">{c.code} {c.session}</span>}
                  </div>
                  <div className="row-meta">
                    {c.type === "class"
                      ? <>
                          {c.room && <><MapPin size={13} /> {c.room}</>}
                          {c.faculty && <> · {c.faculty}</>}
                          {c.section === "Single" && <span className="single-tag">all</span>}
                        </>
                      : <TypeBadge type={c.type} />}
                  </div>
                </div>
                {isCur && <span className="row-flag">now</span>}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </section>
  );
}
