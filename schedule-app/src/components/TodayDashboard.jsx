import { Focus } from "lucide-react";
import { dashboardCardVisible, normalizeDashboardPrefs } from "../lib/dashboardPrefs.js";
import "../styles/premium-workflow.css";

export default function TodayDashboard({ prefs, cards, onExitFocus }) {
  const layout = normalizeDashboardPrefs(prefs);
  return <div className={`today-dashboard${layout.density === "compact" ? " is-compact" : ""}`}>
    {layout.focusMode && <div className="dashboard-focus-banner"><Focus size={16} /><span>Focus · classes and deadlines</span><button type="button" onClick={onExitFocus}>Exit focus</button></div>}
    {layout.order.filter((id) => dashboardCardVisible(layout, id) && cards[id]).map((id) => <div key={id} className={`today-dashboard-card today-dashboard-${id}`} data-dashboard-card={id}>{cards[id]}</div>)}
  </div>;
}
