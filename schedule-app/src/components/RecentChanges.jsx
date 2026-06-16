import { Bell } from "lucide-react";

function relTime(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
}

export default function RecentChanges({ changes }) {
  if (!changes || changes.length === 0) return null;
  return (
    <section className="rc">
      <div className="rc-head">
        <span className="rc-title"><Bell size={14} /> Recent changes</span>
        <span className="rc-count">{changes.length}</span>
      </div>
      <ul className="rc-list">
        {changes.slice(0, 8).map((c) => (
          <li key={c.id} className="rc-item">
            <span className={`rc-dot rc-${c.kind}`} />
            <span className="rc-text">{c.text}</span>
            <span className="rc-time">{relTime(c.ts)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
