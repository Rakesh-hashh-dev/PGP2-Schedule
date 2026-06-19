import { useState } from "react";
import { Megaphone } from "lucide-react";

function relTime(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
}

const KIND_LABEL = { added: "Added", removed: "Removed", moved: "Moved", course: "Course", update: "Update" };

export default function NotificationsPage({ allChanges, myChanges }) {
  const [showAll, setShowAll] = useState(false);
  const changes = showAll ? (allChanges || []) : (myChanges || []);

  const hasAnyChanges = allChanges && allChanges.length > 0;

  if (!hasAnyChanges) {
    return (
      <div className="notif-pg">
        <div className="notif-pg-head">
          <Megaphone size={16} />
          <h2>Announcements</h2>
        </div>
        <p className="notif-pg-empty">You're all caught up — no recent announcements.</p>
      </div>
    );
  }

  return (
    <div className="notif-pg">
      <div className="notif-pg-head" style={{ flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Megaphone size={16} />
          <h2>Announcements</h2>
          <span className="notif-pg-count">{changes.length}</span>
        </div>
        <div className="notif-toggles" style={{ marginLeft: "auto", display: "flex", gap: "6px", background: "var(--surface)", padding: "4px", borderRadius: "8px" }}>
          <button 
            onClick={() => setShowAll(false)}
            style={{ 
              padding: "4px 12px", fontSize: "12px", fontWeight: 600, border: "none", borderRadius: "6px", cursor: "pointer",
              background: !showAll ? "var(--ink)" : "transparent",
              color: !showAll ? "#fff" : "var(--muted)",
              transition: "all 0.15s"
            }}
          >
            My Subjects
          </button>
          <button 
            onClick={() => setShowAll(true)}
            style={{ 
              padding: "4px 12px", fontSize: "12px", fontWeight: 600, border: "none", borderRadius: "6px", cursor: "pointer",
              background: showAll ? "var(--ink)" : "transparent",
              color: showAll ? "#fff" : "var(--muted)",
              transition: "all 0.15s"
            }}
          >
            All
          </button>
        </div>
      </div>
      
      {changes.length === 0 ? (
        <p className="notif-pg-empty">No announcements for your subjects.</p>
      ) : (
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
      )}
    </div>
  );
}
