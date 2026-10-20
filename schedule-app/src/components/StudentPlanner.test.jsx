import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentPlanner from "./StudentPlanner.jsx";
import LeavePlanner from "./LeavePlanner.jsx";

const props = {
  now: new Date(2026, 9, 15, 9), attendance: {}, enrolled: { TEST: "A" },
  legend: { TEST: { name: "Test course" } },
  readChangeKeys: new Set(), changeKeyOf: () => "change", syncedAgo: 0,
  onNavigate: () => {}, onOpenChange: () => {}, onSectionChange: () => {},
};
beforeEach(() => vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} }));
afterEach(() => vi.unstubAllGlobals());

describe("integrated Planner", () => {
  it("keeps the existing planning sections under Schedule", () => {
    const html = renderToStaticMarkup(<StudentPlanner {...props} />);
    expect(html).toContain('id="planner-tab-schedule"');
    expect(html).toContain('aria-controls="planner-panel-schedule"');
    expect(html).toContain('aria-selected="true"');
    for (const label of ["Forecast", "Workload", "Calendar", "Insights", "Leave Planner"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain('id="lp-from"');
  });

  it("renders the existing Leave Planner inside its selected panel", () => {
    const html = renderToStaticMarkup(<StudentPlanner {...props} section="leave"
      leavePlanner={<LeavePlanner {...props} allClasses={[]} termEnd="2026-12-31" awayEnabled={false} />} />);
    expect(html).toContain('aria-labelledby="planner-tab-leave"');
    expect(html).toContain('id="lp-from"');
    expect(html).toContain('id="lp-to"');
    expect(html).not.toContain('aria-label="Back"');
    expect(html).not.toContain('aria-label="Schedule planning sections"');
  });
});
