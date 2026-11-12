import { useMemo, useState } from "react";
import { CalendarClock, ArrowRight, ChevronDown, SlidersHorizontal } from "lucide-react";
import { sharedTimeSuggestions, hasKnownSchedule } from "../lib/socialPlanning.js";
import { planningCircleOptions, sharedSlotDraft, groupPlanningSlots } from "../lib/planningUi.js";
import SocialBusyBlocks from "./SocialBusyBlocks.jsx";
import { useSocialAvailability } from "../hooks/useSocialAvailability.js";
import { fmtTime12 } from "../lib/datetime.js";

export default function SocialOverviewExtras({ userId, enrolled, friends, groups, allClasses, now, presence, onPlan }) {
  const storageKey = `pgp2.social-suggestions-hidden:${userId}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(storageKey) === "true"; } catch { return false; } });
  const [showAll, setShowAll] = useState(false);
  const [duration, setDuration] = useState(30);
  const [preferredStart, setPreferredStart] = useState("08:00");
  const [preferredEnd, setPreferredEnd] = useState("22:00");
  const [dayType, setDayType] = useState("all");
  const [selectedCircle, setSelectedCircle] = useState("all");
  const availability = useSocialAvailability(userId);
  const circles = planningCircleOptions(friends, groups);
  const circleId = circles.some(circle => circle.id === selectedCircle) ? selectedCircle : "all";
  const suggestions = useMemo(() => sharedTimeSuggestions({ userId, enrolled, friends, groups, allClasses, now, presence, duration, preferredStart, preferredEnd, dayType, circleId, commitments: availability.commitments }), [userId, enrolled, friends, groups, allClasses, now, presence, duration, preferredStart, preferredEnd, dayType, circleId, availability.commitments]);
  const setDismissed = value => { setHidden(value); try { localStorage.setItem(storageKey, String(value)); } catch { /* optional device preference */ } };
  const known = hasKnownSchedule(enrolled, allClasses);
  const selectedFriend = circleId.startsWith("friend:") ? friends.find(friend => `friend:${friend.cloudId}` === circleId) : null;
  const unknown = friends.filter(friend => friend.cloudId && !hasKnownSchedule(friend.courses, allClasses));
  const invalidHours = !preferredStart || !preferredEnd || preferredEnd <= preferredStart || preferredStart < "08:00" || preferredEnd > "22:00";
  const visibleDays = groupPlanningSlots(showAll ? suggestions : suggestions.slice(0, 4));
  const reset = () => { setDuration(30); setPreferredStart("08:00"); setPreferredEnd("22:00"); setDayType("all"); setShowAll(false); };
  const choose = setter => event => { setter(event.target.value); setShowAll(false); };
  return <section className="fr-extra-section fr-planning" aria-labelledby="fr-planning-title">
    <div className="fr-planning-head"><div className="fr-planning-heading"><span className="fr-planning-icon"><CalendarClock size={18} /></span><div><h2 id="fr-planning-title">Plan together</h2><p>Find a time. Review the details. Invite your people.</p></div></div><button type="button" className="fr-text-button" aria-expanded={!hidden} onClick={() => setDismissed(!hidden)}>{hidden ? "Show times" : "Hide times"}<ChevronDown size={14} className={!hidden ? "is-open" : ""} /></button></div>
    {!hidden && <div className="fr-planning-content">
      <div className="fr-planning-subhead"><h3>Shared free time</h3><span>Next 7 days · timetable estimates</span></div>
      <div className="fr-planning-filters">
        <label className="fr-planning-people">Plan with<select className="fr-add-input" value={circleId} onChange={choose(setSelectedCircle)}><option value="all">All friends &amp; circles</option>{circles.filter(circle => circle.id.startsWith("friend:")).length > 0 && <optgroup label="Friends">{circles.filter(circle => circle.id.startsWith("friend:")).map(circle => <option key={circle.id} value={circle.id}>{circle.label}</option>)}</optgroup>}{groups.length > 0 && <optgroup label="Study circles">{circles.filter(circle => circle.id.startsWith("group:")).map(circle => <option key={circle.id} value={circle.id}>{circle.label}</option>)}</optgroup>}</select></label>
        <label>Duration<select className="fr-add-input" value={duration} onChange={event => { setDuration(Number(event.target.value)); setShowAll(false); }}>{[30, 45, 60, 90, 120].map(value => <option key={value} value={value}>{value} min</option>)}</select></label>
        <label>Days<select className="fr-add-input" value={dayType} onChange={choose(setDayType)}><option value="all">Every day</option><option value="weekday">Weekdays</option><option value="weekend">Weekends</option></select></label>
      </div>
      <details className="fr-planning-hours"><summary><SlidersHorizontal size={13} /><span>Preferred hours</span><strong>{fmtTime12(preferredStart) || "—"}–{fmtTime12(preferredEnd) || "—"}</strong><ChevronDown size={13} /></summary><div><label>From<input className="fr-add-input" type="time" min="08:00" max="22:00" step="900" value={preferredStart} onChange={choose(setPreferredStart)} /></label><label>Until<input className="fr-add-input" type="time" min="08:00" max="22:00" step="900" value={preferredEnd} onChange={choose(setPreferredEnd)} /></label></div></details>
      {invalidHours ? <p className="fr-planning-state" role="alert">Choose an end time after your start time, between 8 am and 10 pm.</p> : availability.error ? <div className="fr-planning-state" role="alert"><strong>We couldn’t check your availability.</strong><span>{availability.error}</span><button type="button" className="fr-text-button" onClick={availability.refresh}>Retry availability</button></div> : !availability.loaded ? <p className="fr-planning-state" role="status">Checking your timetable, accepted plans and private busy time…</p> : !known ? <p className="fr-planning-state" role="status">Your timetable is unavailable. Add or refresh your course schedule to find shared time.</p> : !circles.length ? <p className="fr-planning-state" role="status">Connect with friends or create a study circle to find a time together.</p> : selectedFriend && !hasKnownSchedule(selectedFriend.courses, allClasses) ? <p className="fr-planning-state" role="status">{selectedFriend.name}’s timetable is unavailable. Ask them to share or refresh their schedule.</p> : !suggestions.length ? <div className="fr-planning-state" role="status"><strong>No matching time in the next 7 days.</strong><span>Try a shorter duration or wider hours. Circles need shared schedules for all members; reported time away is excluded.</span><button type="button" className="fr-text-button" onClick={reset}>Reset time filters</button></div> : <>
        <div className="fr-planning-days">{visibleDays.map(day => <div className="fr-planning-day" key={day.date}><h4>{new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</h4><div>{day.slots.map(slot => <article className="fr-planning-slot" key={slot.id}><div className="fr-planning-time"><strong>{fmtTime12(slot.start)}–{fmtTime12(slot.end)}</strong><span>{slot.durationMin} min</span></div><div className="fr-planning-person"><strong>{slot.groupName || slot.name}</strong><span>You + {slot.names.join(", ")}</span><small>No known timetable or personal conflicts</small></div><button type="button" className="fr-btn fr-btn-primary fr-btn-small" onClick={() => onPlan(sharedSlotDraft(slot))}>Plan this time <ArrowRight size={13} /></button></article>)}</div></div>)}</div>
        {suggestions.length > 4 && <button type="button" className="fr-text-button fr-planning-more" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? "Show fewer times" : `See all ${suggestions.length} times`}</button>}
      </>}
      <p className="fr-planning-confidence">{availability.loaded ? "Your accepted plans and private blocks are checked." : "Suggestions need your accepted plans and private blocks to finish loading."} Friends’ private commitments are unknown; confirm with them.{unknown.length > 0 && ` ${unknown.length} friend timetable${unknown.length === 1 ? " is" : "s are"} unavailable and excluded.`}</p>
    </div>}
    <SocialBusyBlocks key={userId} userId={userId} availability={availability} />
  </section>;
}
