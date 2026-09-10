import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MobileV2MorePage from "./MobileV2MorePage.jsx";

const requiredProps = {
  user: { firstName: "Student" },
  unreadCount: 2,
  onNavigate: () => {},
  onOpenMess: () => {},
  onOpenCalendar: () => {},
  onFilter: () => {},
  onEditSetup: () => {},
  onWhatsNew: () => {},
  onFeedback: () => {},
  onOpenGuide: () => {},
  onSignOut: () => {},
};

describe("MobileV2MorePage", () => {
  it("keeps the core campus, tool, settings and account routes reachable", () => {
    const html = renderToStaticMarkup(<MobileV2MorePage {...requiredProps} />);
    for (const label of [
      "Announcements", "Campus Board", "Mess menu", "Full timetable",
      "Split expenses", "Leave planner", "Add to calendar", "Filter subjects",
      "Edit setup", "Submit feedback", "Sign out",
    ]) expect(html).toContain(label);
  });

  it("removes gated rows without leaving empty personal content", () => {
    const hidden = renderToStaticMarkup(
      <MobileV2MorePage {...requiredProps} enableFriends={false} enableCompanion={false} wrappedActive={false} showAdmin={false} />
    );
    for (const label of ["Social", "Companion", "Term Wrapped", "Admin tools", "Personal"]) expect(hidden).not.toContain(label);

    const visible = renderToStaticMarkup(
      <MobileV2MorePage {...requiredProps} enableFriends enableCompanion wrappedActive showAdmin />
    );
    for (const label of ["Social", "Companion", "Term Wrapped", "Admin tools", "Personal"]) expect(visible).toContain(label);
  });
});
