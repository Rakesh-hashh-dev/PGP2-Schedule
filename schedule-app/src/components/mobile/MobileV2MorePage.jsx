import {
  Bell, BookOpen, CalendarDays, CalendarOff, ChevronRight,
  CircleHelp, Download, LogOut, MessageSquare, Package,
  PawPrint, Settings2, Shield, SlidersHorizontal, Sparkles, Users, UtensilsCrossed,
  Wallet,
} from "lucide-react";

function MoreRow({ Icon, label, detail, badge, danger = false, onClick }) {
  return (
    <button type="button" className={`mobile-v2-more-row${danger ? " is-danger" : ""}`} onClick={onClick}>
      <span className="mobile-v2-more-row-icon"><Icon size={16} aria-hidden="true" /></span>
      <span className="mobile-v2-more-row-copy">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
      {badge > 0 && <span className="mobile-v2-more-badge">{badge > 99 ? "99+" : badge}</span>}
      {!danger && <ChevronRight size={15} className="mobile-v2-more-chevron" aria-hidden="true" />}
    </button>
  );
}

function MoreSection({ title, children }) {
  return <section className="mobile-v2-more-section"><h2>{title}</h2><div>{children}</div></section>;
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
        <MoreRow Icon={Bell} label="Announcements" detail="Updates and alerts" badge={unreadCount} onClick={() => onNavigate("notifications")} />
        {enableFriends && <MoreRow Icon={Users} label="Social" detail="Friends, groups and free slots" onClick={() => onNavigate("friends")} />}
        <MoreRow Icon={Package} label="Campus Board" detail="Community posts" onClick={() => onNavigate("board")} />
        <MoreRow Icon={UtensilsCrossed} label="Mess menu" detail="Today's meals" onClick={onOpenMess} />
      </MoreSection>

      <MoreSection title="Tools">
        <MoreRow Icon={CalendarDays} label="Full timetable" detail="Browse the complete term" onClick={() => onNavigate("fullSchedule")} />
        <MoreRow Icon={Wallet} label="Split expenses" detail="Settle group spending" onClick={() => onNavigate("split")} />
        <MoreRow Icon={CalendarOff} label="Leave planner" detail="Plan absence safely" onClick={() => onNavigate("leave")} />
        <MoreRow Icon={Download} label="Add to calendar" detail="Export classes and exams" onClick={onOpenCalendar} />
      </MoreSection>

      {(enableCompanion || wrappedActive) && (
        <MoreSection title="Personal">
          {enableCompanion && <MoreRow Icon={PawPrint} label="Companion" detail="Care, progress and rewards" onClick={() => onNavigate("pet")} />}
          {wrappedActive && <MoreRow Icon={Sparkles} label="Term Wrapped" detail="Your term in review" onClick={() => onNavigate("wrapped")} />}
        </MoreSection>
      )}

      <MoreSection title="Settings">
        <MoreRow Icon={SlidersHorizontal} label="Filter subjects" detail="Choose what appears" onClick={onFilter} />
        <MoreRow Icon={Settings2} label="Edit setup" detail="Courses and sections" onClick={onEditSetup} />
        {showAdmin && <MoreRow Icon={Shield} label="Admin tools" detail="Manage TermFlow" onClick={() => onNavigate("admin")} />}
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
