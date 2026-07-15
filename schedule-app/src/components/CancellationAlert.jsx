import { useMemo, useState } from "react";
import { CalendarX, X } from "lucide-react";
import { scheduleDisruptions, ymd } from "../lib/insights.js";
import "../styles/cancellation.css";

const DISMISS_KEY = "pgp2.dismissed-cancellations";

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY)) || []); } catch { return new Set(); }
}
function saveDismissed(set) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...set])); } catch {}
}

function whenLabel(iso, todayISO, tomorrowISO) {
  if (iso === todayISO) return "today";
  if (iso === tomorrowISO) return "tomorrow";
  return new Date(iso + "T00:00:00").toLocaleDateString([], { weekday: "long" });
}

// In-app banner for the user's own classes that were cancelled in the next
// couple of days. Push delivery for the same events is handled server-side
// (see supabase/functions/class-reminders); this is the always-visible
// fallback that works even if push is off.
export default function CancellationAlert({ allClasses, enrolled, mine, legend, now, onOpen }) {
  const [dismissed, setDismissed] = useState(loadDismissed);

  const disruptions = useMemo(
    () => scheduleDisruptions(allClasses, enrolled, mine, legend, now, 2),
    [allClasses, enrolled, mine, legend, now]
  );

  const active = disruptions.filter((d) => !dismissed.has(d.key));
  if (active.length === 0) return null;

  const todayISO = ymd(now);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = ymd(tomorrow);

  const dismiss = (key) => {
    const next = new Set(dismissed); next.add(key); setDismissed(next); saveDismissed(next);
  };

  return (
    <section className="cx-alert" role="alert">
      <div className="cx-alert-ico"><CalendarX size={18} /></div>
      <div className="cx-alert-body">
        <div className="cx-alert-title">
          {active.length === 1 ? "A class was cancelled" : `${active.length} classes cancelled`}
        </div>
        <ul className="cx-alert-list">
          {active.slice(0, 4).map((d) => (
            <li key={d.key} className="cx-alert-item">
              <button type="button" className="cx-alert-item-btn" onClick={() => onOpen?.(d)}>
                <strong>{d.courseName}</strong>
                <span>{whenLabel(d.date, todayISO, tomorrowISO)}{d.time ? ` · ${d.time}` : ""}</span>
              </button>
              <button type="button" className="cx-alert-dismiss" aria-label="Dismiss" onClick={() => dismiss(d.key)}>
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
