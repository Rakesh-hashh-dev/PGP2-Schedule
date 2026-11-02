import { getControls } from '../lib/appControls.js';
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, CalendarClock, ChartNoAxesCombined, Check, CloudOff, CloudSun, Focus, LayoutDashboard, RefreshCw, RotateCcw, Settings2, UtensilsCrossed, X } from "lucide-react";
import { DASHBOARD_CARDS, dashboardCardVisible, moveDashboardCard, normalizeDashboardPrefs } from "../lib/dashboardPrefs.js";
import "../styles/premium-workflow.css";
import { useBackClose } from "../lib/backClose.js";

export function DashboardCustomize({ prefs, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const sheetMode = compact;
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();
  const layout = normalizeDashboardPrefs(prefs);
  const update = (patch) => onChange({ ...prefs, ...patch });
  const moveCard = (id, direction) => {
    const next = moveDashboardCard(layout, id, direction);
    onChange(next);
    setAnnouncement(`${DASHBOARD_CARDS.find((card) => card.id === id).label} moved to position ${next.order.indexOf(id) + 1}.`);
  };
  const settings = [
    { id: "upcoming", label: "Class overview", description: "Current class, next class and today's status.", Icon: CalendarDays },
    { id: "summary", label: "Semester summary", description: "Attendance, credits and sessions.", Icon: ChartNoAxesCombined },
    { id: "mess", label: "Mess menu", description: "Today's meals and serving times.", Icon: UtensilsCrossed },
    { id: "todayCommand", label: "Today Command", description: "Your tasks and upcoming deadlines.", Icon: LayoutDashboard },
    { id: "deadlines", label: "Upcoming deadlines", description: "Exams and assignments in the next 7 days.", Icon: CalendarClock },
    { id: "weather", label: "Weather & clock", description: "The chip beside Customize on Today.", Icon: CloudSun },
  ];
  const close = useCallback(() => {
    panelRef.current?.close?.();
    setOpen(false);
    toggleRef.current?.focus();
  }, []);
  useBackClose(close, open);
  const toggle = () => {
    setOpen((value) => !value);
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    if (sheetMode) {
      panelRef.current.showModal();
      document.body.style.overflow = "hidden";
    }
    const dismissOutside = (event) => {
      if (!sheetMode && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const dismissEscape = (event) => {
      if (!sheetMode && event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      if (sheetMode) document.body.style.overflow = previousOverflow;
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open, sheetMode, close]);

  const Panel = sheetMode ? "dialog" : "div";
  return <div className="dashboard-customize" ref={rootRef}>
    <button ref={toggleRef} type="button" className="dashboard-customize-toggle vdh-filter-btn" aria-label="Customize today layout" aria-haspopup="dialog" aria-controls={open ? panelId : undefined} aria-expanded={open} onClick={toggle}><Settings2 size={14} /><span className="dashboard-cust-label"> Customize</span></button>
    {open && <Panel ref={panelRef} id={panelId} className="dashboard-customize-panel" role="dialog" aria-labelledby={`${panelId}-title`} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => {
      if (!sheetMode || event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}>
      <div className="dashboard-customize-head">
        <span className="dashboard-customize-icon"><LayoutDashboard size={16} /></span>
        <div><h2 id={`${panelId}-title`}>Make Today yours</h2><p>Choose what shows on Today.</p></div>
        <button type="button" onClick={close} aria-label="Close dashboard settings"><X size={16} /></button>
      </div>
      {/* Compact segmented rows: label left, two-option pill switch right. The
          option descriptions moved into title tooltips to keep each row one line. */}
      <fieldset className="dashboard-density"><legend>Layout</legend>
        <div className="dashboard-density-options">
          {[false, true].map((focusMode) => <label key={String(focusMode)} title={focusMode ? "Only classes & deadlines" : "Your saved choices"} className={`dashboard-density-option${layout.focusMode === focusMode ? " is-selected" : ""}`}>
            <input type="radio" name={`${panelId}-preset`} checked={layout.focusMode === focusMode} onChange={() => update({ focusMode })} />
            <strong>{focusMode ? "Focus" : "My layout"}</strong>
          </label>)}
        </div>
      </fieldset>
      {layout.focusMode && <p className="dashboard-customize-hint"><Focus size={13} />Exit Focus to edit visibility. Your saved choices will return.</p>}
      <fieldset className="dashboard-density"><legend>Spacing</legend>
        <div className="dashboard-density-options">
          {["comfortable", "compact"].map((density) => <label key={density} title={density === "comfortable" ? "More breathing room" : "Cards closer together"} className={`dashboard-density-option${prefs.density === density ? " is-selected" : ""}`}>
            <input type="radio" name={`${panelId}-density`} value={density} checked={prefs.density === density} onChange={() => update({ density })} />
            <strong>{density === "comfortable" ? "Comfortable" : "Compact"}</strong>
          </label>)}
        </div>
      </fieldset>
      <fieldset className="dashboard-visibility" disabled={layout.focusMode}><legend className="dashboard-customize-section">Visible on Today</legend>
        {settings.map(({ id, label, description, Icon }) => <label key={id} className="dashboard-setting" title={description}><Icon size={16} /><span><strong>{label}</strong></span><input type="checkbox" role="switch" aria-label={label} checked={dashboardCardVisible(layout, id)} onChange={(event) => update({ visible: { ...layout.visible, [id]: event.target.checked } })} /><span className="dashboard-setting-switch" aria-hidden="true" /></label>)}
      </fieldset>
      <details className="dashboard-card-order"><summary>Card order</summary><p className="dashboard-customize-hint">Classes stay visible. Hidden cards keep their position.</p>
        <ol>{layout.order.map((id, index) => {
          const label = DASHBOARD_CARDS.find((card) => card.id === id).label;
          return <li key={id}><span className="dashboard-order-number">{index + 1}</span><span className="dashboard-order-label">{label}{!dashboardCardVisible(layout, id) && <small>Hidden</small>}</span><button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => moveCard(id, -1)}><ArrowUp size={14} /></button><button type="button" aria-label={`Move ${label} down`} disabled={index === layout.order.length - 1} onClick={() => moveCard(id, 1)}><ArrowDown size={14} /></button></li>;
        })}</ol>
      </details>
      <div className="dashboard-customize-section">Wide-screen layout</div>
      <label className="dashboard-setting" title="Show the week beside Today on wider screens."><CalendarDays size={16} /><span><strong>Week panel</strong></span><input type="checkbox" role="switch" aria-label="Week panel" checked={!layout.focusMode && layout.weekPanel} disabled={layout.focusMode} onChange={(event) => update({ weekPanel: event.target.checked })} /><span className="dashboard-setting-switch" aria-hidden="true" /></label>
      <span className="dashboard-announcement" role="status">{announcement}</span>
      <div className="dashboard-customize-foot">
        <span><Check size={13} /> Saves automatically</span>
        <button type="button" className="dashboard-reset" onClick={() => { onChange(normalizeDashboardPrefs(getControls().payload.dashboard)); setAnnouncement("Institute default layout restored."); }}><RotateCcw size={13} />Reset</button>
      </div>
    </Panel>}
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
