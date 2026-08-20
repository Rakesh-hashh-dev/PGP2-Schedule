import { useState, useEffect, useRef } from "react";
import { Megaphone, PlusCircle, MinusCircle, ArrowRightLeft, BookOpen, Info, ChevronDown, ChevronUp, ChevronRight, CheckCheck, AlertTriangle, Check, EyeOff, Volume2, VolumeX, CheckCircle2, Search, X } from "lucide-react";
import { useNotificationState } from "../hooks/useNotificationState.js";
import { useNotificationFeed, FEED_PAGE_SIZE } from "../hooks/useNotificationFeed.js";
import { SwipeRow } from "./notifications/SwipeRow.jsx";
import { PushToggle } from "./notifications/PushToggle.jsx";
import { NotificationPrefsPanel } from "./notifications/NotificationPrefsPanel.jsx";
import CohortPolls from "./notifications/CohortPolls.jsx";
import { EmptyState } from "./ui.jsx";

const SWIPE_HINT_KEY = "pgp2.notif-swipe-hint-seen";
const LOAD_TS = Date.now();

const KIND_META = {
  added:   { Icon: PlusCircle,      label: "Added",     cls: "nk-added"   },
  removed: { Icon: MinusCircle,     label: "Cancelled", cls: "nk-removed" },
  moved:   { Icon: ArrowRightLeft,  label: "Shifted",   cls: "nk-moved"   },
  course:  { Icon: BookOpen,        label: "Course",    cls: "nk-course"  },
  update:  { Icon: Info,            label: "Updated",   cls: "nk-update"  },
};
const KIND_VERB = { added: "added", removed: "cancelled", moved: "shifted", course: "renamed", update: "updated" };
const KIND_FILTERS = [
  { id: "all", label: "All" },
  { id: "removed", label: "Cancelled", cls: "nk-removed" },
  { id: "moved", label: "Moved", cls: "nk-moved" },
  { id: "added", label: "Added", cls: "nk-added" },
  { id: "update", label: "Updates", cls: "nk-update" },
];

function relTime(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

export default function NotificationsPage({ allChanges, myChanges, isAdmin, userId, userName, legend, readChangeKeys, changeKeyOf, onMarkReadMany, onMarkAllRead, onOpenDate, openPrefsSignal }) {
  const [pushStatus, setPushStatus] = useState("busy");
  const [showAll, setShowAll] = useState(false);
  const [kindFilter, setKindFilter] = useState("all");
  const [groupMode, setGroupMode] = useState("date"); // "date" | "course"
  const [expanded, setExpanded] = useState({});
  const [syncState, setSyncState] = useState("idle"); // idle | syncing | synced
  const [query, setQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [nowTick, setNowTick] = useState(LOAD_TS);
  const [swipeHintSeen, setSwipeHintSeen] = useState(() => { try { return localStorage.getItem(SWIPE_HINT_KEY) === "1"; } catch { return true; } });
  const [olderOpen, setOlderOpen] = useState(false);

  const syncTimer = useRef(null);
  useEffect(() => () => clearTimeout(syncTimer.current), []);
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const readKeys = readChangeKeys || new Set();
  const keyOf = changeKeyOf || (c => `${c.ts}-${c.code || ""}`);

  const {
    dismissed,
    mutedCourses,
    snoozed,
    undo,
    dismissKeys,
    undoLast,
    toggleMute,
    snoozeItem
  } = useNotificationState(userId);

  const feedProps = useNotificationFeed({
    allChanges,
    myChanges,
    isAdmin,
    showAll,
    kindFilter,
    groupMode,
    query,
    dismissed,
    mutedCourses,
    snoozed,
    readKeys,
    keyOf,
    legend,
    nowTick
  });

  const {
    changes,
    groups,
    attnItems,
    olderHiddenCount,
    setVisibleCount,
    weekTotal,
    unreadCount,
    extraCount,
    dismissedInScope,
    newPillCount,
    setNewPillCount,
    hasAnyChanges
  } = feedProps;

  function trackSync(promise) {
    setSyncState("syncing");
    clearTimeout(syncTimer.current);
    Promise.resolve(promise).then(() => {
      syncTimer.current = setTimeout(() => {
        setSyncState("synced");
        syncTimer.current = setTimeout(() => setSyncState("idle"), 3000);
      }, 500);
    }).catch(() => setSyncState("idle"));
  }

  const isUnreadItem = (it) =>
    it.type === "bundle" ? it.changes.some(c => !readKeys.has(keyOf(c))) : !readKeys.has(keyOf(it.change));

  const activateChange = (c) => {
    trackSync(onMarkReadMany?.([c]));
    if (c.date) onOpenDate?.(c);
  };

  const renderSingle = (it, isAttn) => {
    const c = it.change;
    const meta = KIND_META[c.kind] || { Icon: Info, label: c.kind || "Update", cls: "nk-update" };
    const { Icon, cls } = meta;
    const unread = !readKeys.has(keyOf(c));
    return (
      <li key={c.id}>
        <SwipeRow
          onSwipeRight={unread ? () => trackSync(onMarkReadMany?.([c])) : undefined}
          onSwipeLeft={() => dismissKeys([keyOf(c)], c.text)}
          extraAction={isAttn ? { title: "Snooze until closer to the date", onClick: () => snoozeItem(it.id, c) } : undefined}
          className="notif-swipe-row"
        >
          {(capture) => (
            <div
              className={`notif-pg-item ${cls}${c.admin_only ? " nk-admin-only" : ""}${unread ? "" : " notif-read"}`}
              role="button"
              tabIndex={0}
              data-tip={c.date ? "View this day in the full schedule" : undefined}
              onClick={capture(() => activateChange(c))}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activateChange(c); } }}
            >
              <div className="notif-item-icon-wrap">
                <Icon size={14} strokeWidth={2.5} />
              </div>
              <div className="notif-pg-body">
                <span className="notif-pg-text">
                  <span className="notif-kind-badge">{meta.label}</span>
                  {c.text}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flex: "none" }}>
                <span className="notif-pg-time">
                  {unread && <span className="notif-dot" />}
                  {relTime(c.ts)}
                </span>
                {c.admin_only && isAdmin && (
                  <span className="notif-admin-badge">admin only</span>
                )}
              </div>
            </div>
          )}
        </SwipeRow>
      </li>
    );
  };

  const renderBundle = (it, isAttn) => {
    const meta = KIND_META[it.kind] || { Icon: Info, label: it.kind || "Update", cls: "nk-update" };
    const { Icon, cls } = meta;
    const name = legend?.[it.code]?.name || it.code || "Course";
    const isOpen = !!expanded[it.id];
    const unread = isUnreadItem(it);
    const bundleKeys = it.changes.map(keyOf);
    return (
      <li key={it.id} className="notif-bundle">
        <SwipeRow
          onSwipeRight={unread ? () => trackSync(onMarkReadMany?.(it.changes)) : undefined}
          onSwipeLeft={() => dismissKeys(bundleKeys, `${name} — ${it.changes.length} sessions`)}
          extraAction={isAttn ? { title: "Snooze until closer to the date", onClick: () => snoozeItem(it.id, it.changes[0]) } : undefined}
        >
          {(capture) => (
            <button
              className={`notif-pg-item notif-bundle-head ${cls}${unread ? "" : " notif-read"}`}
              onClick={capture(() => {
                setExpanded(p => ({ ...p, [it.id]: !isOpen }));
                if (!isOpen && unread) trackSync(onMarkReadMany?.(it.changes));
              })}
              aria-expanded={isOpen}
            >
              <div className="notif-item-icon-wrap">
                <Icon size={14} strokeWidth={2.5} />
              </div>
              <div className="notif-pg-body">
                <span className="notif-pg-text">
                  <b>{name}</b>
                  <span className="notif-bundle-pill">{it.changes.length} {KIND_VERB[it.kind] || "updated"}</span>
                </span>
              </div>
              <span className="notif-pg-time">
                {unread && <span className="notif-dot" />}
                {relTime(it.ts)}
              </span>
              <ChevronDown size={15} className={`notif-bundle-chev${isOpen ? " open" : ""}`} />
            </button>
          )}
        </SwipeRow>
        {isOpen && (
          <ul className={`notif-bundle-list ${cls}`}>
            {it.changes.map(c => {
              const m = typeof c.text === "string" ? c.text.match(/^(.+?) — (.*)$/s) : null;
              const when = m ? m[1] : null;
              let what = m ? m[2] : c.text;
              if (typeof what === "string" && what.startsWith(name)) what = what.slice(name.length).trim();
              return (
                <li
                  key={c.id}
                  className="notif-bundle-sub"
                  role="button"
                  tabIndex={0}
                  data-tip={c.date ? "View this day in the full schedule" : undefined}
                  onClick={() => c.date && onOpenDate?.(c)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (c.date) onOpenDate?.(c); } }}
                >
                  {when ? (
                    <>
                      <span className="notif-sub-when">{when}</span>
                      <span className="notif-sub-what">{what}</span>
                    </>
                  ) : (
                    <span className="notif-sub-what">{what}</span>
                  )}
                  <ChevronRight size={13} className="notif-sub-go" aria-hidden="true" />
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  const renderItem = (it, isAttn = false) => (it.type === "bundle" ? renderBundle(it, isAttn) : renderSingle(it, isAttn));

  if (!hasAnyChanges) {
    return (
      <div className="notif-pg">
        <div className="notif-pg-head">
          <div className="notif-pg-head-title">
            <Megaphone size={18} strokeWidth={2} />
            <h2>Announcements</h2>
          </div>
          <div style={{ marginLeft: "auto" }}><PushToggle userId={userId} onStatusChange={setPushStatus} /></div>
        </div>
        {pushStatus === "on" && <NotificationPrefsPanel userId={userId} openSignal={openPrefsSignal} />}
        <CohortPolls userId={userId} userName={userName} isAdmin={isAdmin} />
        <EmptyState icon={CheckCircle2} title="You're all caught up" sub="No recent announcements for your subjects." />
      </div>
    );
  }

  const feed = [...attnItems, ...groups.flatMap(g => g.items)];

  return (
    <div className="notif-pg">
      {/* Header */}
      <div className="notif-pg-head">
        <div className="notif-pg-head-title">
          <Megaphone size={18} strokeWidth={2} />
          <h2>Announcements</h2>
          {unreadCount > 0 ? (
            <span className="notif-pg-count notif-pg-count-unread">{unreadCount} new</span>
          ) : changes.length > 0 && (
            <span className="notif-pg-count">{changes.length}</span>
          )}
          {syncState !== "idle" && (
            <span className={`notif-sync-pill${syncState === "synced" ? " synced" : ""}`}>
              {syncState === "synced" ? <><Check size={11} strokeWidth={3} /> Synced</> : "Syncing…"}
            </span>
          )}
        </div>
        <div className="notif-pg-head-controls">
        {unreadCount > 0 && (
          <button className="notif-markall" onClick={() => trackSync(onMarkAllRead?.())} aria-label="Mark all read" title="Mark all announcements as read">
            <CheckCheck size={13} /> <span className="notif-btn-label">Mark all read</span>
          </button>
        )}
        <PushToggle userId={userId} onStatusChange={setPushStatus} />
        {/* Compact scope toggle */}
        <div className="notif-scope-toggle">
          <button
            className={`notif-scope-btn${!showAll ? " notif-scope-active" : ""}`}
            onClick={() => setShowAll(false)}
          >
            Mine
          </button>
          <button
            className={`notif-scope-btn${showAll ? " notif-scope-active" : ""}`}
            onClick={() => setShowAll(true)}
          >
            All
          </button>
        </div>
        </div>
      </div>

      {pushStatus === "on" && <NotificationPrefsPanel userId={userId} />}

      <CohortPolls userId={userId} userName={userName} isAdmin={isAdmin} />

      {newPillCount > 0 && (
        <button
          type="button"
          className="notif-new-pill"
          onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setNewPillCount(0); }}
        >
          <ChevronUp size={13} /> {newPillCount} new
        </button>
      )}

      {weekTotal > 0 && (
        <div className="notif-week-strip">
          <span className="notif-week-strip-label">This week</span>
          <div className="notif-week-strip-segs">
            {feedProps.kindCounts.added > 0 && (
              <button className="notif-week-seg nk-added" onClick={() => setKindFilter("added")}>{feedProps.kindCounts.added} added</button>
            )}
            {feedProps.kindCounts.removed > 0 && (
              <button className="notif-week-seg nk-removed" onClick={() => setKindFilter("removed")}>{feedProps.kindCounts.removed} cancelled</button>
            )}
            {feedProps.kindCounts.moved > 0 && (
              <button className="notif-week-seg nk-moved" onClick={() => setKindFilter("moved")}>{feedProps.kindCounts.moved} shifted</button>
            )}
            {feedProps.kindCounts.update > 0 && (
              <button className="notif-week-seg nk-update" onClick={() => setKindFilter("update")}>{feedProps.kindCounts.update} updated</button>
            )}
          </div>
        </div>
      )}

      {changes.length > 0 && (
        <div className="notif-controls-row">
          <div className="notif-filter-chips">
            {KIND_FILTERS.map(f => {
              const count = feedProps.kindCounts[f.id] ?? 0;
              return (
                <button
                  key={f.id}
                  className={`notif-chip${f.cls ? ` ${f.cls}` : ""}${kindFilter === f.id ? " notif-chip-active" : ""}`}
                  onClick={() => setKindFilter(f.id)}
                >
                  {f.label}{count > 0 && <span className="notif-chip-count">{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="notif-search-box">
            <Search size={12} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search announcements…"
              aria-label="Search announcements"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} title="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="notif-group-toggle">
            <button
              className={groupMode === "date" ? "active" : ""}
              onClick={() => setGroupMode("date")}
            >
              By date
            </button>
            <button
              className={groupMode === "course" ? "active" : ""}
              onClick={() => setGroupMode("course")}
            >
              By course
            </button>
          </div>
        </div>
      )}

      {(mutedCourses.size > 0 || dismissedInScope > 0) && (
        <div className="notif-status-chips">
          {mutedCourses.size > 0 && (
            <span className="notif-status-chip">
              <VolumeX size={11} />
              {[...mutedCourses].map(code => legend?.[code]?.name || code).join(", ")} muted
              <button onClick={() => { toggleMute([...mutedCourses][0]); }}>Unmute</button>
            </span>
          )}
          {dismissedInScope > 0 && (
            <span className="notif-status-chip">
              <EyeOff size={11} />
              {dismissedInScope} hidden
              <button onClick={() => { dismissKeys([...dismissed], "Restored"); undoLast(); }}>Restore</button>
            </span>
          )}
        </div>
      )}

      {changes.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No changes for your subjects"
          action={!showAll && extraCount > 0 && (
            <button className="notif-show-all-link" onClick={() => setShowAll(true)}>
              Show {extraCount} other announcement{extraCount > 1 ? "s" : ""}
            </button>
          )}
        />
      ) : feed.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing in this filter"
          action={
            <button className="notif-show-all-link" onClick={() => setKindFilter("all")}>
              Show all announcements
            </button>
          }
        />
      ) : (
        <div className="notif-feed">
          {!swipeHintSeen && (
            <div className="notif-swipe-hint">
              <span>Tip: swipe a row right to mark read, left to hide.</span>
              <button
                type="button"
                aria-label="Dismiss tip"
                onClick={() => { setSwipeHintSeen(true); try { localStorage.setItem(SWIPE_HINT_KEY, "1"); } catch { } }}
              >
                <X size={13} />
              </button>
            </div>
          )}

          {attnItems.length > 0 && (
            <div className="notif-group">
              <div className="notif-group-label notif-attn-label">
                <span><AlertTriangle size={12} strokeWidth={2.5} /> Needs attention</span>
              </div>
              <ul className="notif-pg-list">
                {attnItems.map(it => renderItem(it, true))}
              </ul>
            </div>
          )}

          {groups.map(({ label, code, items }) => {
            const hasUpdates = groupMode === "course" && items.some(it => it.kind === "update");
            const isOlder = label === "Older" && groupMode === "date";
            const collapsed = isOlder && !olderOpen;
            return (
              <div key={label} className="notif-group">
                <div className="notif-group-label">
                  <span>{label}</span>
                  {isOlder && (
                    <button className="notif-older-toggle" onClick={() => setOlderOpen(o => !o)}>
                      {olderOpen ? "Hide" : `Show ${items.length}`}
                    </button>
                  )}
                  {hasUpdates && (
                    <button
                      className="notif-mute-btn"
                      onClick={() => toggleMute(code)}
                      title={mutedCourses.has(code) ? "Unmute updates for this course" : "Mute routine updates for this course"}
                    >
                      {mutedCourses.has(code) ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      {mutedCourses.has(code) ? "Muted" : "Mute updates"}
                    </button>
                  )}
                </div>
                {!collapsed && (
                  <ul className="notif-pg-list">
                    {items.map(it => renderItem(it))}
                  </ul>
                )}
              </div>
            );
          })}

          {olderHiddenCount > 0 && (
            <button className="notif-show-all-link" onClick={() => setVisibleCount(v => v + FEED_PAGE_SIZE)}>
              <ChevronDown size={13} />
              Show {Math.min(olderHiddenCount, FEED_PAGE_SIZE)} more announcement{olderHiddenCount > 1 ? "s" : ""}
            </button>
          )}

          {!showAll && extraCount > 0 && (
            <button className="notif-show-all-link" onClick={() => setShowAll(true)}>
              <ChevronDown size={13} />
              {extraCount} more announcement{extraCount > 1 ? "s" : ""} from other subjects
            </button>
          )}
        </div>
      )}

      {undo && (
        <div className="notif-undo-toast">
          <span>{undo.kind === "snooze" ? "Snoozed: " : "Hidden: "}{undo.label}</span>
          <button onClick={undoLast}>Undo</button>
        </div>
      )}

      {changes.length > 0 && (
        <>
          <button
            type="button"
            className="notif-fab-search"
            onClick={() => setMobileSearchOpen(v => !v)}
            aria-label={mobileSearchOpen ? "Close search" : "Search announcements"}
          >
            {mobileSearchOpen ? <X size={19} /> : <Search size={18} />}
          </button>
          {mobileSearchOpen && (
            <div className="notif-fab-search-panel">
              <Search size={14} />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search announcements…"
                aria-label="Search announcements"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} title="Clear search">
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
