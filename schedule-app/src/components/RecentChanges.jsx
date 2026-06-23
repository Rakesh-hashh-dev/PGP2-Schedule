import { Bell } from "lucide-react";

const PREVIEW = 5;

function relTime(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
}

export default function RecentChanges({ changes, readKeys, onMarkRead, onViewAll }) {
  if (!changes || changes.length === 0) return null;

  const changeKey = c => `${c.ts}-${c.code || ""}`;
  const visible = changes.slice(0, PREVIEW);

  return (
    <section className="rc">
      <div className="rc-head">
        <span className="rc-title"><Bell size={14} /> Recent changes</span>
        <span className="rc-count">{changes.length}</span>
      </div>
      <ul className="rc-list">
        {visible.map((c) => {
          const isRead = readKeys?.has(changeKey(c));
          return (
            <li key={c.id} className={`rc-item rc-item-clickable${isRead ? " rc-item-read" : ""}`} onClick={() => onMarkRead?.(c)}>
              <span className={`rc-dot rc-${c.kind}`} />
              <span className="rc-text">{c.text}</span>
              <span className="rc-time">{relTime(c.ts)}</span>
              {isRead && <span className="rc-read-check">✓</span>}
            </li>
          );
        })}
      </ul>
      {changes.length > PREVIEW && onViewAll && (
        <button className="rc-view-all" onClick={onViewAll}>
          View all {changes.length} notifications
        </button>
      )}
    </section>
  );
}
