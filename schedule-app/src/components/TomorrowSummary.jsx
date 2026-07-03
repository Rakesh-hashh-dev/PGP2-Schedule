import { MapPin, Bell, GraduationCap, Coffee, Sunset } from "lucide-react";
import { wIcon } from "./WeatherWidget.jsx";

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

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

export default function TomorrowSummary({ list, weather, changeCount, onViewChanges }) {
  const classes = list.filter((c) => c.type === "class");
  if (classes.length === 0) return null;

  const breaks = list.filter((c) => c.type === "break").length;
  const first = classes[0];
  const lastEnd = list.reduce((max, c) => (toMin(c.end) > toMin(max) ? c.end : max), list[0].end);

  const wx = weather?.tomorrow;
  const WxIcon = wx ? wIcon(wx.code).icon : null;

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
