export const DASHBOARD_KEY = "pgp2.dashboard-layout";
export const DEFAULT_DASHBOARD = {
  density: "comfortable",
  visible: { summary: true, todayCommand: true },
  weekPanel: true,
};

export function readDashboardPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(DASHBOARD_KEY) || "null");
    if (!saved || typeof saved !== "object") return DEFAULT_DASHBOARD;
    return {
      density: saved.density === "compact" ? "compact" : "comfortable",
      visible: {
        summary: saved.visible?.summary !== false,
        todayCommand: saved.visible?.todayCommand !== false,
      },
      weekPanel: saved.weekPanel !== false,
    };
  } catch { return DEFAULT_DASHBOARD; }
}

export function saveDashboardPrefs(prefs) {
  try { localStorage.setItem(DASHBOARD_KEY, JSON.stringify(prefs)); } catch { /* device storage may be unavailable */ }
}
