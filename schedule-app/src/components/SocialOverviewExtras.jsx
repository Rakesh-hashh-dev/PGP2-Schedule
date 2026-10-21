import { useMemo, useState } from "react";
import { CalendarClock, ArrowRight, X } from "lucide-react";
import { sharedTimeSuggestions } from "../lib/socialPlanning.js";
import { fmtTime12 } from "../lib/datetime.js";

export default function SocialOverviewExtras({ userId, enrolled, friends, groups, allClasses, now, presence, onPlan }) {
  const storageKey = `pgp2.social-suggestions-hidden:${userId}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(storageKey) === "true"; } catch { return false; } });
  const [showAll, setShowAll] = useState(false);
  const suggestions = useMemo(() => sharedTimeSuggestions({ userId, enrolled, friends, groups, allClasses, now, presence }), [userId, enrolled, friends, groups, allClasses, now, presence]);
  const setDismissed = value => { setHidden(value); try { localStorage.setItem(storageKey, String(value)); } catch { /* optional device preference */ } };
  if (!suggestions.length) return null;
  if (hidden) return <button type="button" className="fr-text-button fr-extras-restore" onClick={() => setDismissed(false)}><CalendarClock size={14} /> Show shared free-time suggestions</button>;
  return (
    <section className="fr-extra-section" aria-labelledby="fr-shared-time-title">
      <div className="fr-extra-head"><div><span className="fr-card-kicker">Plan together</span><h2 id="fr-shared-time-title">Shared free time</h2></div><button type="button" className="fr-btn fr-btn-icon" aria-label="Dismiss shared free-time suggestions" onClick={() => setDismissed(true)}><X size={15} /></button></div>
      <p className="fr-extra-help">Common timetable gaps over the next three days. Confirm availability with your friends.</p>
      <div className="fr-shared-slots">{(showAll ? suggestions : suggestions.slice(0, 3)).map(slot => (
        <article key={slot.id} className="fr-shared-slot"><div><strong>{slot.name}</strong><span>{new Date(`${slot.date}T12:00:00`).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · {fmtTime12(slot.start)}–{fmtTime12(slot.end)}</span><small>You + {slot.names.length} friend{slot.names.length === 1 ? "" : "s"} · {slot.durationMin} min without scheduled classes</small></div><button type="button" className="fr-btn fr-btn-secondary fr-btn-small" onClick={() => onPlan({ ...slot, title: slot.groupName || "Catch-up", duration: Math.min(60, slot.durationMin) })}>Plan together <ArrowRight size={13} /></button></article>
      ))}</div>
      {suggestions.length > 3 && <button type="button" className="fr-text-button fr-extra-more" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? "Show fewer" : `View all ${suggestions.length} suggestions`}</button>}
    </section>
  );
}