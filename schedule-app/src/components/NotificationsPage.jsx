import { useState, useEffect, useRef } from "react";
import { Megaphone, PlusCircle, MinusCircle, ArrowRightLeft, BookOpen, Info, ChevronDown, ChevronUp, ChevronRight, Bell, BellOff, Sunrise, CheckCheck, AlertTriangle, Check, EyeOff, Volume2, VolumeX, CheckCircle2, Clock, Search, X } from "lucide-react";
import { pushSupported, pushConfigured, getPushSubscription, subscribeToPush, unsubscribeFromPush, getReminderPrefs, setReminderPrefs } from "../lib/push.js";
import { getNotifPrefs, setNotifPrefs } from "../lib/profile.js";

const DISMISSED_KEY = "pgp2.notif-dismissed-keys";
const MUTED_KEY = "pgp2.notif-muted-courses";
const SNOOZED_KEY = "pgp2.notif-snoozed";
const SWIPE_HINT_KEY = "pgp2.notif-swipe-hint-seen";
const FEED_PAGE_SIZE = 30;
// Module-load timestamp seeds the clock state; the interval keeps it fresh.
// (Snooze granularity is hours, so a slightly stale seed is harmless.)
const LOAD_TS = Date.now();
function loadSet(key) { try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch { return new Set(); } }
function saveSet(key, set) { try { localStorage.setItem(key, JSON.stringify([...set])); } catch { } }
function loadMap(key) { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; } }
function saveMap(key, map) { try { localStorage.setItem(key, JSON.stringify(map)); } catch { } }

// Load the snooze map and drop entries whose wake time has passed,
// so the stored map doesn't grow forever
function loadSnoozed() {
  const map = loadMap(SNOOZED_KEY);
  let pruned = false;
  for (const k of Object.keys(map)) {
    if (!(map[k] > Date.now())) { delete map[k]; pruned = true; }
  }
  if (pruned) saveMap(SNOOZED_KEY, map);
  return map;
}

function relTime(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

// One day before the change's target date, or immediately if that's already past
function snoozeWakeTime(change) {
  if (!change?.date) return Date.now() + 12 * 60 * 60 * 1000; // no date to anchor to — just re-surface in 12h
  const target = new Date(change.date + "T06:00:00").getTime() - 24 * 60 * 60 * 1000;
  return Math.max(target, Date.now() + 60 * 60 * 1000);
}

function getDateLabel(iso) {
  const now = new Date();
  const d = new Date(iso);
  const diffDays = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
  // Clock skew can put a fresh announcement slightly in the future
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  return "Older";
}

const KIND_META = {
  added:   { Icon: PlusCircle,      label: "Added",     cls: "nk-added"   },
  removed: { Icon: MinusCircle,     label: "Cancelled", cls: "nk-removed" },
  moved:   { Icon: ArrowRightLeft,  label: "Shifted",   cls: "nk-moved"   },
  course:  { Icon: BookOpen,        label: "Course",    cls: "nk-course"  },
  update:  { Icon: Info,            label: "Updated",   cls: "nk-update"  },
};

function groupByDate(items) {
  const groups = {};
  const ORDER = ["Today", "Yesterday", "This Week", "Older"];
  for (const it of items) {
    const label = getDateLabel(it.ts);
    if (!groups[label]) groups[label] = [];
    groups[label].push(it);
  }
  return ORDER.filter(l => groups[l]).map(l => ({ label: l, items: groups[l] }));
}

function groupByCourse(items, legend) {
  const byCode = {};
  for (const it of items) {
    const code = it.code || "";
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push(it);
  }
  const codes = Object.keys(byCode).sort((a, b) => {
    const na = legend?.[a]?.name || a || "zzz";
    const nb = legend?.[b]?.name || b || "zzz";
    return na.localeCompare(nb);
  });
  return codes.map(code => ({
    label: legend?.[code]?.name || code || "Other",
    code,
    items: byCode[code].sort((a, b) => new Date(b.ts) - new Date(a.ts)),
  }));
}

const KIND_VERB = { added: "added", removed: "cancelled", moved: "shifted", course: "renamed", update: "updated" };
// Kinds worth surfacing in the pinned "Needs attention" section while unread
const ATTN_KINDS = new Set(["added", "removed", "moved", "course"]);
const KIND_FILTERS = [
  { id: "all", label: "All" },
  { id: "removed", label: "Cancelled", cls: "nk-removed" },
  { id: "moved", label: "Moved", cls: "nk-moved" },
  { id: "added", label: "Added", cls: "nk-added" },
  { id: "update", label: "Updates", cls: "nk-update" },
];
const BUNDLE_MIN = 3;
const BUNDLE_WINDOW_MS = 15 * 60 * 1000;
// Max rows pinned in the "Needs attention" section
const ATTN_MAX = 5;

// Collapse same course + kind changes from one sync batch into a single
// expandable bundle; everything else stays a plain row. Items don't need to
// be adjacent — a batch sync interleaves courses when sorted by target date,
// so we gather matches from anywhere within the time window.
function buildFeed(changes) {
  const items = [];
  const used = new Set();
  for (let i = 0; i < changes.length; i++) {
    if (used.has(i)) continue;
    const c = changes[i];
    const runIdx = [i];
    if (c.code) {
      for (let j = i + 1; j < changes.length; j++) {
        if (used.has(j)) continue;
        if (
          changes[j].code === c.code &&
          changes[j].kind === c.kind &&
          Math.abs(new Date(changes[j].ts) - new Date(c.ts)) < BUNDLE_WINDOW_MS
        ) runIdx.push(j);
      }
    }
    if (runIdx.length >= BUNDLE_MIN) {
      runIdx.forEach(k => used.add(k));
      items.push({ type: "bundle", id: "b-" + c.id, kind: c.kind, code: c.code, ts: c.ts, changes: runIdx.map(k => changes[k]) });
    } else {
      items.push({ type: "single", id: c.id, kind: c.kind, code: c.code, ts: c.ts, change: c });
    }
  }
  return items;
}

const SWIPE_THRESHOLD = 68;

// Generic swipe wrapper: right = quick action (mark read), left = dismiss/hide.
// Mirrors the gesture used on Assignments task rows for a consistent feel.
function SwipeRow({ onSwipeRight, onSwipeLeft, extraAction, className = "", children }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const justSwiped = useRef(false);
  const clickGuardTimer = useRef(null);
  const rowRef = useRef(null);

  useEffect(() => () => clearTimeout(clickGuardTimer.current), []);

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, axis: null, moved: false };
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dxNow = e.clientX - d.startX;
    const dyNow = e.clientY - d.startY;
    if (!d.axis) {
      if (Math.abs(dxNow) < 8 && Math.abs(dyNow) < 8) return;
      d.axis = Math.abs(dxNow) > Math.abs(dyNow) ? "x" : "y";
      if (d.axis === "x") rowRef.current?.setPointerCapture?.(e.pointerId);
    }
    if (d.axis !== "x") return;
    d.moved = true;
    const maxLeft = onSwipeLeft ? 120 : 0;
    const maxRight = onSwipeRight ? 120 : 0;
    setDx(Math.max(-maxLeft, Math.min(maxRight, dxNow)));
  };

  const onPointerEnd = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d || !d.moved) return;
    // Suppress the ghost click that follows a drag — but only briefly, since
    // on touch the click may never fire and a stale flag would eat the next tap
    justSwiped.current = true;
    clearTimeout(clickGuardTimer.current);
    clickGuardTimer.current = setTimeout(() => { justSwiped.current = false; }, 350);
    if (dx > SWIPE_THRESHOLD && onSwipeRight) {
      onSwipeRight();
    } else if (dx < -SWIPE_THRESHOLD && onSwipeLeft) {
      setDx(0);
      onSwipeLeft();
      return;
    }
    setDx(0);
  };

  const capture = (fn) => (e) => {
    if (justSwiped.current) { justSwiped.current = false; return; }
    fn?.(e);
  };

  return (
    <div className={`notif-swipe-wrap${extraAction ? " has-snooze" : ""}${dragging || dx !== 0 ? " swiping" : ""}`}>
      {(onSwipeRight || onSwipeLeft) && (
        <div className={`notif-swipe-bg ${dx > 0 ? 'show-read' : dx < 0 ? 'show-hide' : ''}`}>
          <span className="notif-swipe-ico read"><Check size={16} strokeWidth={3} /></span>
          <span className="notif-swipe-ico hide"><EyeOff size={15} /></span>
        </div>
      )}
      <div
        ref={rowRef}
        className={className}
        style={{ transform: dx ? `translateX(${dx}px)` : "none", transition: dragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {typeof children === "function" ? children(capture) : children}
      </div>
      {extraAction && (
        <div className="notif-extra-actions">
          <button type="button" className="notif-snooze-btn" data-tip={extraAction.title} onClick={(e) => { e.stopPropagation(); extraAction.onClick(); }}>
            <Clock size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// Shared push subscription state + toggle logic, reused by the announcements
// header pill (PushToggle) and the mobile overflow menu (PushMenuItem).
function usePushStatus(userId, onStatusChange) {
  // 'unsupported' | 'denied' | 'off' | 'on' | 'busy'
  const [status, setStatusRaw] = useState("busy");
  const setStatus = (s) => { setStatusRaw(s); onStatusChange?.(s); };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported() || !pushConfigured()) return setStatus("unsupported");
      if (Notification.permission === "denied") return setStatus("denied");
      const sub = await getPushSubscription().catch(() => null);
      if (!cancelled) setStatus(sub ? "on" : "off");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    if (status === "busy" || status === "denied") return;
    const prev = status;
    setStatus("busy");
    try {
      if (prev === "on") {
        await unsubscribeFromPush();
        setStatus("off");
      } else {
        await subscribeToPush(userId);
        setStatus("on");
      }
    } catch (e) {
      setStatus(Notification.permission === "denied" ? "denied" : prev);
      if (Notification.permission !== "denied") alert(e.message || "Could not update push notifications.");
    }
  }

  return { status, toggle };
}

function PushToggle({ userId, onStatusChange }) {
  const { status, toggle } = usePushStatus(userId, onStatusChange);

  if (status === "unsupported") return null;

  const label = status === "on" ? "Push on" : status === "denied" ? "Push blocked" : "Enable push";
  return (
    <button
      className={`notif-push-toggle${status === "on" ? " notif-push-on" : ""}`}
      onClick={toggle}
      disabled={status === "busy" || status === "denied"}
      aria-label={label}
      title={status === "denied" ? "Notifications are blocked in your browser settings" : "Get push alerts for schedule changes and announcements"}
    >
      {status === "on" ? <Bell size={13} /> : <BellOff size={13} />}
      <span className="notif-btn-label">{label}</span>
    </button>
  );
}

const LEAD_OPTIONS = [15, 30, 60];

function ReminderBar({ userId }) {
  const [prefs, setPrefs] = useState(null); // { enabled, leadMinutes }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getReminderPrefs(userId).then(p => { if (!cancelled) setPrefs(p); }).catch(() => {
      if (!cancelled) setPrefs({ enabled: true, leadMinutes: 30 });
    });
    return () => { cancelled = true; };
  }, [userId]);

  if (!prefs) return null;

  async function save(next) {
    const prev = prefs;
    setPrefs(next);
    setSaving(true);
    try {
      await setReminderPrefs(userId, next);
    } catch (e) {
      setPrefs(prev);
      alert(e.message || "Could not save reminder settings.");
    }
    setSaving(false);
  }

  return (
    <div className="reminder-bar">
      <div className="reminder-row">
        <span className="reminder-bar-label">
          <Bell size={13} /> Class reminders
        </span>
        <div className="reminder-seg" role="radiogroup" aria-label="Class reminder lead time">
          <button
            className={`reminder-seg-btn${!prefs.enabled ? " reminder-seg-active" : ""}`}
            disabled={saving}
            onClick={() => save({ ...prefs, enabled: false })}
          >
            Off
          </button>
          {LEAD_OPTIONS.map(min => (
            <button
              key={min}
              className={`reminder-seg-btn${prefs.enabled && prefs.leadMinutes === min ? " reminder-seg-active" : ""}`}
              disabled={saving}
              onClick={() => save({ ...prefs, enabled: true, leadMinutes: min })}
            >
              {min}m
            </button>
          ))}
        </div>
        <span className="reminder-bar-hint">
          {prefs.enabled ? `Notified ${prefs.leadMinutes} min before each of your classes` : "No class reminders"}
        </span>
      </div>
      <div className="reminder-row">
        <span className="reminder-bar-label">
          <Sunrise size={13} /> Morning summary
        </span>
        <div className="reminder-seg" role="radiogroup" aria-label="Morning summary">
          <button
            className={`reminder-seg-btn${!prefs.dailySummary ? " reminder-seg-active" : ""}`}
            disabled={saving}
            onClick={() => save({ ...prefs, dailySummary: false })}
          >
            Off
          </button>
          <button
            className={`reminder-seg-btn${prefs.dailySummary ? " reminder-seg-active" : ""}`}
            disabled={saving}
            onClick={() => save({ ...prefs, dailySummary: true })}
          >
            On
          </button>
        </div>
        {prefs.dailySummary && (
          <input
            type="time"
            className="reminder-time"
            value={prefs.summaryTime}
            min="06:30"
            max="22:00"
            step={300}
            disabled={saving}
            onChange={e => {
              const t = e.target.value;
              if (t) save({ ...prefs, summaryTime: t });
            }}
            aria-label="Summary time"
          />
        )}
        <span className="reminder-bar-hint">
          {prefs.dailySummary ? `Your day's classes, every morning at ${prefs.summaryTime}` : "No morning digest"}
        </span>
      </div>
    </div>
  );
}

export default function NotificationsPage({ allChanges, myChanges, isAdmin, userId, legend, readChangeKeys, changeKeyOf, onMarkReadMany, onMarkAllRead, onOpenDate }) {
  const [pushStatus, setPushStatus] = useState("busy");
  const [showAll, setShowAll] = useState(false);
  const [kindFilter, setKindFilter] = useState("all");
  const [groupMode, setGroupMode] = useState("date"); // "date" | "course"
  const [expanded, setExpanded] = useState({});
  const [dismissed, setDismissed] = useState(() => loadSet(DISMISSED_KEY));
  const [mutedCourses, setMutedCourses] = useState(() => loadSet(MUTED_KEY));
  const [snoozed, setSnoozed] = useState(loadSnoozed); // key -> wake-at ms
  const [syncState, setSyncState] = useState("idle"); // idle | syncing | synced
  const [undo, setUndo] = useState(null); // { keys, label }
  const [query, setQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);
  const [nowTick, setNowTick] = useState(LOAD_TS);
  const [swipeHintSeen, setSwipeHintSeen] = useState(() => { try { return localStorage.getItem(SWIPE_HINT_KEY) === "1"; } catch { return true; } });
  const [olderOpen, setOlderOpen] = useState(false);
  const [newPillCount, setNewPillCount] = useState(0);
  const undoTimer = useRef(null);
  const syncTimer = useRef(null);
  const prevChangeIdsRef = useRef(null);

  useEffect(() => () => { clearTimeout(undoTimer.current); clearTimeout(syncTimer.current); }, []);

  // Clear the "N new" pill once the user scrolls back near the top themselves
  useEffect(() => {
    if (newPillCount === 0) return;
    const onScroll = () => { if (window.scrollY < 100) setNewPillCount(0); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [newPillCount]);

  // Keep relative timestamps ("5m ago") fresh while the tab sits open
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Reset pagination whenever the filter context changes (render-adjust
  // pattern instead of an effect, per react-hooks/set-state-in-effect)
  const filterSig = `${kindFilter}|${groupMode}|${query}|${showAll}`;
  const [prevFilterSig, setPrevFilterSig] = useState(filterSig);
  if (filterSig !== prevFilterSig) {
    setPrevFilterSig(filterSig);
    setVisibleCount(FEED_PAGE_SIZE);
  }

  // Pull dismissed/muted prefs from the cloud once on load and merge with
  // whatever this device already has locally, so a fresh device/browser
  // picks up mutes/hides set elsewhere. Last-write-wins from here on: every
  // local toggle overwrites the cloud row with the full current set.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getNotifPrefs(userId).then(cloud => {
      if (cancelled || !cloud) return;
      if (cloud.dismissedKeys?.length) {
        setDismissed(prev => {
          const merged = new Set([...prev, ...cloud.dismissedKeys]);
          saveSet(DISMISSED_KEY, merged);
          return merged;
        });
      }
      if (cloud.mutedCourses?.length) {
        setMutedCourses(prev => {
          const merged = new Set([...prev, ...cloud.mutedCourses]);
          saveSet(MUTED_KEY, merged);
          return merged;
        });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  const readKeys = readChangeKeys || new Set();
  const keyOf = changeKeyOf || (c => `${c.ts}-${c.code || ""}`);
  // Admins see admin_only items in the All view; regular users never do
  const visibleAll = isAdmin ? (allChanges || []) : (allChanges || []).filter(c => !c.admin_only);
  const changes = showAll ? visibleAll : (myChanges || []);
  const hasAnyChanges = allChanges && allChanges.length > 0;

  // Detect items that appeared since the last render (poll refresh, admin
  // action) while the user is scrolled down, and surface a "N new" pill
  // instead of letting them silently appear above the fold.
  useEffect(() => {
    const ids = new Set(changes.map(keyOf));
    if (prevChangeIdsRef.current) {
      const added = [...ids].filter(id => !prevChangeIdsRef.current.has(id));
      if (added.length > 0 && window.scrollY > 200) {
        setNewPillCount(n => n + added.length);
      }
    }
    prevChangeIdsRef.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changes]);

  function trackSync(promise) {
    setSyncState("syncing");
    clearTimeout(syncTimer.current);
    // Local read-state updates resolve almost instantly, which made "Syncing…"
    // flash for a few ms and skip straight to "Synced" — hold each phase for
    // a fixed minimum so the pill is actually visible.
    Promise.resolve(promise).then(() => {
      syncTimer.current = setTimeout(() => {
        setSyncState("synced");
        syncTimer.current = setTimeout(() => setSyncState("idle"), 3000);
      }, 500);
    }).catch(() => setSyncState("idle"));
  }

  function dismissKeys(keys, label) {
    const next = new Set([...dismissed, ...keys]);
    setDismissed(next);
    saveSet(DISMISSED_KEY, next);
    setNotifPrefs(userId, { dismissedKeys: [...next] });
    clearTimeout(undoTimer.current);
    setUndo({ kind: "dismiss", keys, label });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }

  function undoLast() {
    if (!undo) return;
    if (undo.kind === "snooze") {
      const next = { ...snoozed };
      if (undo.prevWake) next[undo.key] = undo.prevWake; else delete next[undo.key];
      setSnoozed(next);
      saveMap(SNOOZED_KEY, next);
    } else {
      const next = new Set(dismissed);
      undo.keys.forEach(k => next.delete(k));
      setDismissed(next);
      saveSet(DISMISSED_KEY, next);
      setNotifPrefs(userId, { dismissedKeys: [...next] });
    }
    setUndo(null);
    clearTimeout(undoTimer.current);
  }

  function toggleMute(code) {
    if (!code) return;
    const next = new Set(mutedCourses);
    if (next.has(code)) next.delete(code); else next.add(code);
    setMutedCourses(next);
    saveSet(MUTED_KEY, next);
    setNotifPrefs(userId, { mutedCourses: [...next] });
  }

  function snoozeItem(key, change) {
    const prevWake = snoozed[key];
    const next = { ...snoozed, [key]: snoozeWakeTime(change) };
    setSnoozed(next);
    saveMap(SNOOZED_KEY, next);
    clearTimeout(undoTimer.current);
    setUndo({ kind: "snooze", key, prevWake, label: change?.text || "Snoozed until closer to the date" });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }

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
        {pushStatus === "on" && <ReminderBar userId={userId} />}
        <div className="notif-pg-empty">
          <div className="notif-empty-ico"><CheckCircle2 size={26} /></div>
          <p>You're all caught up</p>
          <span>No recent announcements for your subjects.</span>
        </div>
      </div>
    );
  }

  const myCount = (myChanges || []).length;
  // Count only what this user could actually see in the All view,
  // so "N more announcements" never overpromises for non-admins
  const extraCount = Math.max(0, visibleAll.length - myCount);
  const unreadCount = changes.filter(c => !readKeys.has(keyOf(c))).length;
  const dismissedInScope = changes.filter(c => dismissed.has(keyOf(c))).length;

  const q = query.trim().toLowerCase();
  const matchesKind = (k) =>
    kindFilter === "all" ? true : kindFilter === "update" ? (k === "update" || k === "course") : k === kindFilter;
  // Passes everything the active kindFilter would, minus the kind check itself —
  // used to count how many rows each filter chip would surface if tapped.
  const passesBaseFilters = (c) =>
    !dismissed.has(keyOf(c)) &&
    !(c.kind === "update" && c.code && mutedCourses.has(c.code)) &&
    (!q || c.text?.toLowerCase().includes(q) || (legend?.[c.code]?.name || c.code || "").toLowerCase().includes(q));
  const kindCounts = { all: 0, added: 0, removed: 0, moved: 0, update: 0 };
  const WEEK_AGO = nowTick - 7 * 24 * 60 * 60 * 1000;
  const weekCounts = { added: 0, removed: 0, moved: 0, update: 0 };
  for (const c of changes) {
    if (!passesBaseFilters(c)) continue;
    kindCounts.all++;
    const bucket = c.kind === "course" ? "update" : c.kind;
    if (kindCounts[bucket] !== undefined) kindCounts[bucket]++;
    if (bucket !== undefined && weekCounts[bucket] !== undefined && new Date(c.ts).getTime() >= WEEK_AGO) weekCounts[bucket]++;
  }
  const weekTotal = weekCounts.added + weekCounts.removed + weekCounts.moved + weekCounts.update;
  const visible = changes.filter(c => matchesKind(c.kind) && passesBaseFilters(c));
  const feed = buildFeed(visible);
  const isUnreadItem = (it) =>
    it.type === "bundle" ? it.changes.some(c => !readKeys.has(keyOf(c))) : !readKeys.has(keyOf(it.change));
  const isSnoozed = (it) => {
    const wake = snoozed[it.id];
    return wake && nowTick < wake;
  };

  // Unread cancellations / moves / additions get pinned above the fold,
  // unless the user snoozed that specific one until closer to the date.
  // Capped so a big sync batch doesn't swallow the whole feed into one
  // flat section (which also made the group toggle look like a no-op).
  const attnItems = feed
    .filter(it => ATTN_KINDS.has(it.kind) && isUnreadItem(it) && !isSnoozed(it))
    .slice(0, ATTN_MAX);
  const attnIds = new Set(attnItems.map(it => it.id));
  const rest = feed.filter(it => !attnIds.has(it.id));
  const groupsAll = groupMode === "course" ? groupByCourse(rest, legend) : groupByDate(rest);
  // Paginate across all groups (works in both date and course mode)
  const totalRows = groupsAll.reduce((n, g) => n + g.items.length, 0);
  const groups = [];
  let remaining = visibleCount;
  for (const g of groupsAll) {
    if (remaining <= 0) break;
    groups.push(g.items.length <= remaining ? g : { ...g, items: g.items.slice(0, remaining) });
    remaining -= g.items.length;
  }
  const olderHiddenCount = Math.max(0, totalRows - visibleCount);

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
              // "Sat 18 Jul · 14:30 — Course Name added (A01)" → lead with the
              // date/time; drop the course name the bundle header already shows
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

      {pushStatus === "on" && <ReminderBar userId={userId} />}

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
            {weekCounts.added > 0 && (
              <button className="notif-week-seg nk-added" onClick={() => setKindFilter("added")}>{weekCounts.added} added</button>
            )}
            {weekCounts.removed > 0 && (
              <button className="notif-week-seg nk-removed" onClick={() => setKindFilter("removed")}>{weekCounts.removed} cancelled</button>
            )}
            {weekCounts.moved > 0 && (
              <button className="notif-week-seg nk-moved" onClick={() => setKindFilter("moved")}>{weekCounts.moved} shifted</button>
            )}
            {weekCounts.update > 0 && (
              <button className="notif-week-seg nk-update" onClick={() => setKindFilter("update")}>{weekCounts.update} updated</button>
            )}
          </div>
        </div>
      )}

      {changes.length > 0 && (
        <div className="notif-controls-row">
          <div className="notif-filter-chips">
            {KIND_FILTERS.map(f => {
              const count = kindCounts[f.id] ?? 0;
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
              <button onClick={() => { setMutedCourses(new Set()); saveSet(MUTED_KEY, new Set()); setNotifPrefs(userId, { mutedCourses: [] }); }}>Unmute</button>
            </span>
          )}
          {dismissedInScope > 0 && (
            <span className="notif-status-chip">
              <EyeOff size={11} />
              {dismissedInScope} hidden
              <button onClick={() => { setDismissed(new Set()); saveSet(DISMISSED_KEY, new Set()); setNotifPrefs(userId, { dismissedKeys: [] }); }}>Restore</button>
            </span>
          )}
        </div>
      )}

      {changes.length === 0 ? (
        <div className="notif-pg-empty">
          <div className="notif-empty-ico"><CheckCircle2 size={26} /></div>
          <p>No changes for your subjects</p>
          {!showAll && extraCount > 0 && (
            <button className="notif-show-all-link" onClick={() => setShowAll(true)}>
              Show {extraCount} other announcement{extraCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
      ) : feed.length === 0 ? (
        <div className="notif-pg-empty">
          <div className="notif-empty-ico"><CheckCircle2 size={26} /></div>
          <p>Nothing in this filter</p>
          <button className="notif-show-all-link" onClick={() => setKindFilter("all")}>
            Show all announcements
          </button>
        </div>
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
            // "Older" starts collapsed — it's rarely actionable and otherwise
            // pads out the initial scroll with stale items.
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

          {/* Subtle "show all" prompt at the bottom when in My view */}
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

      {/* Mobile only: the inline search box collapses awkwardly next to the
          filter chips on narrow screens, so it's replaced by this floating
          button + panel (CSS hides one or the other per breakpoint). */}
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
