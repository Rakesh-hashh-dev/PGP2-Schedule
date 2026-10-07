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
  Check, X, ArrowUp, ArrowDown,
} from "lucide-react";
import IndiaFlagIcon from "./IndiaFlagIcon.jsx";
import SbLink from "./SbLink.jsx";
import { useNavView } from "../lib/navView.js";

// Admin row sits outside NAV_ITEMS; same store-driven highlight as SbLink.
function SbAdminLink({ view, children, ...rest }) {
  const on = (useNavView() ?? view) === "admin";
  return <button className={`sb-link${on ? " on" : ""}`} aria-current={on ? "page" : undefined} {...rest}>{children}</button>;
}
import { NAV_GROUPS, itemsForGroup } from "../lib/navItems.js";
// SidebarClassStatus is intentionally parked for a future sidebar iteration.
// import SidebarClassStatus from "./SidebarClassStatus.jsx";
import { SIDEBAR_PINS_KEY, SIDEBAR_COMPACT_KEY, MAX_SIDEBAR_PINS, normalizeSidebarPins, toggleSidebarPin } from "../lib/sidebarPreferences.js";
import "../styles/sidebar-enhancements.css";

export default function DesktopSidebar({
  sbCollapsed, sbStyle, specialDay, termLabel, termProgressPct, termWeekInfo,
  termSwitcherEl, isOffline, setCmdOpen, isMac, view, showSbTip, hideSbTip,
  setView, preloadView, setCompareTarget, enableAttendance, enableExams, unreadChangeCount,
  enableFriends, markGroupsSeen, markBadgeSeen, showBadge, unreadFriendCount,
  showSbTools, wrappedActive, companionEnabled, setSbToolsOpen,
  setMessMenuOpen, activeQuickLinks, showAdminUI, renderSbUtilStrip,
  renderSbAvatarWrap, syncing, syncedAgo, toggleSidebar,
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
  const clearPins = () => {
    setPins([]);
    try { localStorage.setItem(SIDEBAR_PINS_KEY, JSON.stringify([])); } catch { /* storage unavailable */ }
  };
  const movePin = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= pins.length) return;
    const copy = [...pins];
    const [moved] = copy.splice(idx, 1);
    copy.splice(newIdx, 0, moved);
    setPins(copy);
    try { localStorage.setItem(SIDEBAR_PINS_KEY, JSON.stringify(copy)); } catch { /* storage unavailable */ }
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
      view={view}
      badge={item.badge && showBadge(item.badge.key) ? item.badge.label : null}
      count={item.count ? counts[item.count] : 0}
      onSelect={onSelect}
      onIntent={() => preloadView?.(item.view)}
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
              <Search size={18} strokeWidth={1.85} aria-hidden="true" />
              <span className="sb-search-label">Search</span>
            </div>
            <span className="sb-search-shortcut">{isMac ? "⌘K" : "Ctrl K"}</span>
          </button>

          {pinnedItems.length > 0 && (
            <Fragment key="pinned">
              <div className="sb-nav-label">Pinned</div>
              {pinnedItems.map(renderItem)}
            </Fragment>
          )}

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
          <summary className="sb-cust-summary-trigger">
            <div className="sb-cust-summary-inner">
              <div className="sb-cust-summary-left">
                <SlidersHorizontal size={13} className="sb-cust-summary-icon" />
                <span className="sb-cust-summary-title">Customize sidebar</span>
              </div>
              <div className="sb-cust-summary-right">
                {pins.length > 0 && (
                  <span className="sb-cust-pin-badge">{pins.length} pinned</span>
                )}
                <ChevronDown size={12} className="sb-cust-chevron" />
              </div>
            </div>
          </summary>

          <div className="sb-cust-dropdown">
            <div className="sb-cust-section">
              <div className="sb-cust-row">
                <div className="sb-cust-label-wrap">
                  <span className="sb-cust-label">Compact view</span>
                  <span className="sb-cust-sub">Reduce sidebar spacing</span>
                </div>
                <label className="sb-switch" aria-label="Toggle compact view">
                  <input
                    type="checkbox"
                    checked={compact}
                    onChange={e => changeCompact(e.target.checked)}
                  />
                  <span className="sb-switch-slider" />
                </label>
              </div>
            </div>

            <div className="sb-cust-section">
              <div className="sb-cust-header-row">
                <span className="sb-cust-header-title">
                  <Pin size={11} className="sb-cust-sec-icon" />
                  <span>Pin shortcuts</span>
                </span>
                <div className="sb-cust-header-actions">
                  {pins.length > 0 && (
                    <button
                      type="button"
                      className="sb-cust-clear-btn"
                      onClick={clearPins}
                      title="Clear all pinned shortcuts"
                    >
                      Clear all
                    </button>
                  )}
                  <span className="sb-cust-count">
                    {pins.length}/{MAX_SIDEBAR_PINS}
                  </span>
                </div>
              </div>
              <p className="sb-cust-hint">
                Pinned pages appear right at the top of your sidebar for 1-click access.
              </p>

              {pins.length > 1 && (
                <div className="sb-cust-reorder-wrap">
                  <span className="sb-cust-reorder-heading">Priority order (top to bottom):</span>
                  <div className="sb-cust-reorder-list">
                    {pinnedItems.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.id} className="sb-cust-reorder-item">
                          <span className="sb-cust-reorder-num">{idx + 1}</span>
                          {Icon && <Icon size={12} strokeWidth={1.85} className="sb-cust-reorder-icon" aria-hidden="true" />}
                          <span className="sb-cust-reorder-name">{item.label}</span>
                          <div className="sb-cust-reorder-btns">
                            <button
                              type="button"
                              className="sb-cust-order-btn"
                              disabled={idx === 0}
                              onClick={() => movePin(idx, -1)}
                              title="Move up"
                              aria-label={`Move ${item.label} up`}
                            >
                              <ArrowUp size={10} />
                            </button>
                            <button
                              type="button"
                              className="sb-cust-order-btn"
                              disabled={idx === pins.length - 1}
                              onClick={() => movePin(idx, 1)}
                              title="Move down"
                              aria-label={`Move ${item.label} down`}
                            >
                              <ArrowDown size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="sb-cust-chips">
                {available.filter(item => item.view).map(item => {
                  const isPinned = pins.includes(item.id);
                  const isMax = !isPinned && pins.length >= MAX_SIDEBAR_PINS;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`sb-cust-chip${isPinned ? " is-pinned" : ""}${isMax ? " is-disabled" : ""}`}
                      disabled={isMax}
                      onClick={() => changePin(item.id)}
                      title={isMax ? `Max ${MAX_SIDEBAR_PINS} pinned pages` : (isPinned ? `Unpin ${item.label}` : `Pin ${item.label}`)}
                    >
                      {Icon && <Icon size={12} strokeWidth={1.85} className="sb-cust-chip-icon" aria-hidden="true" />}
                      <span className="sb-cust-chip-label">{item.label}</span>
                      {isPinned && <Check size={10} className="sb-cust-chip-check" />}
                    </button>
                  );
                })}
              </div>

              {pins.filter(id => !available.some(item => item.id === id)).map(id => (
                <button
                  key={id}
                  type="button"
                  className="sb-cust-stale-btn"
                  onClick={() => changePin(id)}
                >
                  <span>Remove stale: {id}</span>
                  <X size={11} />
                </button>
              ))}
            </div>
          </div>
        </details>

        {activeQuickLinks.length > 0 && (
          <div className="sb-quicklinks">
            <div className="sb-quicklinks-label">Quick Links</div>
            {activeQuickLinks.map(ql => (
              <a key={ql.id} className="sb-link sb-quicklink" href={ql.url} target="_blank" rel="noopener noreferrer" onMouseEnter={e => showSbTip(e, ql.title)} onMouseLeave={hideSbTip}>
                <ExternalLink size={18} strokeWidth={1.85} aria-hidden="true" /><span className="sb-link-label">{ql.title}</span>
              </a>
            ))}
          </div>
        )}

        {showAdminUI && (
          <>
            <div className="sb-nav-label sb-nav-label-admin">Admin</div>
            <nav className="sb-nav sb-nav-static">
              <SbAdminLink view={view} onMouseEnter={e => showSbTip(e, "Admin Tools")} onMouseLeave={hideSbTip} onClick={() => { setView("admin"); setCompareTarget(null); hideSbTip(); }}>
                <Shield size={18} strokeWidth={1.85} aria-hidden="true" /><span className="sb-link-label">Admin Tools</span>
              </SbAdminLink>
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

      <button
        className="sb-edge-handle sb-edge-tab"
        onMouseEnter={e => showSbTip(e, sbCollapsed ? "Expand" : "Collapse")}
        onMouseLeave={hideSbTip}
        onClick={() => { toggleSidebar(); hideSbTip(); }}
        aria-label="Toggle sidebar"
        aria-expanded={!sbCollapsed}
      >
        {sbCollapsed ? <ChevronsRight size={12} /> : <ChevronsLeft size={12} />}
      </button>
    </aside>
  );
}
