import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MobileV2TabBar from "./MobileV2TabBar.jsx";
import { activeMobileV2Destination } from "../../lib/mobileNav.js";

describe("MobileV2TabBar", () => {
  it("maps existing views into five stable destinations", () => {
    expect(activeMobileV2Destination("tomorrow", false, true)).toBe("today");
    expect(activeMobileV2Destination("fullSchedule", false, true)).toBe("schedule");
    expect(activeMobileV2Destination("planner", false, true)).toBe("more");
    expect(activeMobileV2Destination("assignments", false, true)).toBe("tasks");
    expect(activeMobileV2Destination("exams", false, true)).toBe("tasks");
    expect(activeMobileV2Destination("notifications", false, false)).toBe("more");
    expect(activeMobileV2Destination("friends", false, true)).toBe("more");
    expect(activeMobileV2Destination("today", true, true)).toBe("more");
  });

  it("renders five labeled targets with Attendance enabled", () => {
    const html = renderToStaticMarkup(
      <MobileV2TabBar view="today" attendanceEnabled onNavigate={() => {}} onOpenMore={() => {}} />
    );
    expect((html.match(/<button/g) || []).length).toBe(5);
    for (const label of ["Today", "Schedule", "Attend", "Tasks", "More"]) expect(html).toContain(label);
    expect(html).not.toContain('aria-label="Planner"');
  });

  it("keeps Tasks in four destinations when Attendance is disabled", () => {
    const html = renderToStaticMarkup(
      <MobileV2TabBar view="assignments" attendanceEnabled={false} onNavigate={() => {}} onOpenMore={() => {}} />
    );
    expect((html.match(/<button/g) || []).length).toBe(4);
    expect(html).toContain('aria-label="Tasks" aria-current="page"');
    expect(html).not.toContain("Updates");
    expect(html).not.toContain("Attend</span>");
  });
});
