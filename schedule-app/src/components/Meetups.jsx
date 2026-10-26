import { useState, useEffect, useCallback, useMemo } from "react";
import { CalendarPlus, MapPin, X, Check, Ban, Users, Pencil, Clock, Repeat2, AlertTriangle } from "lucide-react";
import { avatarGradient } from "../lib/friends.js";
import { PLACE_PRESETS, fmtMeetupTime, createMeetupSeries, updateMeetup, fetchMyMeetups, rsvpMeetup, cancelMeetup, subscribeMeetups } from "../lib/meetups.js";
import { PLAN_TEMPLATES, buildOccurrences, findPlanConflicts, localDate } from "../lib/socialPlanning.js";
import { fmtTime12 } from "../lib/datetime.js";
import { EmptyState } from "./ui.jsx";
import { useBackClose } from "../lib/backClose.js";
import { useDialog } from "../hooks/useDialog.js";

function defaultDateTime(now) {
  const date = new Date(now.getTime() + 3600000); date.setMinutes(0, 0, 0);
  return { date: localDate(date), time: `${String(date.getHours()).padStart(2, "0")}:00` };
}
function initialDateTime(draft, now) {
  if (draft?.starts_at) {
    const date = new Date(draft.starts_at);
    return { date: localDate(date), time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` };
  }
  const initial = defaultDateTime(now);
  return { date: draft?.date || initial.date, time: draft?.start ? draft.start.split(":").map(n => String(Number(n)).padStart(2, "0")).join(":") : initial.time };
}

export function MeetupModal({ userId, userName, friends, draft, onCreated, onClose, allClasses = [], enrolled = {}, now = new Date() }) {
  useBackClose(onClose);
  const dialogRef = useDialog(true, onClose);
  const initial = initialDateTime(draft, now);
  const [title, setTitle] = useState(draft?.title || "Catch-up");
  const [place, setPlace] = useState(draft?.place || "");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState(draft?.ends_at ? Math.round((new Date(draft.ends_at) - new Date(draft.starts_at)) / 60000) : draft?.duration || 60);
  const [templateId, setTemplateId] = useState(draft?.template_id || "");
  const [repeatCount, setRepeatCount] = useState(1);
  const [selected, setSelected] = useState(() => new Set((draft?.member_ids || draft?.memberCloudIds || []).filter(id => id !== userId)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [acknowledged, setAcknowledged] = useState("");
  const cloudFriends = useMemo(() => [...new Map([...friends.filter(f => f.cloudId), ...[...selected].filter(id => !friends.some(f => f.cloudId === id)).map((id, i) => ({ cloudId: id, name: draft?.inviteeNames?.[id] || `Group member ${i + 1}` }))].map(f => [f.cloudId, f])).values()], [friends, selected, draft]);
  const occurrences = useMemo(() => { try { return buildOccurrences(date, time, Number(duration), Number(repeatCount)); } catch { return []; } }, [date, time, duration, repeatCount]);
  const scheduleCheck = useMemo(() => findPlanConflicts(occurrences, [{ name: "You", courses: enrolled }, ...[...selected].map(id => ({ name: cloudFriends.find(f => f.cloudId === id)?.name || "Group member", courses: friends.find(f => f.cloudId === id)?.courses }))], allClasses), [occurrences, enrolled, selected, cloudFriends, friends, allClasses]);
  const clashKey = JSON.stringify(scheduleCheck.conflicts);
  const canCreate = title.trim() && selected.size > 0 && occurrences.length > 0 && !saving && (!scheduleCheck.conflicts.length || acknowledged === clashKey);
  const toggle = id => setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const applyTemplate = template => { setTemplateId(template.id); setTitle(template.title); setPlace(template.place); setDuration(Math.min(template.duration, draft?.durationMin || 240)); };
  const handleCreate = async event => {
    event.preventDefault(); if (!canCreate) return;
    if (new Date(occurrences[0].startsAt).getTime() < Date.now() - 60000) { setError("That time is in the past."); return; }
    setSaving(true); setError("");
    try {
      const common = { title, place, memberIds: [...selected], templateId: templateId || null };
      if (draft?.id) {
        const row = await updateMeetup(draft.id, { ...common, ...occurrences[0] }, userId);
        if (!row) throw new Error("Could not update the plan. Please try again.");
        onCreated(row, true, 1);
      } else {
        const rows = await createMeetupSeries({ ...common, userId, userName, occurrences, groupId: draft?.groupId || null, groupName: draft?.groupName || null });
        onCreated(rows[0], false, rows.length);
      }
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <div className="fr-modal-backdrop" onClick={onClose}><form className="fr-status-modal fr-meetup-modal" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="fr-meetup-title" onClick={e => e.stopPropagation()} onSubmit={handleCreate}>
    <div className="fr-friends-modal-title-row"><h2 id="fr-meetup-title" className="fr-friends-modal-title">{draft?.id ? "Edit plan" : "New plan"}</h2><button type="button" className="fr-modal-close" onClick={onClose} aria-label="Close plan editor"><X size={18} /></button></div>
    {!draft?.id && <div className="fr-plan-templates" aria-label="Plan templates">{PLAN_TEMPLATES.map(template => <button type="button" className={`fr-status-preset${templateId === template.id ? " is-active" : ""}`} key={template.id} aria-pressed={templateId === template.id} onClick={() => applyTemplate(template)}>{template.title}<small>{template.duration} min</small></button>)}</div>}
    <label>Plan title<input className="fr-add-input" required maxLength={80} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <div className="fr-status-presets" aria-label="Suggested locations">{PLACE_PRESETS.map(p => <button type="button" key={p} className={`fr-status-preset${place === p ? " is-active" : ""}`} onClick={() => setPlace(previous => previous === p ? "" : p)}><MapPin size={13} />{p}</button>)}</div>
    <label>Location<input className="fr-add-input" maxLength={60} value={place} onChange={e => setPlace(e.target.value)} placeholder="Choose a place or enter one" /></label>
    <div className="fr-meetup-when"><label>Date<input className="fr-add-input" required type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>Start time<input className="fr-add-input" required type="time" value={time} onChange={e => setTime(e.target.value)} /></label></div>
    <div className="fr-meetup-when"><label>Duration (minutes)<input className="fr-add-input" required type="number" min={15} max={240} step={1} value={duration} onChange={e => setDuration(e.target.value)} /></label><div className="fr-plan-end"><Clock size={14} /><span>Ends {occurrences[0] ? `${new Date(occurrences[0].endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${localDate(new Date(occurrences[0].endsAt)) !== date ? " next day" : ""}` : "—"}</span></div></div>
    {!draft?.id && <label>Repeat<select className="fr-add-input" aria-label="Repeat" value={repeatCount} onChange={e => setRepeatCount(Number(e.target.value))}><option value={1}>Once</option>{[2, 3, 4, 6, 8].map(count => <option key={count} value={count}>Weekly · {count} occurrences</option>)}</select></label>}
    {draft?.series_id && <p className="fr-extra-help">Editing this occurrence only. Other weeks keep their own time and RSVPs.</p>}
    {repeatCount > 1 && <p className="fr-extra-help">Last occurrence: {new Date(occurrences.at(-1)?.startsAt || date).toLocaleDateString([], { day: "numeric", month: "short" })}. Each week has its own RSVP.</p>}
    <div className="fr-meetup-invitees"><span className="fr-status-durations-label">Invite ({selected.size})</span>{cloudFriends.length ? <div className="fr-meetup-invitee-list">{cloudFriends.map(friend => <button type="button" key={friend.cloudId} aria-pressed={selected.has(friend.cloudId)} className={`fr-status-preset fr-meetup-invitee${selected.has(friend.cloudId) ? " is-active" : ""}`} onClick={() => toggle(friend.cloudId)}><span className="fr-meetup-invitee-dot" style={{ background: avatarGradient(friend.name)[0] }} />{friend.name}{selected.has(friend.cloudId) && <Check size={12} />}</button>)}</div> : <p className="fr-meetup-empty-invitees">Add friends with accounts to invite them.</p>}</div>
    {scheduleCheck.conflicts.length > 0 && <div className="fr-plan-clashes" role="status"><strong><AlertTriangle size={14} /> Class clashes</strong>{scheduleCheck.conflicts.slice(0, 6).map((clash, index) => <span key={`${clash.name}:${clash.date}:${clash.start}:${index}`}>{clash.name} · {clash.code} · {clash.date} · {fmtTime12(clash.start)}–{fmtTime12(clash.end)}</span>)}{scheduleCheck.conflicts.length > 6 && <span>+{scheduleCheck.conflicts.length - 6} more clashes</span>}<label className="fr-check-label"><input type="checkbox" checked={acknowledged === clashKey} onChange={e => setAcknowledged(e.target.checked ? clashKey : "")} /> Keep this time despite the clashes</label></div>}
    {scheduleCheck.unknown.length > 0 && <p className="fr-extra-help">Schedule unavailable for {scheduleCheck.unknown.join(", ")}. Confirm their availability directly.</p>}
    {error && <p className="fr-meetup-error" role="alert">{error}</p>}
    <div className="fr-status-modal-foot"><button type="submit" className="fr-btn fr-btn-primary" disabled={!canCreate}><CalendarPlus size={14} />{saving ? "Saving…" : draft?.id ? "Update plan" : repeatCount > 1 ? `Create ${repeatCount} weekly plans` : "Create plan"}</button></div>
  </form></div>;
}

function PlanCard({ meetup, rsvps, userId, userName, onChanged, onEdit, showToast, now }) {
  const isCreator = meetup.created_by === userId;
  const mine = rsvps.find(r => r.user_id === userId)?.response || null;
  const going = rsvps.filter(r => r.response === "going" && r.user_id !== meetup.created_by);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const handleRsvp = async response => { if (mine === response || busy) return; setBusy(true); const ok = await rsvpMeetup(meetup, userId, userName, response); setBusy(false); if (ok) { onChanged(); window.dispatchEvent(new CustomEvent("pgp2:social-meetup")); showToast(response === "going" ? "You're in!" : "Marked as can't make it", "success"); } else showToast("Couldn't save your RSVP", "error"); };
  const handleCancel = async () => { setBusy(true); const ok = await cancelMeetup(meetup, userId, userName); setBusy(false); if (ok) { onChanged(); window.dispatchEvent(new CustomEvent("pgp2:social-meetup")); showToast("Occurrence cancelled", "info"); } else showToast("Couldn't cancel the plan", "error"); };
  const stack = [{ name: meetup.created_by_name || "?" }, ...going.map(r => ({ name: r.user_name || "?" }))].slice(0, 4);
  return <article className={`fr-plan-card${mine === "declined" ? " is-declined" : ""}`}>
    <div className="fr-plan-when">{fmtMeetupTime(meetup.starts_at, now)}{meetup.ends_at && <small>Until {new Date(meetup.ends_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {Math.round((new Date(meetup.ends_at) - new Date(meetup.starts_at)) / 60000)} min</small>}{meetup.series_id && <small><Repeat2 size={11} />Weekly · occurrence {meetup.series_index + 1}</small>}</div>
    <div className="fr-plan-body"><span className="fr-plan-title">{meetup.title}</span><span className="fr-plan-meta">{meetup.place && <><MapPin size={11} />{meetup.place} · </>}<Users size={11} />{going.length + 1}/{(meetup.member_ids || []).length + 1} in{meetup.group_name && <> · {meetup.group_name}</>}</span></div>
    <div className="fr-plan-stack" title={stack.map(s => s.name).join(", ")}>{stack.map((s, index) => <span key={index} className="fr-plan-avatar" style={{ background: avatarGradient(s.name)[0] }}>{s.name[0]?.toUpperCase()}</span>)}</div>
    <div className="fr-plan-actions">{isCreator ? confirmCancel ? <><button type="button" className="fr-btn fr-btn-small fr-plan-btn-no" disabled={busy} onClick={handleCancel}>Cancel occurrence</button><button type="button" className="fr-btn fr-btn-small" onClick={() => setConfirmCancel(false)}>Keep</button></> : <><button type="button" className="fr-btn fr-btn-icon" aria-label={`Edit ${meetup.title}`} onClick={() => onEdit(meetup)}><Pencil size={14} /></button><button type="button" className="fr-btn fr-btn-icon" aria-label={`Cancel ${meetup.title}`} onClick={() => setConfirmCancel(true)}><Ban size={14} /></button></> : <><button type="button" disabled={busy} className={`fr-btn fr-btn-small fr-plan-btn-go${mine === "going" ? " is-active" : ""}`} onClick={() => handleRsvp("going")}><Check size={13} />Going</button><button type="button" disabled={busy} className={`fr-btn fr-btn-small fr-plan-btn-no${mine === "declined" ? " is-active" : ""}`} onClick={() => handleRsvp("declined")}>Can’t</button></>}</div>
  </article>;
}

export default function MeetupsStrip({ userId, userName, friends, draft, onDraftConsumed, showToast, allClasses, enrolled, now = new Date() }) {
  const [data, setData] = useState({ meetups: [], rsvpsByMeetup: {} });
  const [modalDraft, setModalDraft] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const refetch = useCallback(async () => { if (!userId) return; try { const result = await fetchMyMeetups(userId, { strict: true }); setData(result); setLoaded(true); setError(""); } catch (err) { setError(err.message); } }, [userId]);
  useEffect(() => { let alive = true; fetchMyMeetups(userId, { strict: true }).then(result => { if (alive) { setData(result); setLoaded(true); } }).catch(err => { if (alive) setError(err.message); }); const stop = subscribeMeetups(userId, refetch); window.addEventListener("pgp2:social-meetup", refetch); return () => { alive = false; stop(); window.removeEventListener("pgp2:social-meetup", refetch); }; }, [userId, refetch]);
  useEffect(() => { if (!draft) return; const id = setTimeout(() => { setModalDraft(draft); onDraftConsumed?.(); }, 0); return () => clearTimeout(id); }, [draft, onDraftConsumed]);
  if (!userId) return null;
  return <section className="fr-plans-section"><div className="fr-section-header"><h3 className="fr-section-title"><CalendarPlus size={15} />Upcoming plans</h3><button type="button" className="fr-btn fr-btn-secondary fr-btn-small" onClick={() => setModalDraft({})}><CalendarPlus size={13} />New plan</button></div>
    {error && <p className="fr-meetup-error" role="alert">{error} <button type="button" className="fr-text-button" onClick={refetch}>Retry</button></p>}
    {!loaded && !error && <p className="fr-extra-help">Loading plans…</p>}
    {loaded && !data.meetups.length ? <EmptyState compact icon={CalendarPlus} sub="No upcoming plans — choose a common timetable gap or create a plan." /> : <div className="fr-plan-list">{(showAll ? data.meetups : data.meetups.slice(0, 3)).map(meetup => <PlanCard key={meetup.id} meetup={meetup} rsvps={data.rsvpsByMeetup[meetup.id] || []} userId={userId} userName={userName} onChanged={refetch} onEdit={setModalDraft} showToast={showToast} now={now} />)}</div>}
    {data.meetups.length > 3 && <button type="button" className="fr-text-button fr-extra-more" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? "Show fewer plans" : `View all ${data.meetups.length} plans`}</button>}
    {modalDraft !== null && <MeetupModal userId={userId} userName={userName} friends={friends} draft={modalDraft} allClasses={allClasses} enrolled={enrolled} now={now} onClose={() => setModalDraft(null)} onCreated={(row, isUpdate, count) => { setModalDraft(null); refetch(); window.dispatchEvent(new CustomEvent("pgp2:social-meetup")); showToast(isUpdate ? "Plan updated" : count > 1 ? `${count} weekly plans created — invites sent` : "Plan created — invites sent", "success"); }} />}
  </section>;
}