import { useState } from "react";
import { Megaphone, PlusCircle, MinusCircle, ArrowRightLeft, BookOpen, Info, ChevronDown } from "lucide-react";

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

export default function NotificationsPage({ allChanges, myChanges, isAdmin }) {
  const [showAll, setShowAll] = useState(false);
  // Admins see admin_only items in the All view; regular users never do
  const visibleAll = isAdmin ? (allChanges || []) : (allChanges || []).filter(c => !c.admin_only);
  const changes = showAll ? visibleAll : (myChanges || []);
  const hasAnyChanges = allChanges && allChanges.length > 0;

  if (!hasAnyChanges) {
    return (
      <div className="notif-pg">
        <div className="notif-pg-head">
          <Megaphone size={18} strokeWidth={2} />
          <h2>Announcements</h2>
        </div>
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
        <div style={{ display: "flex", alignItems: "center", gap: "9px", flex: 1, minWidth: 0 }}>
          <Megaphone size={18} strokeWidth={2} />
          <h2>Announcements</h2>
          {changes.length > 0 && (
            <span className="notif-pg-count">{changes.length}</span>
          )}
        </div>
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
