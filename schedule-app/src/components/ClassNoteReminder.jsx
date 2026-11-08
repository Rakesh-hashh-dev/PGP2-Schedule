import { useEffect, useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import { sessionKey } from "../lib/attendance.js";
import { reminderHistory, reminderStage } from "../lib/classNoteReminder.js";
import "../styles/class-note-reminder.css";

export default function ClassNoteReminder({ session, now, scope, previous, eligible, onOpen }) {
  const [cloud, setCloud] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const hideTimer = useRef(null);
  const fadeTimer = useRef(null);
  const active = useRef(false);
  const key = sessionKey(session);
  const date = session.date;
  const label = previous ? "Review your last class notes" : "You have saved notes";

  function hide() {
    clearTimeout(hideTimer.current);
    setLeaving(true);
    fadeTimer.current = setTimeout(() => { setCloud(false); setLeaving(false); active.current = false; }, 250);
  }
  function pause() { clearTimeout(hideTimer.current); }
  function resume() {
    if (active.current) { clearTimeout(hideTimer.current); hideTimer.current = setTimeout(hide, 8000); }
  }

  useEffect(() => {
    const check = () => {
      if (!eligible || document.visibilityState === "hidden" || active.current) return;
      const stage = reminderStage(session, now, reminderHistory(scope, date)[key]);
      if (!stage) return;
      reminderHistory(scope, date, { key, record: { entry: true, ...(stage === "soon" ? { soon: true } : {}) } });
      active.current = true;
      setLeaving(false);
      setCloud(true);
      hideTimer.current = setTimeout(hide, 8000);
    };
    const timer = setTimeout(check, 0);
    document.addEventListener("visibilitychange", check);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", check); };
  }, [session, now, scope, date, key, eligible]);

  useEffect(() => () => { clearTimeout(hideTimer.current); clearTimeout(fadeTimer.current); }, []);

  const open = () => {
    reminderHistory(scope, date, { key, record: { opened: true } });
    clearTimeout(hideTimer.current);
    clearTimeout(fadeTimer.current);
    active.current = false;
    setCloud(false);
    onOpen();
  };
  // The icon remains available after the cloud has faded or class has started.
  return <span className="class-note-reminder">
    <button type="button" className="class-note-icon" onClick={open} aria-label={`${label} for ${session.name}`} title={label}><FileText size={15} aria-hidden="true" /><span>Notes</span></button>
    {cloud && eligible && <span className={`class-note-cloud${leaving ? " is-leaving" : ""}`} onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) resume(); }}>
      <button type="button" className="class-note-cloud-open" onClick={open}><FileText size={16} aria-hidden="true" /><span>{label}<strong>View notes →</strong></span></button>
      <button type="button" className="class-note-dismiss" aria-label="Dismiss notes reminder" onClick={hide}><X size={14} aria-hidden="true" /></button>
    </span>}
  </span>;
}
