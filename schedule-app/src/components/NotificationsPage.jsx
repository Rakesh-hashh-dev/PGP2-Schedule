import { useState, useEffect, useRef } from "react";
import { Megaphone, PlusCircle, MinusCircle, ArrowRightLeft, BookOpen, Info, ChevronDown, ChevronUp, ChevronRight, CheckCheck, AlertTriangle, Check, EyeOff, Volume2, VolumeX, CheckCircle2, Search, X, CalendarPlus, Settings2, Inbox, BellRing } from "lucide-react";
import { useNotificationState } from "../hooks/useNotificationState.js";
import { useNotificationFeed, FEED_PAGE_SIZE } from "../hooks/useNotificationFeed.js";
import { SwipeRow } from "./notifications/SwipeRow.jsx";
import { PushToggle } from "./notifications/PushToggle.jsx";
import { NotificationPrefsPanel } from "./notifications/NotificationPrefsPanel.jsx";
import CohortPolls from "./notifications/CohortPolls.jsx";
import { EmptyState } from "./ui.jsx";
import { notificationDateParts } from "../lib/notificationWorkspace.js";
import { useBackClose } from "../lib/backClose.js";
import { useDialog } from "../hooks/useDialog.js";

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
  { id: "critical", label: "Cancelled & moved", cls: "nk-removed" },
  { id: "added", label: "Added", cls: "nk-added" },
  { id: "update", label: "Course updates", cls: "nk-update" },
];

function relTime(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

export default function NotificationsPage({ allChanges, myChanges, isAdmin, userId, userName, legend, readChangeKeys, changeKeyOf, onMarkReadMany, onMarkAllRead, onOpenDate, openPrefsSignal, onOpenCalendarExport }) {
  const [pushStatus, setPushStatus] = useState("busy");
  const [activeView, setActiveView] = useState("mine");
  const [kindFilter, setKindFilter] = useState("all");
  const [groupMode, setGroupMode] = useState("date"); // "date" | "course"
  const [expanded, setExpanded] = useState({});
  const [syncState, setSyncState] = useState("idle"); // idle | syncing | synced
  const [query, setQuery] = useState("");
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  useBackClose(() => setShowAlertSettings(false), showAlertSettings);
  const settingsDialogRef = useDialog(showAlertSettings, () => setShowAlertSettings(false));
  const [handledPrefsSignal, setHandledPrefsSignal] = useState(openPrefsSignal);
  const [nowTick, setNowTick] = useState(LOAD_TS);
  const [swipeHintSeen, setSwipeHintSeen] = useState(() => { try { return localStorage.getItem(SWIPE_HINT_KEY) === "1"; } catch { return true; } });
  const [olderOpen, setOlderOpen] = useState(false);

  const syncTimer = useRef(null);
  useEffect(() => () => clearTimeout(syncTimer.current), []);
  if (openPrefsSignal && openPrefsSignal !== handledPrefsSignal) {
    setHandledPrefsSignal(openPrefsSignal);
    setShowAlertSettings(true);
  }
  useEffect(() => {
    if (!showAlertSettings) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [showAlertSettings]);
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const readKeys = readChangeKeys || new Set();
  const keyOf = changeKeyOf || (c => `${c.ts}-${c.code || ""}`);
  const showAll = activeView === "all";

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
    const { affectedWhen, summary } = notificationDateParts(c);
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
                  <strong className="notif-update-summary">{summary}</strong>
                </span>
                <span className="notif-affected-when">{affectedWhen}</span>
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

  const feed = [...attnItems, ...groups.flatMap(g => g.items)];

  return (
    <div className="notif-pg">
      <header className="notif-workspace-head">
        <div className="notif-workspace-copy">
          <span className="notif-eyebrow"><Megaphone size={13} /> Schedule intelligence</span>
          <h1>Announcements</h1>
          <p>Important timetable changes and campus updates, ordered by what needs your attention.</p>
          <div className="notif-workspace-metrics" aria-label="Announcement summary">
            <span className={attnItems.length ? "is-urgent" : ""}><strong>{attnItems.length}</strong> need attention</span>
            <span><strong>{unreadCount}</strong> unread</span>
            <span><strong>{weekTotal}</strong> this week</span>
          </div>
        </div>
        <div className="notif-workspace-actions">
          {syncState !== "idle" && (
            <span className={`notif-sync-pill${syncState === "synced" ? " synced" : ""}`}>
              {syncState === "synced" ? <><Check size={11} strokeWidth={3} /> Synced</> : "Syncing…"}
            </span>
          )}
          {unreadCount > 0 && activeView !== "polls" && (
            <button className="notif-markall notif-markall-primary" onClick={() => trackSync(onMarkAllRead?.())}>
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
          <button className="notif-markall" onClick={() => setShowAlertSettings(true)}>
            <Settings2 size={14} /> Manage alerts
          </button>
        </div>
      </header>

      <nav className="notif-view-tabs" aria-label="Announcement sections">
        <button className={activeView === "mine" ? "is-active" : ""} onClick={() => setActiveView("mine")}><Inbox size={15} /> My subjects</button>
        <button className={activeView === "all" ? "is-active" : ""} onClick={() => setActiveView("all")}><Megaphone size={15} /> All updates</button>
        <button className={activeView === "polls" ? "is-active" : ""} onClick={() => setActiveView("polls")}><BellRing size={15} /> Polls</button>
      </nav>

      {showAlertSettings && (
        <div className="notif-settings-backdrop" onClick={() => setShowAlertSettings(false)}>
          <section className="notif-settings-sheet" ref={settingsDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="notif-settings-title" onClick={e => e.stopPropagation()}>
            <div className="notif-settings-head">
              <div><span className="notif-eyebrow">Delivery preferences</span><h2 id="notif-settings-title">Manage alerts</h2><p>Choose how TermFlow reaches you about timetable changes.</p></div>
              <button className="notif-settings-close" onClick={() => setShowAlertSettings(false)} aria-label="Close alert settings"><X size={18} /></button>
            </div>
            <div className="notif-settings-actions">
              <PushToggle userId={userId} onStatusChange={setPushStatus} />
              {onOpenCalendarExport && <button className="notif-markall" onClick={onOpenCalendarExport}><CalendarPlus size={14} /> Add to Calendar</button>}
            </div>
            {pushStatus === "on" ? <NotificationPrefsPanel userId={userId} openSignal={openPrefsSignal} /> : <div className="notif-settings-note"><BellRing size={17} /><span>Enable push to configure class reminders, morning summaries and cancellation alerts.</span></div>}
          </section>
        </div>
      )}

      {activeView === "polls" ? (
        <CohortPolls userId={userId} userName={userName} isAdmin={isAdmin} showEmpty />
      ) : (
      <>

      {newPillCount > 0 && (
        <button
          type="button"
          className="notif-new-pill"
          onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setNewPillCount(0); }}
        >
          <ChevronUp size={13} /> {newPillCount} new
        </button>
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
          title={showAll ? "No updates available" : "You're all caught up"}
          sub={showAll ? "There are no timetable changes to show." : "No unread changes for your subjects."}
          action={!showAll && extraCount > 0 && (
            <button className="notif-show-all-link" onClick={() => setActiveView("all")}>
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
            <button className="notif-show-all-link" onClick={() => setActiveView("all")}>
              <ChevronDown size={13} />
              {extraCount} more announcement{extraCount > 1 ? "s" : ""} from other subjects
            </button>
          )}
        </div>
      )}
      </>
      )}

      {undo && (
        <div className="notif-undo-toast">
          <span>{undo.kind === "snooze" ? "Snoozed: " : "Hidden: "}{undo.label}</span>
          <button onClick={undoLast}>Undo</button>
        </div>
      )}

    </div>
  );
}
