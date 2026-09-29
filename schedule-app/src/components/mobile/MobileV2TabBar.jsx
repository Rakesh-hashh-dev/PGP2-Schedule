import { Bell, CalendarDays, CheckSquare2, ClipboardCheck, House, LayoutGrid } from "lucide-react";
import { activeMobileV2Destination } from "../../lib/mobileNav.js";

export default function MobileV2TabBar({
  view,
  moreOpen,
  attendanceEnabled,
  unreadCount = 0,
  onNavigate,
  onOpenMore,
}) {
  const active = activeMobileV2Destination(view, moreOpen, attendanceEnabled);
  const items = attendanceEnabled
    ? [
        ["today", "Today", House, "today"],
        ["schedule", "Schedule", CalendarDays, "week"],
        ["attendance", "Attend", ClipboardCheck, "attendance"],
        ["tasks", "Tasks", CheckSquare2, "assignments"],
        ["more", "More", LayoutGrid, null],
      ]
    : [
        ["today", "Today", House, "today"],
        ["schedule", "Schedule", CalendarDays, "week"],
        ["tasks", "Tasks", CheckSquare2, "assignments"],
        ["updates", "Updates", Bell, "notifications"],
        ["more", "More", LayoutGrid, null],
      ];

  return (
    <nav className="mobile-v2-tabbar" aria-label="V2 primary navigation">
      {items.map(([id, label, Icon, target]) => (
        <button
          type="button"
          key={id}
          className={active === id ? "is-active" : ""}
          aria-label={id === "updates" && unreadCount > 0 ? `${label}, ${unreadCount} unread` : label}
          aria-current={active === id ? "page" : undefined}
          onClick={() => id === "more" ? onOpenMore() : onNavigate(target)}
        >
          <span className="mobile-v2-tab-icon" aria-hidden="true">
            <Icon size={20} strokeWidth={active === id ? 2.5 : 2} aria-hidden="true" />
            {id === "updates" && unreadCount > 0 && <span className="mobile-v2-tab-dot" />}
          </span>
          <span className="mobile-v2-tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
