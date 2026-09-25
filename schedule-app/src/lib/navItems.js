// Declarative config for the desktop sidebar's navigation.
//
// Before this file, DesktopSidebar.jsx hand-wrote 17 near-identical 4-line
// blocks, each repeating the same `showSbTip`/`hideSbTip` pair and the same
// `setView(v); setCompareTarget(null); hideSbTip()` body. The config below is
// the single source of truth for what is in the desktop nav; <SbLink> renders
// it.
//
// Scope note: the mobile overflow sheet still has its own hand-written list
// (and its own TOOLS_VIEWS/TOOLS_VIEW_META in App.jsx, which keep the older
// grouping on purpose). This config is deliberately DOM-agnostic so that sheet
// can be migrated onto it later, but nothing here touches mobile today.
import {
  Clock, Sunrise, CalendarRange, ClipboardCheck, GraduationCap, NotebookPen,
  Megaphone, Users, LayoutGrid, UtensilsCrossed, ReceiptText, PawPrint, CalendarMinus2,
  Sparkles, CalendarCheck2, BookOpen,
} from "lucide-react";

// Group order here IS the render order. `collapsible` marks the one group
// behind a disclosure; everything else is always visible.
export const NAV_GROUPS = [
  { id: "schedule", label: "Schedule" },
  { id: "track", label: "Track" },
  { id: "campus", label: "Campus" },
  { id: "more", label: "More", collapsible: true },
];

// Item fields:
//   id        stable key
//   group     one of NAV_GROUPS[].id
//   label     the visible row text
//   tip       hover tooltip; falls back to `label` when omitted
//   icon      component taking a numeric `size` prop
//   view      sets the app view — a NAVIGATING row
//   action    opens a dialog instead — an ACTION row
//             (`view` and `action` are mutually exclusive; asserted in tests)
//   gate      name of the feature flag that must be true for the row to exist
//   badge     { key, label } for the existing showBadge/markBadgeSeen pair
//   count     name of the unread counter that renders as a .nav-badge
//   effect    extra side effect to run on select, resolved by the renderer
export const NAV_ITEMS = [
  { id: "today", group: "schedule", label: "Today", icon: Clock, view: "today" },
  { id: "tomorrow", group: "schedule", label: "Tomorrow", icon: Sunrise, view: "tomorrow" },
  { id: "fullSchedule", group: "schedule", label: "Full timetable", icon: CalendarRange, view: "fullSchedule" },
  { id: "courseHub", group: "schedule", label: "Courses", icon: BookOpen, view: "courseHub" },
  { id: "planner", group: "schedule", label: "Planner", icon: CalendarCheck2, view: "planner", badge: { key: "planner", label: "New" } },

  { id: "attendance", group: "track", label: "Attendance", icon: ClipboardCheck, view: "attendance", gate: "enableAttendance" },
  { id: "exams", group: "track", label: "Exams", icon: GraduationCap, view: "exams", gate: "enableExams" },
  { id: "assignments", group: "track", label: "Assignments", icon: NotebookPen, view: "assignments" },

  { id: "notifications", group: "campus", label: "Announcements", icon: Megaphone, view: "notifications", count: "unreadChangeCount" },
  {
    id: "friends", group: "campus", label: "Social", icon: Users, view: "friends",
    gate: "enableFriends", badge: { key: "social", label: "Beta" },
    count: "unreadFriendCount", effect: "markGroupsSeen",
  },
  { id: "board", group: "campus", label: "Campus Board", icon: LayoutGrid, view: "board", badge: { key: "board", label: "New" } },
  { id: "messMenu", group: "campus", label: "Mess menu", icon: UtensilsCrossed, action: "openMessMenu" },

  { id: "split", group: "more", label: "Split", tip: "Split expenses", icon: ReceiptText, view: "split", badge: { key: "split", label: "New" } },
  { id: "leave", group: "more", label: "Leave planner", icon: CalendarMinus2, view: "leave" },
  { id: "pet", group: "more", label: "Companion", icon: PawPrint, view: "pet", gate: "companionEnabled", badge: { key: "pet", label: "New" } },
  { id: "wrapped", group: "more", label: "Term Wrapped", icon: Sparkles, view: "wrapped", gate: "wrappedActive" },
];

/** Items in `group`, minus any whose feature flag is off. */
export function itemsForGroup(groupId, flags = {}) {
  return NAV_ITEMS.filter(i => i.group === groupId && (!i.gate || Boolean(flags[i.gate])));
}

/** Views reachable from the collapsible group — used to keep it open on a tool page. */
export const MORE_VIEWS = NAV_ITEMS.filter(i => i.group === "more" && i.view).map(i => i.view);
