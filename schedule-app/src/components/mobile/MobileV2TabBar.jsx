import NavIcon from "./NavIcon.jsx";
import { activeMobileV2Destination } from "../../lib/mobileNav.js";

export default function MobileV2TabBar({
  view,
  moreOpen,
  attendanceEnabled,
  onNavigate,
  onOpenMore,
}) {
  const active = activeMobileV2Destination(view, moreOpen, attendanceEnabled);
  const items = [
    ["today", "Today", "today"],
    ["schedule", "Schedule", "week"],
    ...(attendanceEnabled ? [["attendance", "Attend", "attendance"]] : []),
    ["tasks", "Tasks", "assignments"],
    ["more", "More", null],
  ];

  return (
    <nav className="mobile-v2-tabbar" aria-label="V2 primary navigation" style={{ "--mobile-nav-count": items.length }}>
      {items.map(([id, label, target]) => (
        <button
          type="button"
          key={id}
          className={active === id ? "is-active" : ""}
          aria-label={label}
          aria-current={active === id ? "page" : undefined}
          onClick={() => id === "more" ? onOpenMore() : onNavigate(target)}
        >
          <span className="mobile-v2-tab-icon" aria-hidden="true">
            <NavIcon kind={id} />
          </span>
          <span className="mobile-v2-tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
