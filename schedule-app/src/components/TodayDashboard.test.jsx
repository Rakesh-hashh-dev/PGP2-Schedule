import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TodayDashboard from "./TodayDashboard.jsx";
import { normalizeDashboardPrefs } from "../lib/dashboardPrefs.js";

const cards = Object.fromEntries(["upcoming", "summary", "timeline", "mess", "todayCommand", "deadlines"].map((id) => [id, <section key={id}>{id}</section>]));

describe("Today dashboard rendering", () => {
  it("renders custom card order and hides disabled content", () => {
    const prefs = normalizeDashboardPrefs({ order: ["mess", "timeline"], visible: { summary: false } });
    const html = renderToStaticMarkup(<TodayDashboard prefs={prefs} cards={cards} />);
    expect(html.indexOf('data-dashboard-card="mess"')).toBeLessThan(html.indexOf('data-dashboard-card="timeline"'));
    expect(html).not.toContain('data-dashboard-card="summary"');
    expect(html).not.toContain('data-dashboard-card="deadlines"');
  });

  it("Focus exposes an exit and renders classes and deadlines even if hidden in the saved layout", () => {
    const prefs = normalizeDashboardPrefs({ focusMode: true, visible: { upcoming: false, deadlines: false } });
    const html = renderToStaticMarkup(<TodayDashboard prefs={prefs} cards={cards} />);
    for (const id of ["upcoming", "timeline", "deadlines"]) expect(html).toContain(`data-dashboard-card="${id}"`);
    for (const id of ["summary", "mess", "todayCommand"]) expect(html).not.toContain(`data-dashboard-card="${id}"`);
    expect(html).toContain("Exit focus");
  });
});
