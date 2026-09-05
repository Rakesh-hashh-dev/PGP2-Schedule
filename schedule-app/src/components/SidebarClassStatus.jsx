import { Clock } from "lucide-react";
import { prettyDate } from "../lib/datetime.js";

export default function SidebarClassStatus({ current, todayISO, isArchivedView, onOpen, showSbTip, hideSbTip }) {
  const item = isArchivedView ? null : current;
  if (!item) return null;
  const label = "In class";
  const detail = [item.date !== todayISO ? prettyDate(item.date) : "Today", `${item.start}–${item.end}`, item.room].filter(Boolean).join(" · ");
  const tip = [label, item.name, detail].join(" · ");
  return (
    <button type="button" className="sb-class-status is-live"
      onClick={() => { onOpen?.(item); hideSbTip(); }} aria-label={tip}
      onMouseEnter={e => showSbTip(e, tip)} onMouseLeave={hideSbTip}
      onFocus={e => showSbTip(e, tip)} onBlur={hideSbTip}>
      <Clock size={16} />
      <span className="sb-class-copy"><span className="sb-class-eyebrow">{label}</span>
        <strong title={item.name}>{item.name}</strong>
        <span className="sb-class-detail">{detail}</span>
      </span>
    </button>
  );
}
