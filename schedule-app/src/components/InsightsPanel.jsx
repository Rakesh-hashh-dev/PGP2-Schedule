import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, CalendarDays, TrendingUp, Sunrise, Sunset, PieChart } from "lucide-react";
import { weeklyRecap } from "../lib/insights.js";
import { EmptyState } from "./ui.jsx";
import "../styles/insights.css";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const AREA_COLORS = ["var(--violet)", "var(--live)", "var(--amber)", "#2980B9", "#E11D48", "#0D9488", "#7C3AED"];

function fmtMin(min) {
  if (min == null) return "—";
  let h = Math.floor(min / 60), m = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

export default function InsightsPanel({ visible, now, attendance }) {
  const [offset, setOffset] = useState(0);
  const recap = useMemo(() => weeklyRecap(visible, now, attendance, offset), [visible, now, attendance, offset]);

  const rangeLabel = `${recap.monday.toLocaleDateString([], { day: "numeric", month: "short" })} – ${recap.sunday.toLocaleDateString([], { day: "numeric", month: "short" })}`;
  const maxHrs = Math.max(1, ...recap.perDay.map((d) => d.hrs));
  const peakIdx = recap.totalSessions ? recap.perDay.reduce((best, d, i) => (d.hrs > recap.perDay[best].hrs ? i : best), 0) : -1;
  const areaTotal = recap.areaList.reduce((s, [, h]) => s + h, 0) || 1;
  const label = offset === 0 ? "This week" : offset === -1 ? "Last week" : offset === 1 ? "Next week" : rangeLabel;

  return (
    <div className="insights-panel">
      <div className="insights-weekbar">
        <button className="insights-weeknav" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week"><ChevronLeft size={16} /></button>
        <div className="insights-weeklabel">
          <strong>{label}</strong>
          <span>{rangeLabel}</span>
        </div>
        <button className="insights-weeknav" onClick={() => setOffset((o) => o + 1)} aria-label="Next week"><ChevronRight size={16} /></button>
        {offset !== 0 && <button className="insights-today-btn" onClick={() => setOffset(0)}>This week</button>}
      </div>

      {recap.totalSessions === 0 ? (
        <EmptyState icon={CalendarDays} title="No classes this week" sub="Enjoy the breather — pick another week above." />
      ) : (
        <>
          <div className="insights-stats">
            <div className="insight-stat">
              <div className="insight-stat-ico"><CalendarDays size={16} /></div>
              <div className="insight-stat-val">{recap.totalSessions}</div>
              <div className="insight-stat-label">sessions</div>
            </div>
            <div className="insight-stat">
              <div className="insight-stat-ico"><Clock size={16} /></div>
              <div className="insight-stat-val">{recap.totalHrs}<span>h</span></div>
              <div className="insight-stat-label">contact time</div>
            </div>
            <div className="insight-stat">
              <div className="insight-stat-ico"><TrendingUp size={16} /></div>
              <div className="insight-stat-val">{recap.busiest ? recap.busiest.day.slice(0, 3) : "—"}</div>
              <div className="insight-stat-label">busiest day</div>
            </div>
            <div className="insight-stat">
              <div className="insight-stat-ico"><PieChart size={16} /></div>
              <div className="insight-stat-val">{recap.attendancePct != null ? `${recap.attendancePct}%` : "—"}</div>
              <div className="insight-stat-label">{recap.marked ? "attendance" : "unmarked"}</div>
            </div>
          </div>

          <div className="insights-card">
            <div className="insights-card-title"><CalendarDays size={14} /> Contact hours by day</div>
            <div className="insights-bars">
              {recap.perDay.map((d, i) => (
                <div className="insights-bar-col" key={i}>
                  <div className="insights-bar-track">
                    <div
                      className={`insights-bar-fill${i === peakIdx && d.hrs > 0 ? " is-peak" : ""}`}
                      style={{ height: `${Math.round((d.hrs / maxHrs) * 100)}%` }}
                      title={`${Math.round(d.hrs * 10) / 10}h`}
                    />
                  </div>
                  <span className="insights-bar-label">{DAY_LABELS[i]}</span>
                  <span className="insights-bar-hrs">{d.hrs ? Math.round(d.hrs) : ""}</span>
                </div>
              ))}
            </div>
          </div>

          {recap.areaList.length > 0 && (
            <div className="insights-card">
              <div className="insights-card-title"><PieChart size={14} /> Where your time goes</div>
              <div className="insights-areabar">
                {recap.areaList.map(([area, hrs], i) => (
                  <div
                    key={area}
                    className="insights-areabar-seg"
                    style={{ width: `${(hrs / areaTotal) * 100}%`, background: AREA_COLORS[i % AREA_COLORS.length] }}
                    title={`${area}: ${Math.round(hrs * 10) / 10}h`}
                  />
                ))}
              </div>
              <div className="insights-arealegend">
                {recap.areaList.map(([area, hrs], i) => (
                  <span className="insights-arealeg" key={area}>
                    <span className="insights-arealeg-dot" style={{ background: AREA_COLORS[i % AREA_COLORS.length] }} />
                    {area} · {Math.round((hrs / areaTotal) * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="insights-hilights">
            <div className="insights-hilight"><Sunrise size={15} /><div><strong>{fmtMin(recap.firstMin)}</strong><span>earliest start</span></div></div>
            <div className="insights-hilight"><Sunset size={15} /><div><strong>{fmtMin(recap.lastMin)}</strong><span>latest finish</span></div></div>
          </div>
        </>
      )}
    </div>
  );
}
