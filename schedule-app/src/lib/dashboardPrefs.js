import { TODAY_FOCUS_KEY } from "./todayEnhancements.js";

export const DASHBOARD_KEY = "pgp2.dashboard-layout";
export const DASHBOARD_CARDS = [
  { id: "upcoming", label: "Class overview" },
  { id: "summary", label: "Semester summary" },
  { id: "timeline", label: "Today's classes" },
  { id: "mess", label: "Mess menu" },
  { id: "todayCommand", label: "Today Command" },
  { id: "deadlines", label: "Upcoming deadlines" },
];
const CARD_IDS = DASHBOARD_CARDS.map((card) => card.id);
const FOCUS_CARDS = new Set(["upcoming", "timeline", "deadlines"]);
export const DEFAULT_DASHBOARD = {
  density: "comfortable",
  visible: { summary: true, todayCommand: true, upcoming: true, mess: true, weather: true, deadlines: false },
  weekPanel: true,
  order: CARD_IDS,
  focusMode: false,
};

export function normalizeDashboardPrefs(saved) {
  const value = saved && typeof saved === "object" ? saved : {};
  const requestedOrder = Array.isArray(value.order) ? value.order : [];
  const order = [...new Set([...requestedOrder.filter((id) => CARD_IDS.includes(id)), ...CARD_IDS])];
  return {
    density: value.density === "compact" ? "compact" : "comfortable",
    visible: Object.fromEntries(Object.entries(DEFAULT_DASHBOARD.visible).map(([id, fallback]) => [id, typeof value.visible?.[id] === "boolean" ? value.visible[id] : fallback])),
    weekPanel: value.weekPanel !== false,
    order,
    focusMode: value.focusMode === true,
  };
}

export function dashboardCardVisible(prefs, id) {
  if (prefs.focusMode) return FOCUS_CARDS.has(id);
  return id === "timeline" || prefs.visible[id] !== false;
}

export function moveDashboardCard(prefs, id, direction) {
  const next = normalizeDashboardPrefs(prefs);
  const index = next.order.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.order.length || ![-1, 1].includes(direction)) return next;
  [next.order[index], next.order[target]] = [next.order[target], next.order[index]];
  return next;
}

export function readDashboardPrefs(defaults = null) {
  try {
    const saved = JSON.parse(localStorage.getItem(DASHBOARD_KEY) || "null");
    const prefs = normalizeDashboardPrefs(saved || defaults);
    if (saved?.focusMode === undefined && prefs.visible.todayCommand) prefs.focusMode = localStorage.getItem(TODAY_FOCUS_KEY) === "1";
    return prefs;
  } catch { return normalizeDashboardPrefs(defaults); }
}

export function saveDashboardPrefs(prefs) {
  try {
    const normalized = normalizeDashboardPrefs(prefs);
    localStorage.setItem(DASHBOARD_KEY, JSON.stringify(normalized));
    localStorage.setItem(TODAY_FOCUS_KEY, normalized.focusMode ? "1" : "0");
  } catch { /* device storage may be unavailable */ }
}
