import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MobileV2TabBar from "./MobileV2TabBar.jsx";
import { activeMobileV2Destination } from "../../lib/mobileNav.js";

describe("MobileV2TabBar", () => {
  it("maps existing views into five stable destinations", () => {
    expect(activeMobileV2Destination("tomorrow", false, true)).toBe("today");
    expect(activeMobileV2Destination("fullSchedule", false, true)).toBe("schedule");
    expect(activeMobileV2Destination("exams", false, true)).toBe("tasks");
    expect(activeMobileV2Destination("friends", false, true)).toBe("more");
    expect(activeMobileV2Destination("today", true, true)).toBe("more");
  });

  it("renders five labeled targets with Attendance enabled", () => {
    const html = renderToStaticMarkup(
      <MobileV2TabBar view="today" attendanceEnabled onNavigate={() => {}} onOpenMore={() => {}} />
    );
    expect((html.match(/<button/g) || []).length).toBe(5);
    for (const label of ["Today", "Schedule", "Attend", "Tasks", "More"]) expect(html).toContain(label);
  });

  it("promotes Updates when Attendance is disabled", () => {
    const html = renderToStaticMarkup(
      <MobileV2TabBar view="notifications" attendanceEnabled={false} unreadCount={3} onNavigate={() => {}} onOpenMore={() => {}} />
    );
    expect(html).toContain("Updates");
    expect(html).toContain('aria-label="Updates, 3 unread"');
    expect(html).not.toContain("Attend</span>");
  });
});
