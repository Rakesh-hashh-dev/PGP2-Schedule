import { useState } from "react";
import { CloudOff, RefreshCw, Settings2 } from "lucide-react";
import "../styles/premium-workflow.css";

export function DashboardCustomize({ prefs, onChange }) {
  const [open, setOpen] = useState(false);
  const update = (patch) => onChange({ ...prefs, ...patch });
  return <div className="dashboard-customize">
    <button type="button" className="dashboard-customize-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Settings2 size={14} /> Customize</button>
    {open && <div className="dashboard-customize-panel"><div className="dashboard-customize-head"><strong>Today layout</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close dashboard settings">×</button></div>
      <label className="dashboard-density">Density <select value={prefs.density} onChange={(event) => update({ density: event.target.value })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
      <div className="dashboard-customize-row"><label><input type="checkbox" checked={prefs.visible.summary} onChange={(event) => update({ visible: { ...prefs.visible, summary: event.target.checked } })} />Semester summary</label></div>
      <div className="dashboard-customize-row"><label><input type="checkbox" checked={prefs.visible.todayCommand !== false} onChange={(event) => update({ visible: { ...prefs.visible, todayCommand: event.target.checked } })} />Today Command</label></div>
      <label className="dashboard-week-toggle"><input type="checkbox" checked={prefs.weekPanel} onChange={(event) => update({ weekPanel: event.target.checked })} />Show week panel on laptop</label>
    </div>}
  </div>;
}

export function ScheduleStatus({ source, isOffline, syncing, syncedAt, error, onRetry }) {
  const needsAttention = isOffline || source !== "live" || Boolean(error);
  if (!needsAttention && !syncing) return null;
  return <div className={`schedule-status${error ? " is-error" : ""}`} role="status">
    {isOffline ? <CloudOff size={16} /> : <RefreshCw size={16} className={syncing ? "spin-icon" : ""} />}
    <span><strong>{isOffline ? "Offline schedule" : error ? "Refresh failed" : syncing ? "Checking schedule" : "Using saved schedule"}</strong><small>{error || (source === "live" && syncedAt ? `Last live refresh ${syncedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Live updates will appear after a successful refresh.")}</small></span>
    {!isOffline && !syncing && <button type="button" onClick={onRetry}>Retry</button>}
  </div>;
}
