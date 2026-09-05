// Desktop sidebar (<aside className="sidebar">).
//
// The nav is data-driven off `lib/navItems.js`; this file owns only the chrome
// around it (brand, search, quick links, admin, footer, edge handle).
// `renderSbAvatarWrap`/`renderSbUtilStrip` stay as render-prop functions from
// App.jsx since they close over a large amount of profile/sync/admin state
// that isn't worth prop-drilling separately.
import { Fragment, useState } from "react";
import {
  Search, ChevronDown, ExternalLink, Shield, ChevronsRight, ChevronsLeft, CloudOff, Pin, SlidersHorizontal,
} from "lucide-react";
import IndiaFlagIcon from "./IndiaFlagIcon.jsx";
import SbLink from "./SbLink.jsx";
import { NAV_GROUPS, itemsForGroup } from "../lib/navItems.js";
// SidebarClassStatus is intentionally parked for a future sidebar iteration.
// import SidebarClassStatus from "./SidebarClassStatus.jsx";
import { SIDEBAR_PINS_KEY, SIDEBAR_COMPACT_KEY, MAX_SIDEBAR_PINS, normalizeSidebarPins, toggleSidebarPin } from "../lib/sidebarPreferences.js";
import "../styles/sidebar-enhancements.css";

export default function DesktopSidebar({
  sbCollapsed, sbStyle, specialDay, termLabel, termProgressPct, termWeekInfo,
  termSwitcherEl, isOffline, setCmdOpen, isMac, view, showSbTip, hideSbTip,
  setView, setCompareTarget, enableAttendance, enableExams, unreadChangeCount,
  enableFriends, markGroupsSeen, markBadgeSeen, showBadge, unreadFriendCount,
  showSbTools, wrappedActive, companionEnabled, setSbToolsOpen,
  setMessMenuOpen, activeQuickLinks, showAdminUI, renderSbUtilStrip,
  renderSbAvatarWrap, syncing, syncedAgo, isTablet, sidebarCollapsed, toggleSidebar,
}) {
  const [pins, setPins] = useState(() => {
    try { return normalizeSidebarPins(JSON.parse(localStorage.getItem(SIDEBAR_PINS_KEY))); } catch { return []; }
  });
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COMPACT_KEY) === "true"; } catch { return false; }
  });
  const changePin = id => {
    const updated = toggleSidebarPin(pins, id);
    setPins(updated);
    try { localStorage.setItem(SIDEBAR_PINS_KEY, JSON.stringify(updated)); } catch { /* storage unavailable */ }
  };
  const changeCompact = checked => {
    setCompact(checked);
    try { localStorage.setItem(SIDEBAR_COMPACT_KEY, String(checked)); } catch { /* storage unavailable */ }
  };

  // Feature flags, keyed by the `gate` names used in NAV_ITEMS.
  const flags = { enableAttendance, enableExams, enableFriends, companionEnabled, wrappedActive };
  const available = NAV_GROUPS.flatMap(group => itemsForGroup(group.id, flags));
  const pinnedItems = pins.map(id => available.find(item => item.id === id)).filter(Boolean);
  // Unread counters and extra select-time side effects, keyed the same way.
  const counts = { unreadChangeCount, unreadFriendCount };
  const effects = { markGroupsSeen };
  const actions = { openMessMenu: () => setMessMenuOpen(true) };

  const onSelect = (item) => {
    if (item.badge) markBadgeSeen(item.badge.key);
    if (item.effect) effects[item.effect]?.();
    if (item.action) { actions[item.action]?.(); return; }
    setView(item.view);
    setCompareTarget(null);
  };

  const renderItem = (item) => (
    <SbLink
      key={item.id}
      item={item}
      active={Boolean(item.view) && view === item.view}
      badge={item.badge && showBadge(item.badge.key) ? item.badge.label : null}
      count={item.count ? counts[item.count] : 0}
      onSelect={onSelect}
      showSbTip={showSbTip}
      hideSbTip={hideSbTip}
    />
  );

  return (
    <aside aria-label="Desktop navigation" onKeyDown={e => { if (e.key === "Escape") hideSbTip(); }} className={`sidebar${sbCollapsed ? " collapsed" : ""}${sbStyle === "aurora" ? " sb-aurora" : ""}${compact ? " sb-compact" : ""}`}>
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

      {/* Parked: retain the component for a future current-class sidebar card.
      <SidebarClassStatus current={current} todayISO={todayISO} isArchivedView={isArchivedView}
        onOpen={onOpenClass} showSbTip={showSbTip} hideSbTip={hideSbTip} /> */}

      {isOffline && (
        <div className="sb-offline">
          <CloudOff size={14} /> {!sbCollapsed && <span>Offline Mode (Cached)</span>}
        </div>
      )}

      <div className="sb-scroll-body" onScroll={hideSbTip}>
        <nav className="sb-nav">
          <button className="sb-search-btn" aria-label="Search"
            onMouseEnter={e => showSbTip(e, "Search")} onMouseLeave={hideSbTip}
            onFocus={e => showSbTip(e, "Search")} onBlur={hideSbTip} onClick={() => { setCmdOpen(true); hideSbTip(); }}>
            <div className="sb-search-left">
              <Search size={16} />
              <span className="sb-search-label">Search</span>
            </div>
            <span className="sb-search-shortcut">{isMac ? "⌘K" : "Ctrl K"}</span>
          </button>

          {NAV_GROUPS.map(group => {
            const items = itemsForGroup(group.id, flags).filter(item => !pinnedItems.some(pin => pin.id === item.id));
            if (items.length === 0 && !group.collapsible) return null;
            if (!group.collapsible) {
              return (
                <Fragment key={group.id}>
                  <div className="sb-nav-label">{group.label}</div>
                  {items.map(renderItem)}
                </Fragment>
              );
            }
            // The one collapsible group. Its rows stay mounted only while open;
            // a collapsed rail always shows them, since there is no room for a
            // disclosure affordance at 68px wide.
            return (
              <Fragment key={group.id}>
                {pinnedItems.length > 0 && <>
                  <div className="sb-nav-label">Pinned</div>
                  {pinnedItems.map(renderItem)}
                </>}
                {items.length > 0 && <button
                  type="button"
                  className="sb-tools-head"
                  aria-expanded={showSbTools}
                  onClick={() => { if (!sbCollapsed) setSbToolsOpen(o => !o); }}
                >
                  <span className="sb-nav-label">{group.label}</span>
                  {!showSbTools && items.some(item => item.badge && showBadge(item.badge.key)) && <span className="sb-unseen-dot" role="img" aria-label="Unseen features in More" />}
                  {!sbCollapsed && <ChevronDown size={13} className={`sb-nav-caret${showSbTools ? " open" : ""}`} />}
                </button>}
                {showSbTools && items.map(renderItem)}
              </Fragment>
            );
          })}
        </nav>

        <details className="sb-customize">
          <summary><SlidersHorizontal size={13} /> Customize sidebar</summary>
          <label className="sb-compact-option"><input type="checkbox" checked={compact} onChange={e => changeCompact(e.target.checked)} /> Compact mode</label>
          <fieldset>
            <legend><Pin size={12} /> Pin up to {MAX_SIDEBAR_PINS} pages ({pins.length}/{MAX_SIDEBAR_PINS})</legend>
            {available.filter(item => item.view).map(item => <label key={item.id}>
              <input type="checkbox" checked={pins.includes(item.id)} disabled={!pins.includes(item.id) && pins.length >= MAX_SIDEBAR_PINS} onChange={() => changePin(item.id)} /> {item.label}
            </label>)}
            {pins.filter(id => !available.some(item => item.id === id)).map(id => <label key={id}>
              <input type="checkbox" checked onChange={() => changePin(id)} /> {id} (unavailable)
            </label>)}
          </fieldset>
        </details>

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
