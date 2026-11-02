import NavIcon from "./NavIcon.jsx";
import { useAppControls } from '../../lib/appControls.js';
import { navVisible, navLabel } from '../../lib/navigationControls.js';
import { activeMobileV2Destination } from "../../lib/mobileNav.js";

export default function MobileV2TabBar({
  view,
  moreOpen,
  attendanceEnabled,
  onNavigate,
  onOpenMore,
}) {
  const { payload } = useAppControls();
  const active = activeMobileV2Destination(view, moreOpen, attendanceEnabled);
  const items = [
    ["today", "Today", "today"],
    ["schedule", "Schedule", "week"],
    ...(attendanceEnabled ? [["attendance", "Attend", "attendance", "Attendance"]] : []),
    ["tasks", "Tasks", "assignments"],
    ["more", "More", null],
  ].filter(([, , target]) => !target || navVisible(target, payload.navigation));

  return (
    <nav className="mobile-v2-tabbar" aria-label="Primary" style={{ "--mobile-nav-count": items.length }}>
      {items.map(([id, label, target, spoken]) => (
        <button
          type="button"
          key={id}
          className={active === id ? "is-active" : ""}
          aria-label={navLabel(target, spoken || label, payload.navigation)}
          aria-current={active === id ? "page" : undefined}
          onClick={() => id === "more" ? onOpenMore() : onNavigate(target)}
        >
          <span className="mobile-v2-tab-icon" aria-hidden="true">
            <NavIcon kind={id} />
          </span>
          <span className="mobile-v2-tab-label">{navLabel(target, label, payload.navigation)}</span>
        </button>
      ))}
    </nav>
  );
}
