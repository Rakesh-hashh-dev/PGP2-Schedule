import { useEffect, useRef, useState } from "react";
import { MapPin, Bell, GraduationCap, Coffee, Sunset, Clock } from "lucide-react";
import { wIcon } from "../lib/weather.js";
import { subjectClass } from "../lib/subjectColors.js";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmtDuration(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
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
      aria-label={`${fullLabel}, ${c.start} to ${c.end}${c.room ? `, room ${c.room}` : ""}`}
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
        <span className="tmrw-rail-detail-item"><Clock size={12} />{c.start} – {c.end}</span>
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

export default function TomorrowSummary({ list, weather, changeCount, onViewChanges }) {
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
    const raining = wxKind === "rain" || wxKind === "storm";
    const sub = wxKind === "storm"
      ? "Storms outside — perfect excuse to stay in"
      : wxKind === "rain"
        ? "Rain's on the way — cozy day in"
        : "Sleep in — the whole day is yours";
    // Storm reuses all the rain styling plus the lightning flash
    const skyClass = `tmrw-free-sky ${night ? "sky-night" : "sky-day"} sky-${raining ? "rain" : wxKind}`;

    return (
      <div className="tmrw-summary">
        <div className={`tmrw-summary-card tmrw-free-card ${night ? 'tmrw-free-night' : ''}`}>
          <div className="tmrw-summary-head">
            <span className="tmrw-summary-kicker">Tomorrow at a glance</span>
            {wx && (
              <span className="tmrw-summary-wx">
                {WxIcon && <WxIcon size={14} style={{ color: wIcon(wx.code).color }} />}
                {wx.min}°–{wx.max}°C
              </span>
            )}
          </div>
          <div className="tmrw-free-scene" aria-hidden="true">
            <div className={skyClass}>
              {!night && wxKind === "clear" && <span className="tmrw-free-rays" />}
              {night ? <span className="tmrw-free-moon" /> : <span className="tmrw-free-sun" />}
              <span className="tmrw-free-cloud c1" />
              <span className="tmrw-free-cloud c2" />
              {wxKind !== "clear" && <span className="tmrw-free-cloud c3" />}
              {raining && (
                <>
                  <span className="tmrw-free-drop d1" />
                  <span className="tmrw-free-drop d2" />
                  <span className="tmrw-free-drop d3" />
                  <span className="tmrw-free-drop d4" />
                </>
              )}
              {night && !raining && <span className="tmrw-free-shoot" />}
              {wxKind === "storm" && <span className="tmrw-free-flash" />}
              <span className="tmrw-free-spark s1" />
              <span className="tmrw-free-spark s2" />
              <span className="tmrw-free-spark s3" />
            </div>
          </div>
          <div className="tmrw-free-text">
            <div className="tmrw-free-title">No classes tomorrow</div>
            <div className="tmrw-free-sub">{sub}</div>
          </div>
        </div>
      </div>
    );
  }

  const breaks = list.filter((c) => c.type === "break").length;
  const first = classes[0];
  const lastEnd = list.reduce((max, c) => (toMin(c.end) > toMin(max) ? c.end : max), list[0].end);

  const dayStart = toMin(first.start);
  const daySpan = toMin(lastEnd) - dayStart;
  const railItems = daySpan > 0 ? list.filter((c) => c.type === "class" || c.type === "break") : [];

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
          <Stat icon={MapPin} tone="teal" label={`first · ${first.room || "TBA"}`} value={first.start} />
          <Stat icon={Sunset} tone="blue" label="free after" value={lastEnd} />
        </div>
        {railItems.length > 0 && (
          <>
            <div className="tmrw-rail" ref={railRef}>
              {railItems.map((c, i) => {
                const left = ((toMin(c.start) - dayStart) / daySpan) * 100;
                const width = ((toMin(c.end) - toMin(c.start)) / daySpan) * 100;
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
              <span>{first.start}</span>
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
