import { Children } from 'react';
import { useAppControls } from '../../lib/appControls.js';
import { navVisible, navLabel } from '../../lib/navigationControls.js';
import {
  Bell, BookOpen, CalendarDays, CheckSquare2, ChevronRight,
  CircleHelp, Download, LogOut, MessageSquare, Package,
  PawPrint, Settings2, Shield, SlidersHorizontal, Sparkles, Users, UtensilsCrossed,
  Wallet, LayoutDashboard,
} from "lucide-react";

function MoreRow({ navId, Icon, label, detail, badge, danger = false, onClick }) {
  const { payload } = useAppControls();
  if (navId && !navVisible(navId, payload.navigation)) return null;
  label = navLabel(navId, label, payload.navigation);
  return (
    <button type="button" className={`mobile-v2-more-row${danger ? " is-danger" : ""}`} onClick={onClick}>
      <span className="mobile-v2-more-row-icon"><Icon size={16} aria-hidden="true" /></span>
      <span className="mobile-v2-more-row-copy">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
      {badge > 0 && <span className="mobile-v2-more-badge">{badge > 99 ? "99+" : badge}<span className="sr-only"> unread</span></span>}
      {!danger && <ChevronRight size={15} className="mobile-v2-more-chevron" aria-hidden="true" />}
    </button>
  );
}

function MoreSection({ title, children }) {
  const { payload } = useAppControls();
  const order = payload.navigation.order;
  const sorted = Children.toArray(children).sort((a, b) => {
    const ai = order.indexOf(a.props.navId), bi = order.indexOf(b.props.navId);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
  return <section className="mobile-v2-more-section"><h2>{title}</h2><div>{sorted}</div></section>;
}

export default function MobileV2MorePage({
  user,
  unreadCount,
  enableFriends,
  enableCompanion,
  wrappedActive,
  showAdmin,
  onNavigate,
  onOpenMess,
  onOpenCalendar,
  onFilter,
  onEditSetup,
  onWhatsNew,
  onFeedback,
  onOpenGuide,
  onSignOut,
}) {
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}` || "S";

  return (
    <div className="mobile-v2-more-page" aria-label="More">
      <section className="mobile-v2-profile-card">
        {user?.imageUrl
          ? <img src={user.imageUrl} alt="" className="mobile-v2-profile-avatar" />
          : <span className="mobile-v2-profile-initials">{initials}</span>}
        <div className="mobile-v2-profile-info">
          <strong className="mobile-v2-profile-name">{user?.fullName || user?.firstName || "Student"}</strong>
          <span className="mobile-v2-profile-email">{user?.primaryEmailAddress?.emailAddress || "—"}</span>
          <span className="mobile-v2-profile-batch">PGP2 · 2025–27</span>
        </div>
      </section>

      <MoreSection title="Campus">
        <MoreRow navId="notifications" Icon={Bell} label="Announcements" detail="Updates and alerts" badge={unreadCount} onClick={() => onNavigate("notifications")}  />
        {enableFriends && <MoreRow navId="friends" Icon={Users} label="Social" detail="Friends, groups and free slots" onClick={() => onNavigate("friends")}  />}
        <MoreRow navId="planner" Icon={LayoutDashboard} label="Planner" detail="Schedule, workload and leave plans" onClick={() => onNavigate("planner")}  />
        <MoreRow navId="board" Icon={Package} label="Campus Board" detail="Community posts" onClick={() => onNavigate("board")}  />
        <MoreRow navId="messMenu" Icon={UtensilsCrossed} label="Mess menu" detail="Today's meals" onClick={onOpenMess} />
      </MoreSection>

      <MoreSection title="Tools">
        <MoreRow navId="assignments" Icon={CheckSquare2} label="Assignments" detail="Tasks and deadlines" onClick={() => onNavigate("assignments")}  />
        <MoreRow navId="courseHub" Icon={BookOpen} label="Courses" detail="Classes, work and materials by subject" onClick={() => onNavigate("courseHub")}  />
        <MoreRow navId="fullSchedule" Icon={CalendarDays} label="Full timetable" detail="Browse the complete term" onClick={() => onNavigate("fullSchedule")}  />
        <MoreRow navId="split" Icon={Wallet} label="Split expenses" detail="Settle group spending" onClick={() => onNavigate("split")}  />
        <MoreRow Icon={Download} label="Add to calendar" detail="Export classes and exams" onClick={onOpenCalendar} />
      </MoreSection>

      {(enableCompanion || wrappedActive) && (
        <MoreSection title="Personal">
          {enableCompanion && <MoreRow navId="pet" Icon={PawPrint} label="Companion" detail="Care, progress and rewards" onClick={() => onNavigate("pet")}  />}
          {wrappedActive && <MoreRow navId="wrapped" Icon={Sparkles} label="Term Wrapped" detail="Your term in review" onClick={() => onNavigate("wrapped")}  />}
        </MoreSection>
      )}

      <MoreSection title="Settings">
        <MoreRow Icon={SlidersHorizontal} label="Filter subjects" detail="Choose what appears" onClick={onFilter} />
        <MoreRow Icon={Settings2} label="Edit setup" detail="Courses and sections" onClick={onEditSetup} />
        {showAdmin && <MoreRow navId="admin" Icon={Shield} label="Admin tools" detail="Manage TermFlow" onClick={() => onNavigate("admin")}  />}
      </MoreSection>

      <MoreSection title="Support">
        <MoreRow Icon={BookOpen} label="What's New" onClick={onWhatsNew} />
        <MoreRow Icon={MessageSquare} label="Submit feedback" onClick={onFeedback} />
        <MoreRow Icon={CircleHelp} label="App guide" onClick={onOpenGuide} />
      </MoreSection>

      <MoreSection title="Account">
        <MoreRow Icon={LogOut} label="Sign out" danger onClick={onSignOut} />
      </MoreSection>
    </div>
  );
}
