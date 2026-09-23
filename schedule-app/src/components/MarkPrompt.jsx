import { useState } from "react";
import { Check, X, ClipboardCheck } from "lucide-react";
import { sessionKey, isExamSession } from "../lib/attendance.js";
import { fmtTime12 } from "../lib/datetime.js";

function clsEnd(c) {
  const [Y, Mo, D] = c.date.split("-").map(Number);
  const [h, m] = c.end.split(":").map(Number);
  return new Date(Y, Mo - 1, D, h, m);
}

/**
 * One-tap "Were you in X?" card shown on Today above the timeline for classes
 * that have ended but are still unmarked. Disappears as sessions get marked;
 * "Later" hides it until the next class ends (or next app open).
 */
export default function MarkPrompt({ list, now, attendance, markAttendance }) {
  const [dismissedCount, setDismissedCount] = useState(null);

  if (!markAttendance) return null;
  const pending = list.filter(
    (c) => c.type === "class" && !isExamSession(c) && clsEnd(c) <= now && !attendance[sessionKey(c)]
  );
  if (pending.length === 0) return null;
  // "Later" hides the card until another class ends (pending count grows)
  if (dismissedCount !== null && pending.length <= dismissedCount) return null;

  return (
    <section className="mark-prompt" aria-label="Unmarked attendance">
      <div className="mark-prompt-head">
        <span className="mark-prompt-title">
          <ClipboardCheck size={15} />
          {pending.length === 1 ? "Were you in this class?" : `${pending.length} classes to mark`}
        </span>
        <button className="mark-prompt-later" onClick={() => setDismissedCount(pending.length)}>
          Later
        </button>
      </div>
      {pending.map((c) => (
        <div key={sessionKey(c)} className="mark-prompt-row">
          <div className="mark-prompt-info">
            <span className="mark-prompt-name">{c.name}</span>
            <span className="mark-prompt-meta">{fmtTime12(c.start)}–{fmtTime12(c.end)}{c.room ? ` · ${c.room}` : ""}</span>
          </div>
          <div className="att-btns">
            <button className="att-b present" onClick={() => markAttendance(c, "present")} aria-label={`Mark present for ${c.name}`}>
              <Check size={15} />
            </button>
            <button className="att-b absent" onClick={() => markAttendance(c, "absent")} aria-label={`Mark absent for ${c.name}`}>
              <X size={15} />
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
