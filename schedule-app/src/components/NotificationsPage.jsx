import { useState, useEffect } from "react";
import { Megaphone, PlusCircle, MinusCircle, ArrowRightLeft, BookOpen, Info, ChevronDown, Bell, BellOff, Sunrise } from "lucide-react";
import { pushSupported, pushConfigured, getPushSubscription, subscribeToPush, unsubscribeFromPush, getReminderPrefs, setReminderPrefs } from "../lib/push.js";

function relTime(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
}

function getDateLabel(iso) {
  const now = new Date();
  const d = new Date(iso);
  const diffDays = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  return "Older";
}

const KIND_META = {
  added:   { Icon: PlusCircle,      label: "Added",   cls: "nk-added"   },
  removed: { Icon: MinusCircle,     label: "Removed", cls: "nk-removed" },
  moved:   { Icon: ArrowRightLeft,  label: "Moved",   cls: "nk-moved"   },
  course:  { Icon: BookOpen,        label: "Course",  cls: "nk-course"  },
  update:  { Icon: Info,            label: "Update",  cls: "nk-update"  },
};

function groupByDate(changes) {
  const groups = {};
  const ORDER = ["Today", "Yesterday", "This Week", "Older"];
  for (const c of changes) {
    const label = getDateLabel(c.ts);
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  }
  return ORDER.filter(l => groups[l]).map(l => ({ label: l, items: groups[l] }));
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
      title={status === "denied" ? "Notifications are blocked in your browser settings" : "Get push alerts for schedule changes and announcements"}
    >
      {status === "on" ? <Bell size={13} /> : <BellOff size={13} />}
      {label}
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

export default function NotificationsPage({ allChanges, myChanges, isAdmin, userId }) {
  const [pushStatus, setPushStatus] = useState("busy");
  const [showAll, setShowAll] = useState(false);
  // Admins see admin_only items in the All view; regular users never do
  const visibleAll = isAdmin ? (allChanges || []) : (allChanges || []).filter(c => !c.admin_only);
  const changes = showAll ? visibleAll : (myChanges || []);
  const hasAnyChanges = allChanges && allChanges.length > 0;

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
          <span className="notif-empty-icon">🎉</span>
          <p>You're all caught up</p>
          <span>No recent announcements for your subjects.</span>
        </div>
      </div>
    );
  }

  const groups = groupByDate(changes);
  const myCount = (myChanges || []).length;
  const allCount = (allChanges || []).length;
  const extraCount = allCount - myCount;

  return (
    <div className="notif-pg">
      {/* Header */}
      <div className="notif-pg-head">
        <div className="notif-pg-head-title">
          <Megaphone size={18} strokeWidth={2} />
          <h2>Announcements</h2>
          {changes.length > 0 && (
            <span className="notif-pg-count">{changes.length}</span>
          )}
        </div>
        <div className="notif-pg-head-controls">
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

      {changes.length === 0 ? (
        <div className="notif-pg-empty">
          <span className="notif-empty-icon">✨</span>
          <p>No changes for your subjects</p>
          {!showAll && extraCount > 0 && (
            <button className="notif-show-all-link" onClick={() => setShowAll(true)}>
              Show {extraCount} other announcement{extraCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
      ) : (
        <div className="notif-feed">
          {groups.map(({ label, items }) => (
            <div key={label} className="notif-group">
              <div className="notif-group-label">{label}</div>
              <ul className="notif-pg-list">
                {items.map((c) => {
                  const meta = KIND_META[c.kind] || { Icon: Info, label: c.kind || "Update", cls: "nk-update" };
                  const { Icon, cls } = meta;
                  return (
                    <li key={c.id} className={`notif-pg-item ${cls}${c.admin_only ? " nk-admin-only" : ""}`}>
                      <div className="notif-item-icon-wrap">
                        <Icon size={14} strokeWidth={2.5} />
                      </div>
                      <div className="notif-pg-body">
                        <span className="notif-pg-text">{c.text}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flex: "none" }}>
                        <span className="notif-pg-time">{relTime(c.ts)}</span>
                        {c.admin_only && isAdmin && (
                          <span className="notif-admin-badge">admin only</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Subtle "show all" prompt at the bottom when in My view */}
          {!showAll && extraCount > 0 && (
            <button className="notif-show-all-link" onClick={() => setShowAll(true)}>
              <ChevronDown size={13} />
              {extraCount} more announcement{extraCount > 1 ? "s" : ""} from other subjects
            </button>
          )}
        </div>
      )}
    </div>
  );
}
