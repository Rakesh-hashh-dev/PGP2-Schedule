import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageSquare, BarChart3, CalendarPlus, ArrowRight } from "lucide-react";
import { buildResponseItems, fetchSocialResponses, subscribeGroupActivity } from "../lib/socialActivity.js";
import MeetupTimePoll from "./MeetupTimePoll.jsx";
import { rsvpMeetup, subscribeMeetups, fmtMeetupTime } from "../lib/meetups.js";

export default function SocialActivity({ userId, userName, groups, now, onOpenGroup, meetupsEnabled = true }) {
  const [snapshot, setSnapshot] = useState(null);
  const [timePlanId, setTimePlanId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const loadEpoch = useRef({ request: 0 });
  const groupKey = groups.map(g => `${g.id}:${g.visibility}:${g.inviteMembers?.length || 0}`).sort().join("|");
  const load = useCallback(async () => {
    if (!userId) return;
    const epoch = ++loadEpoch.current.request;
    const result = await fetchSocialResponses(userId, groups, { meetupsEnabled });
    if (epoch === loadEpoch.current.request) setSnapshot({ ...result, userId });
  // Group membership key avoids resubscribing when unrelated group UI changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, groupKey, meetupsEnabled]);
  useEffect(() => {
    if (!userId) return;
    let alive = true; let timer;
    const requests = loadEpoch.current;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { if (alive) load(); }, 100); };
    refresh();
    const stopGroups = subscribeGroupActivity(userId, refresh);
    const stopMeetups = meetupsEnabled ? subscribeMeetups(`${userId}:activity`, refresh) : () => {};
    const onFocus = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("pgp2:social-meetup", refresh); window.addEventListener("pgp2:social-read", refresh); window.addEventListener("focus", onFocus); window.addEventListener("online", refresh); document.addEventListener("visibilitychange", onFocus);
    const interval = setInterval(onFocus, 60000);
    return () => { alive = false; requests.request++; clearTimeout(timer); clearInterval(interval); stopGroups(); stopMeetups(); window.removeEventListener("pgp2:social-meetup", refresh); window.removeEventListener("pgp2:social-read", refresh); window.removeEventListener("focus", onFocus); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", onFocus); };
  }, [userId, load, meetupsEnabled]);
  const currentSnapshot = snapshot?.userId === userId ? snapshot : null;
  const timePlan = currentSnapshot?.meetups?.find(plan => plan.id === timePlanId);
  const loadErrors = Object.values(currentSnapshot?.errors || {}).filter(Boolean);
  const items = useMemo(() => currentSnapshot ? buildResponseItems({ ...currentSnapshot, groups, userId, now }) : [], [currentSnapshot, groups, userId, now]);
  const respond = async (item, response) => {
    setBusy(item.id); setError("");
    try {
      const ok = await rsvpMeetup(item.meetup, userId, userName, response);
      if (!ok) throw new Error("Could not save your response.");
      window.dispatchEvent(new CustomEvent("pgp2:social-meetup"));
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(null); }
  };
  // Supabase channels use a unique suffix; fetches always use the real userId.
  if (!userId) return null;
  const Icons = { meetup: CalendarPlus, chat: MessageSquare, poll: BarChart3 };
  return <section className="fr-extra-section" aria-labelledby="fr-response-title">
    <div className="fr-extra-head"><div><span className="fr-card-kicker">Your next actions</span><h2 id="fr-response-title">Needs your response</h2></div>{items.length > 0 && <span className="fr-count-badge">{items.length}</span>}</div>
    {!currentSnapshot && !error && <p className="fr-extra-help">Checking invitations and group activity…</p>}
    {currentSnapshot && !items.length && !error && !loadErrors.length && <p className="fr-extra-help"><Check size={13} /> You’re all caught up.</p>}
    <div className="fr-response-list">{(showAll ? items : items.slice(0, 3)).map(item => { const Icon = Icons[item.kind]; return <article key={item.id} className="fr-response-row"><Icon size={16} /><div><strong>{item.title}</strong><span>{item.kind === "meetup" ? `${item.detail} · ${fmtMeetupTime(item.date, now)}` : item.detail}</span></div><div className="fr-response-actions">{item.kind === "meetup" ? <><button type="button" className="fr-btn fr-btn-secondary fr-btn-small" disabled={busy === item.id} onClick={() => respond(item, "going")}><Check size={13} />Going</button><button type="button" className="fr-text-button" disabled={busy === item.id} onClick={() => respond(item, "declined")}>Can’t</button><button type="button" className="fr-text-button" onClick={() => setTimePlanId(item.meetup.id)}>Suggest / vote time</button></> : <button type="button" className="fr-btn fr-btn-secondary fr-btn-small" onClick={() => onOpenGroup(item.groupId, item.pollId)}>{item.kind === "poll" ? "Vote" : "Read"}<ArrowRight size={13} /></button>}</div></article>; })}</div>
    {items.length > 3 && <button type="button" className="fr-text-button fr-extra-more" onClick={() => setShowAll(value => !value)} aria-expanded={showAll}>{showAll ? "Show fewer" : `View all ${items.length} actions`}</button>}
    {loadErrors.map(message => <p key={message} className="fr-meetup-error" role="alert">{message} <button type="button" className="fr-text-button" onClick={load}>Retry</button></p>)}
    {error && <p className="fr-meetup-error" role="alert">{error}</p>}
    {timePlanId && meetupsEnabled && <MeetupTimePoll key={`${userId}:${timePlanId}`} meetup={timePlan || { id: timePlanId }} userId={userId} userName={userName} onClose={() => setTimePlanId(null)} onChanged={load} />}
  </section>;
}
