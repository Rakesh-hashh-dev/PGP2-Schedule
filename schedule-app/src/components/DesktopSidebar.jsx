// Desktop sidebar (<aside className="sidebar">), extracted from App.jsx.
// Structural move only — every className/conditional/handler is unchanged,
// just relocated behind props. `renderSbAvatarWrap`/`renderSbUtilStrip` stay
// as render-prop functions from App.jsx since they close over a large amount
// of profile/sync/admin state that isn't worth prop-drilling separately.
import {
  Search, Clock, Sunrise, ClipboardList, GraduationCap, BookOpenCheck,
  Megaphone, Users, Package, ChevronDown, CalendarRange, UtensilsCrossed,
  Wallet, CalendarOff, Sparkles, PawPrint, ExternalLink, Shield, ChevronsRight,
  ChevronsLeft, CloudOff,
} from "lucide-react";
import IndiaFlagIcon from "./IndiaFlagIcon.jsx";
import { CalendarEventBadgeSVG } from "./CalendarSVGs.jsx";

export default function DesktopSidebar({
  sbCollapsed, sbStyle, specialDay, termLabel, termProgressPct, termWeekInfo,
  termSwitcherEl, isOffline, setCmdOpen, isMac, view, showSbTip, hideSbTip,
  setView, setCompareTarget, enableAttendance, enableExams, unreadChangeCount,
  enableFriends, markGroupsSeen, markBadgeSeen, showBadge, unreadFriendCount,
  showSbTools, recentToolViews, TOOLS_VIEWS, wrappedActive, TOOLS_VIEW_META, companionEnabled,
  setSbToolsOpen, openCalendarExport, setMessMenuOpen, activeQuickLinks,
  showAdminUI, renderSbUtilStrip, renderSbAvatarWrap, syncing, syncedAgo,
  isTablet, sidebarCollapsed, toggleSidebar,
}) {
  return (
    <aside className={`sidebar${sbCollapsed ? " collapsed" : ""}${sbStyle === "aurora" ? " sb-aurora" : ""}`}>
      {sbStyle === "aurora" && (
        <div className="sb-fx" aria-hidden="true"><i /><i /><span className="sb-grain" /></div>
      )}
      <div className="sb-brand">
        <div className="sb-brand-mark" aria-hidden="true" />
        <div className="logo"><img src="/termflow-icon.svg" alt="TermFlow" width={20} height={20} /></div>
        <div className="sb-brand-text">
          <div className="sb-brand-name">TermFlow {specialDay && <IndiaFlagIcon size={12} className="sb-brand-flag" />}</div>
          <div className="sb-brand-sub">
            <div>IIM Sambalpur</div>
            <div className="sb-brand-date">{termLabel}</div>
          </div>
          {termProgressPct != null && (
            <div className="sb-term-row" aria-hidden="true" title={termWeekInfo ? `${termWeekInfo.daysLeft} days left in term` : undefined}>
              <div className="sb-term-progress">
                <div className="sb-term-progress-fill" style={{ width: `${termProgressPct}%` }} />
              </div>
              {termWeekInfo && <span className="sb-term-wk">WK {termWeekInfo.week}/{termWeekInfo.totalWeeks}</span>}
            </div>
          )}
          {termSwitcherEl && <div className="sb-term-picker-slot">{termSwitcherEl}</div>}
        </div>
      </div>

      {isOffline && (
        <div style={{ margin: "0 16px 12px 16px", padding: "6px 8px", background: "rgba(231, 76, 60, 0.1)", border: "1px solid var(--danger)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: sbCollapsed ? "center" : "flex-start", gap: "8px", color: "var(--danger)", fontSize: "11px", fontWeight: 700 }}>
          <CloudOff size={14} style={{ flexShrink: 0 }} /> {!sbCollapsed && <span>Offline Mode (Cached)</span>}
        </div>
      )}

      <div className="sb-scroll-body">
        <nav className="sb-nav">
          <button className="sb-search-btn" onClick={() => setCmdOpen(true)}>
            <div className="sb-search-left">
              <Search size={16} />
              <span className="sb-search-label">Search</span>
            </div>
            <span className="sb-search-shortcut">{isMac ? "⌘K" : "Ctrl K"}</span>
          </button>

          <div className="sb-nav-label">Schedule</div>
          <button className={`sb-link${view === "today" ? " on" : ""}`} aria-current={view === "today" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Today")} onMouseLeave={hideSbTip} onClick={() => { setView("today"); setCompareTarget(null); hideSbTip(); }}>
            <Clock size={18} /><span className="sb-link-label">Today</span>
          </button>
          <button className={`sb-link${view === "tomorrow" ? " on" : ""}`} aria-current={view === "tomorrow" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Tomorrow")} onMouseLeave={hideSbTip} onClick={() => { setView("tomorrow"); setCompareTarget(null); hideSbTip(); }}>
            <Sunrise size={18} /><span className="sb-link-label">Tomorrow</span>
          </button>

          <div className="sb-nav-label">Track</div>
          {enableAttendance && (
            <button className={`sb-link${view === "attendance" ? " on" : ""}`} aria-current={view === "attendance" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Attendance")} onMouseLeave={hideSbTip} onClick={() => { setView("attendance"); setCompareTarget(null); hideSbTip(); }}>
              <ClipboardList size={18} /><span className="sb-link-label">Attendance</span>
            </button>
          )}
          {enableExams && (
            <button className={`sb-link${view === "exams" ? " on" : ""}`} aria-current={view === "exams" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Exams")} onMouseLeave={hideSbTip} onClick={() => { setView("exams"); setCompareTarget(null); hideSbTip(); }}>
              <GraduationCap size={18} /><span className="sb-link-label">Exams</span>
            </button>
          )}
          <button className={`sb-link${view === "assignments" ? " on" : ""}`} aria-current={view === "assignments" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Assignments")} onMouseLeave={hideSbTip} onClick={() => { setView("assignments"); setCompareTarget(null); hideSbTip(); }}>
            <BookOpenCheck size={18} /><span className="sb-link-label">Assignments</span>
          </button>

          <div className="sb-nav-label">Campus</div>
          <button className={`sb-link${view === "notifications" ? " on" : ""}`} aria-current={view === "notifications" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Announcements")} onMouseLeave={hideSbTip} onClick={() => { setView("notifications"); setCompareTarget(null); hideSbTip(); }}>
            <Megaphone size={18} /><span className="sb-link-label">Announcements</span>
            {unreadChangeCount > 0 && <span className="nav-badge">{unreadChangeCount > 9 ? "9+" : unreadChangeCount}</span>}
          </button>
          {enableFriends && (
            <button className={`sb-link${view === "friends" ? " on" : ""}`} aria-current={view === "friends" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Social")} onMouseLeave={hideSbTip} onClick={() => { setView("friends"); setCompareTarget(null); markGroupsSeen(); markBadgeSeen("social"); hideSbTip(); }}>
              <Users size={18} /><span className="sb-link-label">Social</span> {showBadge("social") && <span className="beta-badge">Beta</span>}
              {unreadFriendCount > 0 && <span className="nav-badge">{unreadFriendCount > 9 ? "9+" : unreadFriendCount}</span>}
            </button>
          )}
          <button className={`sb-link${view === "board" ? " on" : ""}`} aria-current={view === "board" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Campus Board")} onMouseLeave={hideSbTip} onClick={() => { setView("board"); setCompareTarget(null); markBadgeSeen("board"); hideSbTip(); }}>
            <Package size={18} /><span className="sb-link-label">Campus Board</span> {showBadge("board") && <span className="beta-badge">New</span>}
          </button>

          {!showSbTools && recentToolViews.filter(v => v !== view && TOOLS_VIEWS.includes(v) && (v !== "pet" || companionEnabled) && (v !== "wrapped" || wrappedActive)).length > 0 && (
            <>
              <div className="sb-nav-label">Recent</div>
              {recentToolViews.filter(v => v !== view && TOOLS_VIEWS.includes(v) && (v !== "pet" || companionEnabled) && (v !== "wrapped" || wrappedActive)).map(v => {
                const { icon: Icon, label } = TOOLS_VIEW_META[v];
                return (
                  <button key={v} className="sb-link" onMouseEnter={e => showSbTip(e, label)} onMouseLeave={hideSbTip} onClick={() => { setView(v); setCompareTarget(null); hideSbTip(); }}>
                    <Icon size={18} /><span className="sb-link-label">{label}</span>
                  </button>
                );
              })}
            </>
          )}

          <button type="button" className="sb-tools-head" aria-expanded={showSbTools} onClick={() => { if (!sbCollapsed) setSbToolsOpen(o => !o); }}>
            <span className="sb-nav-label">Tools</span>
            {!sbCollapsed && <ChevronDown size={13} className={`sb-nav-caret${showSbTools ? " open" : ""}`} />}
          </button>
          {showSbTools && (<>
            <button className={`sb-link${view === "fullSchedule" ? " on" : ""}`} aria-current={view === "fullSchedule" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Full timetable")} onMouseLeave={hideSbTip} onClick={() => { setView("fullSchedule"); setCompareTarget(null); hideSbTip(); }}>
              <CalendarRange size={18} /><span className="sb-link-label">Full timetable</span>
            </button>
            <button className="sb-link" onMouseEnter={e => showSbTip(e, "Add to Calendar")} onMouseLeave={hideSbTip} onClick={() => { openCalendarExport(); hideSbTip(); }}>
              <CalendarEventBadgeSVG size={18} /><span className="sb-link-label">Add to Calendar</span>
            </button>
            <button className="sb-link" onMouseEnter={e => showSbTip(e, "Mess menu")} onMouseLeave={hideSbTip} onClick={() => { setMessMenuOpen(true); hideSbTip(); }}>
              <UtensilsCrossed size={18} /><span className="sb-link-label">Mess menu</span>
            </button>
            <button className={`sb-link${view === "split" ? " on" : ""}`} aria-current={view === "split" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Split expenses")} onMouseLeave={hideSbTip} onClick={() => { setView("split"); setCompareTarget(null); markBadgeSeen("split"); hideSbTip(); }}>
              <Wallet size={18} /><span className="sb-link-label">Split</span> {showBadge("split") && <span className="beta-badge">New</span>}
            </button>
            {companionEnabled && (
              <button className={`sb-link${view === "pet" ? " on" : ""}`} aria-current={view === "pet" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Companion")} onMouseLeave={hideSbTip} onClick={() => { setView("pet"); setCompareTarget(null); markBadgeSeen("pet"); hideSbTip(); }}>
                <PawPrint size={18} /><span className="sb-link-label">Companion</span> {showBadge("pet") && <span className="beta-badge">New</span>}
              </button>
            )}
            <button className={`sb-link${view === "leave" ? " on" : ""}`} aria-current={view === "leave" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Leave planner")} onMouseLeave={hideSbTip} onClick={() => { setView("leave"); setCompareTarget(null); hideSbTip(); }}>
              <CalendarOff size={18} /><span className="sb-link-label">Leave planner</span>
            </button>
            {wrappedActive && (
              <button className={`sb-link${view === "wrapped" ? " on" : ""}`} aria-current={view === "wrapped" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Term Wrapped")} onMouseLeave={hideSbTip} onClick={() => { setView("wrapped"); setCompareTarget(null); hideSbTip(); }}>
                <Sparkles size={18} /><span className="sb-link-label">Term Wrapped</span>
              </button>
            )}
          </>)}
        </nav>

        {activeQuickLinks.length > 0 && (
          <div className="sb-quicklinks">
            <div className="sb-quicklinks-label">Quick Links</div>
            {activeQuickLinks.map(ql => (
              <a key={ql.id} className="sb-link sb-quicklink" href={ql.url} target="_blank" rel="noopener noreferrer" onMouseEnter={e => showSbTip(e, ql.title)} onMouseLeave={hideSbTip}>
                <ExternalLink size={18} /><span className="sb-link-label">{ql.title}</span>
              </a>
            ))}
          </div>
        )}

        {showAdminUI && (
          <>
            <div className="sb-nav-label sb-nav-label-admin">Admin</div>
            <nav className="sb-nav sb-nav-static">
              <button className={`sb-link${view === "admin" ? " on" : ""}`} aria-current={view === "admin" ? "page" : undefined} onMouseEnter={e => showSbTip(e, "Admin Tools")} onMouseLeave={hideSbTip} onClick={() => { setView("admin"); setCompareTarget(null); hideSbTip(); }}>
                <Shield size={18} /><span className="sb-link-label">Admin Tools</span>
              </button>
            </nav>
          </>
        )}
      </div>

      <div className="sb-bottom">
        <div className="sb-footer-card">
          {sbCollapsed ? (
            <>
              {renderSbUtilStrip()}
              <div className="sb-foot-sep" style={{ margin: "4px 8px" }} />
              {renderSbAvatarWrap()}
            </>
          ) : (
            <>
              {renderSbAvatarWrap()}
              <div className="sb-foot-sep" />
              {renderSbUtilStrip()}
              <div className="sb-sync-note">
                <span className="sb-sync-dot" style={{ animationDuration: syncing ? "1s" : "3s" }} />
                {syncing ? "Syncing…" : syncedAgo === 0 ? "Synced just now" : `Synced ${syncedAgo}m ago`}
              </div>
            </>
          )}
        </div>
      </div>

      {!isTablet && (
        <button
          className="sb-edge-handle sb-edge-tab"
          onMouseEnter={e => showSbTip(e, sidebarCollapsed ? "Expand" : "Collapse")}
          onMouseLeave={hideSbTip}
          onClick={() => { toggleSidebar(); hideSbTip(); }}
          aria-label="Toggle sidebar"
          aria-expanded={!sidebarCollapsed}
        >
          {sidebarCollapsed ? <ChevronsRight size={12} /> : <ChevronsLeft size={12} />}
        </button>
      )}
    </aside>
  );
}
