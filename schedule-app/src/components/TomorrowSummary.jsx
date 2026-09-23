import { useEffect, useRef, useState } from "react";
import { MapPin, Bell, GraduationCap, Coffee, Sunset, Clock, Calendar, Utensils, CheckSquare, ArrowRight } from "lucide-react";
import { wIcon } from "../lib/weather.js";
import { subjectClass } from "../lib/subjectColors.js";
import { fmtTime12 } from "../lib/datetime.js";
import FreeDayIllustration from "./FreeDayIllustration.jsx";
import "../styles/freeday.css";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmtDuration(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatNextClassDate(isoStr) {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

function formatTmrwKicker(isoStr) {
  if (!isoStr) return "Tomorrow · Free Day";
  const [y, m, d] = isoStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dayName = dt.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  return `Tomorrow · ${dayName}`;
}

function wxLabel(code) {
  if (code == null) return "";
  if (code === 0) return "Clear skies";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Misty / Fog";
  if (code <= 55) return "Light drizzle";
  if (code <= 82) return "Rain showers";
  return "Thunderstorms";
}

function Stat({ icon: Icon, tone, label, value }) {
  return (
    <div className="tmrw-stat">
      <div className={`tmrw-stat-badge tmrw-stat-badge-${tone}`}><Icon size={14} /></div>
      <div className="tmrw-stat-text">
        <span className="tmrw-stat-value">{value}</span>
        <span className="tmrw-stat-label">{label}</span>
      </div>
    </div>
  );
}

// Segments are tap-to-reveal (title tooltips never fire on touch). A
// floating popover was tried first, but on a short mobile card there's no
// direction it can open without colliding with something — the header
// above, or unrelated content below the card. Selecting a segment instead
// shows its details in one inline strip that lives in the card's own flow
// (see MealDetailStrip below it), so it can never overlap anything.
function RailSeg({ c, left, width, isLast, isOpen, onToggle }) {
  const isClass = c.type === "class";
  const colorClass = isClass ? subjectClass(c.code) : "";
  const fullLabel = c.name || (isClass ? "Class" : "Break");

  return (
    <button
      type="button"
      className={`tmrw-rail-seg tmrw-rail-seg-${c.type} ${colorClass}${isOpen ? " is-open" : ""}`}
      style={{ left: `${left}%`, width: `${width}%`, borderRight: isLast ? "none" : "1.5px solid var(--card)" }}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={`${fullLabel}, ${fmtTime12(c.start)} to ${fmtTime12(c.end)}${c.room ? `, room ${c.room}` : ""}`}
      aria-expanded={isOpen}
    />
  );
}

function RailDetailStrip({ c }) {
  const isClass = c.type === "class";
  const colorClass = isClass ? subjectClass(c.code) : "";
  const fullLabel = c.name || (isClass ? "Class" : "Break");
  const shortLabel = isClass ? (c.code || fullLabel) : "Break";
  const duration = fmtDuration(toMin(c.end) - toMin(c.start));

  return (
    <div className={`tmrw-rail-detail ${colorClass}`} style={isClass ? undefined : { "--subj": "var(--amber)" }}>
      <div className="tmrw-rail-detail-top">
        <span className="tmrw-rail-detail-dot" />
        <span className="tmrw-rail-detail-code">
          {shortLabel}{isClass && c.session && <span className="tmrw-rail-detail-session"> · Session {c.session}</span>}
        </span>
      </div>
      {isClass && fullLabel !== shortLabel && (
        <div className="tmrw-rail-detail-name">{fullLabel}</div>
      )}
      <div className="tmrw-rail-detail-sep" />
      <div className="tmrw-rail-detail-row">
        <span className="tmrw-rail-detail-item"><Clock size={12} />{fmtTime12(c.start)} – {fmtTime12(c.end)}</span>
        <span className="tmrw-rail-detail-chip">{duration}</span>
      </div>
      {c.room && (
        <div className="tmrw-rail-detail-row">
          <span className="tmrw-rail-detail-item"><MapPin size={12} />{c.room}</span>
        </div>
      )}
    </div>
  );
}

export default function TomorrowSummary({
  list,
  weather,
  changeCount,
  onViewChanges,
  tomorrowISO,
  nextClass,
  onOpenMess,
  onOpenAssignments,
  onViewFullSchedule
}) {
  const classes = list.filter((c) => c.type === "class");
  const wx = weather?.tomorrow;
  const WxIcon = wx ? wIcon(wx.code).icon : null;
  const [openSeg, setOpenSeg] = useState(null);
  const railRef = useRef(null);

  useEffect(() => {
    if (openSeg === null) return;
    const close = () => setOpenSeg(null);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [openSeg]);

  if (classes.length === 0) {
    const hour = new Date().getHours();
    const night = hour >= 19 || hour < 6;
    // Same WMO-code buckets as wIcon(): 0-1 clear, 2-48 cloud/fog, 51+ precip, 95+ storm
    const code = wx?.code;
    const wxKind = code == null || code <= 1 ? "clear" : code <= 48 ? "cloudy" : code < 95 ? "rain" : "storm";
    const conditionText = wxLabel(code);
    const sub = wxKind === "storm"
      ? "Storms outside — perfect excuse to stay in"
      : wxKind === "rain"
        ? "Rain's on the way — cozy day in"
        : wxKind === "cloudy"
          ? "Overcast & breezy — great time to recharge"
          : night
            ? "Sleep in tomorrow — no morning alarm"
            : "Clear skies ahead — the whole day is yours";

    const kickerText = formatTmrwKicker(tomorrowISO);

    return (
      <div className="tmrw-summary">
        <div className={`tmrw-summary-card tmrw-free-card theme-${wxKind} ${night ? 'tmrw-free-night' : ''}`}>
          <div className="tmrw-free-head">
            <span className="tmrw-free-kicker-pill">
              <span className="tmrw-free-kicker-dot" />
              {kickerText}
            </span>
            {wx && (
              <span className="tmrw-free-wx-pill">
                {WxIcon && <WxIcon size={13} style={{ color: wIcon(wx.code).color }} />}
                <span>{wx.min}°–{wx.max}°C</span>
                {conditionText && <span style={{ opacity: 0.7 }}>· {conditionText}</span>}
              </span>
            )}
          </div>

          <div className="tmrw-free-scene" aria-hidden="true">
            <FreeDayIllustration kind={wxKind} isNight={night} />
          </div>

          <div className="tmrw-free-text">
            <div className="tmrw-free-title">No classes tomorrow</div>
            <div className="tmrw-free-sub">{sub}</div>
          </div>

          {nextClass && (
            <div
              className="tmrw-free-next-wrap"
              role="button"
              tabIndex={0}
              onClick={() => onViewFullSchedule?.(nextClass.date)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onViewFullSchedule?.(nextClass.date);
                }
              }}
              aria-label={`Next class resumes ${formatNextClassDate(nextClass.date)} at ${fmtTime12(nextClass.start)}, ${nextClass.name}. View timetable.`}
            >
              <div className="tmrw-free-next-left">
                <div className="tmrw-free-next-icon">
                  <Clock size={16} />
                </div>
                <div className="tmrw-free-next-info">
                  <span className="tmrw-free-next-kicker">
                    Classes resume {formatNextClassDate(nextClass.date)} · {fmtTime12(nextClass.start)}
                  </span>
                  <span className="tmrw-free-next-course">
                    {nextClass.code ? `${nextClass.code} · ` : ""}{nextClass.name}{nextClass.room ? ` (${nextClass.room})` : ""}
                  </span>
                </div>
              </div>
              <ArrowRight size={15} className="tmrw-free-next-arrow" />
            </div>
          )}

          <div className="tmrw-free-actions">
            {onOpenMess && (
              <button type="button" className="tmrw-free-btn" onClick={onOpenMess}>
                <Utensils size={13} />
                Mess Menu
              </button>
            )}
            {onOpenAssignments && (
              <button type="button" className="tmrw-free-btn" onClick={onOpenAssignments}>
                <CheckSquare size={13} />
                Tasks & Deadlines
              </button>
            )}
            {onViewFullSchedule && (
              <button type="button" className="tmrw-free-btn" onClick={() => onViewFullSchedule()}>
                <Calendar size={13} />
                Full Timetable
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const first = classes[0];
  const lastEnd = classes.reduce((max, c) => (toMin(c.end) > toMin(max) ? c.end : max), first.end);

  const dayStart = toMin(first.start);
  const dayEnd = toMin(lastEnd);
  const daySpan = dayEnd - dayStart;

  // Only count breaks that happen during class hours
  const breaks = list.filter(
    (c) => c.type === "break" && toMin(c.start) >= dayStart && toMin(c.end) <= dayEnd
  ).length;

  const railItems = daySpan > 0
    ? list.filter((c) => {
        if (c.type !== "class" && c.type !== "break") return false;
        const s = toMin(c.start);
        const e = toMin(c.end);
        return e > dayStart && s < dayEnd;
      })
    : [];

  return (
    <div className="tmrw-summary">
      <div className="tmrw-summary-card">
        <div className="tmrw-summary-head">
          <span className="tmrw-summary-kicker">Tomorrow at a glance</span>
          {wx && (
            <span className="tmrw-summary-wx">
              {WxIcon && <WxIcon size={14} style={{ color: wIcon(wx.code).color }} />}
              {wx.min}°–{wx.max}°C
            </span>
          )}
        </div>
        <div className="tmrw-summary-grid">
          <Stat icon={GraduationCap} tone="violet" label={classes.length === 1 ? "class" : "classes"} value={classes.length} />
          {breaks > 0 && <Stat icon={Coffee} tone="amber" label={breaks === 1 ? "break" : "breaks"} value={breaks} />}
          <Stat icon={MapPin} tone="teal" label={`first · ${first.room || "TBA"}`} value={fmtTime12(first.start)} />
          <Stat icon={Sunset} tone="blue" label="free after" value={lastEnd} />
        </div>
        {railItems.length > 0 && (
          <>
            <div className="tmrw-rail" ref={railRef}>
              {railItems.map((c, i) => {
                const s = Math.max(dayStart, toMin(c.start));
                const e = Math.min(dayEnd, toMin(c.end));
                const left = Math.max(0, Math.min(100, ((s - dayStart) / daySpan) * 100));
                const width = Math.max(0, Math.min(100 - left, ((e - s) / daySpan) * 100));
                return (
                  <RailSeg
                    key={i}
                    c={c}
                    left={left}
                    width={width}
                    isLast={i === railItems.length - 1}
                    isOpen={openSeg === i}
                    onToggle={() => setOpenSeg((s) => (s === i ? null : i))}
                  />
                );
              })}
            </div>
            <div className="tmrw-rail-labels" aria-hidden="true">
              <span>{fmtTime12(first.start)}</span>
              <span>{lastEnd}</span>
            </div>
            {openSeg !== null && railItems[openSeg] && <RailDetailStrip c={railItems[openSeg]} />}
          </>
        )}
      </div>
      {changeCount > 0 && (
        <button type="button" className="tmrw-summary-changes" onClick={onViewChanges}>
          <Bell size={13} />
          {changeCount} schedule update{changeCount > 1 ? "s" : ""} for tomorrow's classes
        </button>
      )}
    </div>
  );
}
