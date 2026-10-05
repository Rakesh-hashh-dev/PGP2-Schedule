import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_CARDS, DASHBOARD_KEY, DEFAULT_DASHBOARD, dashboardCardVisible, moveDashboardCard, normalizeDashboardPrefs, readDashboardPrefs, saveDashboardPrefs } from "./dashboardPrefs.js";
import { TODAY_FOCUS_KEY } from "./todayEnhancements.js";

describe("Today dashboard preferences", () => {
  let values;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal("localStorage", { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps old choices while defaulting new widgets", () => {
    values.set(DASHBOARD_KEY, JSON.stringify({ density: "compact", visible: { summary: false, todayCommand: false }, weekPanel: false }));
    expect(readDashboardPrefs()).toMatchObject({ density: "compact", visible: { summary: false, todayCommand: false, mess: true, upcoming: true, weather: true, deadlines: false }, weekPanel: false });
  });

  it("deduplicates stored order and restores missing cards", () => {
    const prefs = normalizeDashboardPrefs({ order: ["mess", "mess", "unknown", "timeline"] });
    expect(prefs.order.slice(0, 2)).toEqual(["mess", "timeline"]);
    expect(new Set(prefs.order)).toEqual(new Set(DASHBOARD_CARDS.map((card) => card.id)));
  });

  it("moves cards without changing the original and respects boundaries", () => {
    const moved = moveDashboardCard(DEFAULT_DASHBOARD, "timeline", -1);
    expect(moved.order.slice(0, 3)).toEqual(["upcoming", "timeline", "summary"]);
    expect(DEFAULT_DASHBOARD.order.slice(0, 3)).toEqual(["upcoming", "summary", "timeline"]);
    expect(moveDashboardCard(DEFAULT_DASHBOARD, "upcoming", -1).order).toEqual(DEFAULT_DASHBOARD.order);
    expect(moveDashboardCard(DEFAULT_DASHBOARD, "deadlines", 1).order).toEqual(DEFAULT_DASHBOARD.order);
  });

  it("Focus shows classes and deadlines without overwriting saved visibility", () => {
    const prefs = normalizeDashboardPrefs({ visible: { upcoming: false, mess: true }, focusMode: true });
    expect(DASHBOARD_CARDS.filter(({ id }) => dashboardCardVisible(prefs, id)).map(({ id }) => id)).toEqual(["upcoming", "timeline", "deadlines"]);
    expect(dashboardCardVisible(prefs, "weather")).toBe(false);
    expect(prefs.visible.mess).toBe(true);
    expect(dashboardCardVisible({ ...prefs, focusMode: false }, "upcoming")).toBe(false);
    expect(dashboardCardVisible({ ...prefs, focusMode: false }, "mess")).toBe(true);
  });

  it("persists order and preset across reloads and resets every choice", () => {
    const custom = moveDashboardCard(normalizeDashboardPrefs({ density: "compact", focusMode: true, visible: { mess: false, weather: false }, weekPanel: false }), "mess", -1);
    saveDashboardPrefs(custom);
    expect(readDashboardPrefs()).toEqual(custom);
    expect(values.get(TODAY_FOCUS_KEY)).toBe("1");
    saveDashboardPrefs(normalizeDashboardPrefs(null));
    expect(readDashboardPrefs()).toEqual(DEFAULT_DASHBOARD);
    expect(values.get(TODAY_FOCUS_KEY)).toBe("0");
  });

  it("migrates the existing Focus control and handles corrupt or blocked storage", () => {
    values.set(TODAY_FOCUS_KEY, "1");
    expect(readDashboardPrefs().focusMode).toBe(true);
    values.set(DASHBOARD_KEY, "bad json");
    expect(readDashboardPrefs()).toEqual(DEFAULT_DASHBOARD);
    vi.stubGlobal("localStorage", { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } });
    expect(readDashboardPrefs()).toEqual(DEFAULT_DASHBOARD);
    expect(() => saveDashboardPrefs(DEFAULT_DASHBOARD)).not.toThrow();
  });
});
