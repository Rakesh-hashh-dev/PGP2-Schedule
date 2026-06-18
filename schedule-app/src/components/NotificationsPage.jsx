import { Bell } from "lucide-react";

function relTime(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
}

const KIND_LABEL = { added: "Added", removed: "Removed", moved: "Moved", course: "Course", update: "Update" };

export default function NotificationsPage({ changes }) {
  if (!changes || changes.length === 0)
    return (
      <div className="notif-pg">
        <div className="notif-pg-head">
          <Bell size={16} />
          <h2>Notifications</h2>
        </div>
        <p className="notif-pg-empty">You're all caught up — no recent changes.</p>
      </div>
    );

  return (
    <div className="notif-pg">
      <div className="notif-pg-head">
        <Bell size={16} />
        <h2>Notifications</h2>
        <span className="notif-pg-count">{changes.length}</span>
      </div>
      <ul className="notif-pg-list">
        {changes.map((c) => (
          <li key={c.id} className="notif-pg-item">
            <span className={`rc-dot rc-${c.kind}`} />
            <div className="notif-pg-body">
              <span className="notif-pg-text">{c.text}</span>
              {c.kind && <span className={`notif-pg-kind kind-${c.kind}`}>{KIND_LABEL[c.kind] ?? c.kind}</span>}
            </div>
            <span className="notif-pg-time">{relTime(c.ts)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
