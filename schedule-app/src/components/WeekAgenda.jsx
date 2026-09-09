import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, BarChart3, ChevronDown } from "lucide-react";
import WeekGlance from "./WeekGlance.jsx";
import { subjectClass } from "../lib/subjectColors.js";
import { isNationalHoliday } from "../lib/nationalHolidays.js";
import IndiaFlagIcon from "./IndiaFlagIcon.jsx";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function WeekAgenda({ visible, now, offset, setOffset, todayISO, onViewFullSchedule }) {
  const [showStats, setShowStats] = useState(false);
  const monday = new Date(now);
  const dow = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dow + offset * 7);
  monday.setHours(0, 0, 0, 0);

  const days = [...Array(7)].map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const label = `${monday.toLocaleDateString([], { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString([], { day: "numeric", month: "short" })}`;

  return (
    <section className="panel wa-panel">
      <div className="weeknav">
        <button onClick={() => setOffset(offset - 1)} aria-label="Previous week"><ChevronLeft size={18} /></button>
        <div className="weeknav-mid">
          <span className="wk-range">{label}</span>
          {offset !== 0 && <button className="wk-today" onClick={() => setOffset(0)}>This week</button>}
        </div>
        <button onClick={() => setOffset(offset + 1)} aria-label="Next week"><ChevronRight size={18} /></button>
      </div>

      <div className="wa-days-scroll">
        {days.map((d) => {
          const iso = ymd(d);
          const items = visible.filter((c) => c.date === iso).sort((a, b) => toMin(a.start) - toMin(b.start));
          return (
            <div key={iso} className={`agday ${iso === todayISO ? "agtoday" : ""}`}>
              <div className="agday-h">
                <span className="agday-dow">{d.toLocaleDateString([], { weekday: "short" })}</span>
                <span className="agday-num">{d.getDate()}</span>
                {iso === todayISO && <span className="agday-today">Today</span>}
              </div>
              <div className="agday-body">
                {items.length === 0
                  ? <span className="agday-free">–</span>
                  : items.map((c, i) => (
                      <div key={i} className={`ag ${c.type !== "class" ? "soft" : ""}`}>
                        <span className="ag-t">{c.start}</span>
                        <span className="ag-c">
                          {isNationalHoliday(c) && <IndiaFlagIcon size={13} className="row-flag-icon" />}
                          {c.name}
                          {c.session && (
                            <span className={`ses ${subjectClass(c.code)}`}>
                              {c.code} {c.session}
                            </span>
                          )}
                        </span>
                        {(c.type === "class" || c.type === "placement") && c.room && <span className="ag-r">{c.room}</span>}
                      </div>
                    ))}
              </div>
            </div>
          );
        })}
      </div>

      {onViewFullSchedule && (
        <div className="wa-footer">
          <button className="fr-btn fr-btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => onViewFullSchedule(ymd(days[0]))}>
            <Calendar size={15} /> View full schedule
          </button>
        </div>
      )}

      {/* Week Stats — desktop/tablet only; on mobile the same card shows above the agenda */}
      <div className="wa-stats desktop-only">
        <button
          className={`wa-stats-toggle${showStats ? " open" : ""}`}
          onClick={() => setShowStats((s) => !s)}
          aria-expanded={showStats}
        >
          <span className="wa-stats-toggle-l"><BarChart3 size={15} /> Week Stats</span>
          <ChevronDown size={16} className="wa-stats-chev" />
        </button>
        {showStats && (
          <div className="wa-stats-body">
            <WeekGlance visible={visible} now={now} offset={offset} todayISO={todayISO} />
          </div>
        )}
      </div>
    </section>
  );
}
