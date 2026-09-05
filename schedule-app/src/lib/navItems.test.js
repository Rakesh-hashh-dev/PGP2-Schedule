import { describe, it, expect } from "vitest";
import { NAV_GROUPS, NAV_ITEMS, itemsForGroup, MORE_VIEWS } from "./navItems.js";

const GROUP_IDS = NAV_GROUPS.map(g => g.id);

describe("NAV_ITEMS shape", () => {
  it("has unique ids", () => {
    const ids = NAV_ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never routes two rows to the same view", () => {
    const views = NAV_ITEMS.filter(i => i.view).map(i => i.view);
    expect(new Set(views).size).toBe(views.length);
  });

  it("gives every row a label and an icon component", () => {
    for (const item of NAV_ITEMS) {
      expect(item.label, item.id).toBeTruthy();
      expect(["function", "object"], item.id).toContain(typeof item.icon);
    }
  });

  // A row either navigates or opens a dialog. Both would be ambiguous; neither
  // would render a dead row.
  it("makes every row exactly one of navigating or action", () => {
    for (const item of NAV_ITEMS) {
      expect(Boolean(item.view) !== Boolean(item.action), item.id).toBe(true);
    }
  });

  it("puts every row in a declared group", () => {
    for (const item of NAV_ITEMS) {
      expect(GROUP_IDS, item.id).toContain(item.group);
    }
  });

  it("keeps rows of a group contiguous, since group order is render order", () => {
    const seen = [];
    for (const item of NAV_ITEMS) {
      if (seen[seen.length - 1] !== item.group) seen.push(item.group);
    }
    expect(seen).toEqual(seen.filter((g, i) => seen.indexOf(g) === i));
    expect(seen).toEqual(GROUP_IDS.filter(g => seen.includes(g)));
  });

  it("gives every badge a key and a label", () => {
    for (const item of NAV_ITEMS.filter(i => i.badge)) {
      expect(item.badge.key, item.id).toBeTruthy();
      expect(item.badge.label, item.id).toBeTruthy();
    }
  });
});

describe("itemsForGroup", () => {
  it("drops gated rows when their flag is off", () => {
    const off = itemsForGroup("track", {}).map(i => i.id);
    expect(off).toEqual(["assignments"]);
  });

  it("keeps gated rows when their flag is on", () => {
    const on = itemsForGroup("track", { enableAttendance: true, enableExams: true }).map(i => i.id);
    expect(on).toEqual(["attendance", "exams", "assignments"]);
  });

  it("returns ungated rows regardless of flags", () => {
    expect(itemsForGroup("schedule", {}).map(i => i.id))
      .toEqual(["today", "tomorrow", "fullSchedule"]);
  });

  it("is empty for an unknown group", () => {
    expect(itemsForGroup("nope", {})).toEqual([]);
  });

  it("covers every item across all declared groups", () => {
    const flags = { enableAttendance: true, enableExams: true, enableFriends: true, companionEnabled: true, wrappedActive: true };
    const total = GROUP_IDS.flatMap(g => itemsForGroup(g, flags));
    expect(total).toHaveLength(NAV_ITEMS.length);
  });
});

describe("nav structure decisions", () => {
  // The regroup: Full timetable is a schedule view, not an occasional tool,
  // and the mess menu is campus life. Both used to sit in the Tools drawer.
  it("puts Full timetable in Schedule and Mess menu in Campus", () => {
    expect(NAV_ITEMS.find(i => i.id === "fullSchedule").group).toBe("schedule");
    expect(NAV_ITEMS.find(i => i.id === "messMenu").group).toBe("campus");
  });

  // "Add to Calendar" used to be both a nav row and a util-strip button, both
  // calling openCalendarExport(). Only the util-strip button survives.
  it("has no calendar-export row", () => {
    expect(NAV_ITEMS.some(i => i.action === "openCalendarExport")).toBe(false);
  });

  it("leaves only occasional-use views behind the disclosure", () => {
    expect(MORE_VIEWS).toEqual(["split", "leave", "pet", "wrapped"]);
  });

  it("declares exactly one collapsible group", () => {
    expect(NAV_GROUPS.filter(g => g.collapsible)).toHaveLength(1);
  });
});
