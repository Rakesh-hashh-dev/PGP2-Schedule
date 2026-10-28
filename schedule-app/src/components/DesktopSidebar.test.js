import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import DesktopSidebar from "./DesktopSidebar.jsx";

const noop = () => { };

function render(overrides = {}) {
  const props = {
    sbCollapsed: false, sbStyle: "classic", specialDay: null, termLabel: "Term V",
    termProgressPct: null, termWeekInfo: null, termSwitcherEl: null,
    isOffline: false, setCmdOpen: noop, isMac: false, view: "today",
    showSbTip: noop, hideSbTip: noop, setView: noop, setCompareTarget: noop,
    enableAttendance: true, enableExams: true, unreadChangeCount: 0,
    enableFriends: true, markGroupsSeen: noop, markBadgeSeen: noop,
    showBadge: () => false, unreadFriendCount: 0,
    showSbTools: true, wrappedActive: true, companionEnabled: true,
    setSbToolsOpen: noop, setMessMenuOpen: noop, activeQuickLinks: [],
    showAdminUI: false, renderSbUtilStrip: () => null, renderSbAvatarWrap: () => null,
    syncing: false, syncedAgo: 0, isTablet: false, sidebarCollapsed: false,
    toggleSidebar: noop,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(DesktopSidebar, props));
}

/** Visible row labels, in render order. */
function labels(html) {
  return [...html.matchAll(/class="sb-link[^"]*"[^>]*>.*?<span class="sb-link-label">([^<]*)<\/span>/g)]
    .map(m => m[1]);
}

/** Group headings, in render order. */
function groups(html) {
  return [...html.matchAll(/<div class="sb-nav-label">([^<]*)<\/div>|<span class="sb-nav-label">([^<]*)<\/span>/g)]
    .map(m => m[1] ?? m[2]);
}

describe("DesktopSidebar nav", () => {
  it("keeps tablet navigation compact without offering a desktop expand control", () => {
    const tablet = render({ isTablet: true, sbCollapsed: true });
    expect(tablet).toContain('class="sidebar collapsed"');
    expect(tablet).not.toContain('aria-label="Toggle sidebar"');
    expect(render()).toContain('aria-label="Toggle sidebar"');
  });

  it("offers the tablet drawer control independently of the selected UI version", () => {
    const rail = render({ isTablet: true, tabletControls: true, sbCollapsed: true });
    expect(rail).toContain('aria-label="Expand sidebar"');
    expect(rail).toContain('aria-controls="termflow-sidebar"');
    const drawer = render({ isTablet: true, tabletControls: true, tabletSidebarOpen: true });
    expect(drawer).toContain('aria-label="Collapse sidebar"');
    expect(drawer).toContain('role="dialog" aria-modal="true"');
    expect(labels(drawer)).toContain("Attendance");
    expect(labels(drawer)).toContain("Split");
  });

  it("renders the groups in order", () => {
    expect(groups(render())).toEqual(["Schedule", "Track", "Campus", "More"]);
  });

  it("renders pinned items at the top ahead of standard groups", () => {
    const originalLocalStorage = globalThis.localStorage;
    const store = { "pgp2.sidebar-pins": JSON.stringify(["split", "attendance"]) };
    globalThis.localStorage = {
      getItem: key => store[key] ?? null,
      setItem: (key, val) => { store[key] = String(val); },
      removeItem: key => { delete store[key]; },
    };
    try {
      const html = render();
      expect(groups(html)).toEqual(["Pinned", "Schedule", "Track", "Campus", "More"]);
      expect(labels(html).slice(0, 2)).toEqual(["Split", "Attendance"]);
    } finally {
      globalThis.localStorage = originalLocalStorage;
    }
  });

  it("renders every row in order", () => {
    expect(labels(render())).toEqual([
      "Today", "Tomorrow", "Full timetable", "Courses", "Planner",
      "Attendance", "Exams", "Assignments",
      "Announcements", "Social", "Campus Board", "Mess menu",
      "Split", "Companion", "Term Wrapped",
    ]);
  });

  it("hides the collapsible group's rows when it is closed", () => {
    const html = render({ showSbTools: false });
    expect(groups(html)).toContain("More");
    expect(labels(html)).not.toContain("Split");
    expect(labels(html)).toContain("Today");
  });

  it("drops rows whose feature flag is off", () => {
    const html = render({ enableAttendance: false, enableExams: false, enableFriends: false, companionEnabled: false, wrappedActive: false });
    expect(labels(html)).toEqual([
      "Today", "Tomorrow", "Full timetable", "Courses", "Planner", "Assignments",
      "Announcements", "Campus Board", "Mess menu",
      "Split",
    ]);
  });

  it("marks only the active view", () => {
    const html = render({ view: "split" });
    expect(html.match(/class="sb-link on"/g)).toHaveLength(1);
    expect(html).toContain('aria-current="page"');
  });

  it("shows unread counters, capped at 9+", () => {
    expect(render({ unreadChangeCount: 3 })).toContain('<span class="nav-badge">3</span>');
    expect(render({ unreadFriendCount: 42 })).toContain('<span class="nav-badge">9+</span>');
    expect(render()).not.toContain("nav-badge");
  });

  it("shows a badge only while it is unseen", () => {
    expect(render({ showBadge: () => true })).toContain('<span class="beta-badge">Beta</span>');
    expect(render({ showBadge: () => false })).not.toContain("beta-badge");
  });

  it("uses a class for the offline banner, not inline styles", () => {
    const html = render({ isOffline: true });
    expect(html).toContain('class="sb-offline"');
    expect(html).not.toContain("rgba(231, 76, 60");
  });
});

// The aurora skin staggers entrances with
// `.sidebar.sb-aurora .sb-nav > *:nth-child(n)`. A wrapper element around any
// group would shift every following row onto the wrong delay — or off the end
// of the 12 declared steps.
describe("aurora entrance cascade", () => {
  it("keeps every nav row a direct child of .sb-nav", () => {
    const html = render();
    const nav = html.slice(html.indexOf('<nav class="sb-nav">') + 20, html.indexOf("</nav>"));
    const depth0 = [];
    let depth = 0;
    for (const m of nav.matchAll(/<(\/?)(\w+)([^>]*)>/g)) {
      const [, close, tag, attrs] = m;
      if (close) { depth--; continue; }
      if (depth === 0) depth0.push({ tag, attrs });
      if (!attrs.endsWith("/") && !["img", "br", "input"].includes(tag)) depth++;
    }
    // Search pill, 4 group headings, 15 rows — and nothing else.
    expect(depth0).toHaveLength(20);
    for (const el of depth0) {
      expect(["button", "div"]).toContain(el.tag);
    }
  });
});

