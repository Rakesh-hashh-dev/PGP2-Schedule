import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useBackClose } from "../lib/backClose.js";
import { useDialog } from "../hooks/useDialog.js";
import { fmtMeetupTime, subscribeMeetups } from "../lib/meetups.js";
import { applyMeetupTime, fetchTimePoll, proposeMeetupTimes, voteMeetupTime } from "../lib/meetupProposals.js";

export default function MeetupTimePoll(props) {
  return <TimePoll key={`${props.userId}:${props.meetup.id}`} {...props} />;
}

function TimePoll({ meetup: initialMeetup, userId, userName, onClose, onChanged }) {
  useBackClose(onClose);
  const dialogRef = useDialog(true, onClose);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const lifecycle = useRef({ mounted: false, request: 0 });
  const meetupId = initialMeetup.id;
  const meetup = snapshot?.meetup;
  const rows = snapshot?.rows;
  const ready = Boolean(meetup && !loading);
  const [times, setTimes] = useState([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tieChoice, setTieChoice] = useState(null);
  const organizer = meetup?.created_by === userId;
  const load = useCallback(async () => {
    const state = lifecycle.current;
    if (!state.mounted) return;
    const request = ++state.request;
    setLoading(true);
    try {
      const result = await fetchTimePoll(meetupId, userId);
      if (!state.mounted || request !== state.request) return;
      setSnapshot(result); setError(""); setTieChoice(null);
    } catch (err) {
      if (!state.mounted || request !== state.request) return;
      setSnapshot(null); setError(err.message);
    } finally { if (state.mounted && request === state.request) setLoading(false); }
  }, [meetupId, userId]);
  useEffect(() => {
    const state = lifecycle.current;
    state.mounted = true;
    const refresh = () => { if (state.mounted) load(); };
    const onFocus = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = setTimeout(refresh, 0);
    const stop = subscribeMeetups(`${userId}:time-poll:${meetupId}`, refresh);
    const interval = setInterval(onFocus, 30000);
    window.addEventListener("pgp2:social-meetup", refresh);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      state.mounted = false; state.request++;
      clearTimeout(timer); clearInterval(interval); stop();
      window.removeEventListener("pgp2:social-meetup", refresh);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load, userId, meetupId]);
  const save = async (action, closeAfter = false) => {
    if (busy || !ready) return;
    setBusy(true); setError("");
    try {
      await action();
      if (!lifecycle.current.mounted) return;
      setTieChoice(null); await onChanged?.();
      if (!lifecycle.current.mounted) return;
      if (closeAfter) onClose(); else await load();
    } catch (err) { if (lifecycle.current.mounted) setError(err.message); }
    finally { if (lifecycle.current.mounted) setBusy(false); }
  };
  const apply = row => save(() => applyMeetupTime(meetupId, row.id, tieChoice === row.id), true);
  return <div className="fr-modal-backdrop" onClick={onClose}><div className="fr-status-modal fr-meetup-modal" role="dialog" aria-modal="true" aria-labelledby="fr-time-poll-title" tabIndex={-1} ref={dialogRef} onClick={event => event.stopPropagation()}>
    <div className="fr-friends-modal-title-row"><h2 id="fr-time-poll-title" className="fr-friends-modal-title">Find a time{meetup ? ` · ${meetup.title}` : ""}</h2><button type="button" className="fr-modal-close" onClick={onClose} aria-label="Close time poll"><X size={18} /></button></div>
    {meetup && <p className="fr-extra-help">Current plan: {fmtMeetupTime(meetup.starts_at)}. Suggest another time or vote for one option. You can change your vote. The organizer confirms the winner; everyone RSVPs again if the time changes.</p>}
    {loading && <p role="status">Refreshing plan and time options…</p>}
    {rows?.length === 0 && <p className="fr-extra-help">No alternative times yet. Add one below, or add several to start a time poll.</p>}
    <div className="fr-plan-list">{rows?.map(row => <div key={row.id} className="fr-response-row"><div><strong>{fmtMeetupTime(row.starts_at)}</strong><span>{row.proposed_by_name} · {row.count} {row.count === 1 ? "vote" : "votes"}{row.winning ? row.tied ? " · tied winner" : " · leading" : ""}</span></div><div className="fr-response-actions"><button type="button" className="fr-btn fr-btn-secondary fr-btn-small" aria-pressed={row.mine} disabled={busy || !ready || row.mine} onClick={() => save(() => voteMeetupTime(meetupId, row.id))}>{row.mine ? "Voted" : "Vote"}</button>{organizer && row.winning && <button type="button" className="fr-btn fr-btn-primary fr-btn-small" disabled={busy || !ready} onClick={() => row.tied && tieChoice !== row.id ? setTieChoice(row.id) : apply(row)}>{row.tied && tieChoice !== row.id ? "Choose tied time" : "Confirm time"}</button>}</div>{tieChoice === row.id && <p className="fr-extra-help" role="status">These options are tied. Confirm time to choose this tied winner and request fresh RSVPs.</p>}</div>)}</div>
    {organizer && rows?.length > 0 && !rows.some(row => row.winning) && <p className="fr-extra-help">At least one vote is needed before you can confirm a time.</p>}
    <form onSubmit={event => { event.preventDefault(); save(async () => { await proposeMeetupTimes(meetupId, times, userName); if (lifecycle.current.mounted) setTimes([""]); }); }}>
      {times.map((time, index) => <label key={index}>Alternative time {index + 1}<input type="datetime-local" className="fr-add-input" required disabled={busy || !ready} value={time} onChange={event => setTimes(previous => previous.map((value, i) => i === index ? event.target.value : value))} /></label>)}
      <div className="fr-status-modal-foot">{times.length < 6 && <button type="button" className="fr-text-button" disabled={busy || !ready} onClick={() => setTimes(previous => [...previous, ""])}>Add another option</button>}<button type="submit" className="fr-btn fr-btn-primary" disabled={busy || !ready}>{busy ? "Saving…" : times.length > 1 ? "Share time poll" : "Suggest time"}</button></div>
    </form>
    {error && <p className="fr-meetup-error" role="alert">{error} <button type="button" className="fr-text-button" disabled={busy || loading} onClick={load}>Reload options</button></p>}
  </div></div>;
}
