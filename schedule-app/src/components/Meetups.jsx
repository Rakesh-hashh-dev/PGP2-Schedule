import { useState, useEffect, useCallback } from "react";
import { BookOpenCheck, CalendarPlus, Coffee, MapPin, X, Check, Ban, Users, Pencil } from "lucide-react";
import { avatarGradient } from "../lib/friends.js";
import {
  PLACE_PRESETS, fmtMeetupTime, createMeetup, updateMeetup, fetchMyMeetups,
  rsvpMeetup, cancelMeetup, subscribeMeetups,
} from "../lib/meetups.js";
import { EmptyState } from "./ui.jsx";

// Meetup plans (social-plan Phase B): a "Plans" strip at the top of the Social
// page + the creation modal. Entry points: the strip's New-plan button, a
// group card's Plan button, and CompareView free slots — the latter two arrive
// as a prefilled `draft` ({ title?, date?, start?, memberCloudIds?, groupId?,
// groupName? }).

function pad2(n) { return String(n).padStart(2, "0"); }

// Free-slot times arrive as "9:00"; <input type="time"> needs "09:00"
function padTime(t) {
  if (!t || !t.includes(":")) return null;
  const [h, m] = t.split(":");
  return `${pad2(Number(h))}:${pad2(Number(m) || 0)}`;
}

function defaultDateTime(now = new Date()) {
  const d = new Date(now.getTime() + 3600_000);
  d.setMinutes(0, 0, 0);
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:00`,
  };
}

export function MeetupModal({ userId, userName, friends, legend = {}, draft, onCreated, onClose }) {
  const dflt = defaultDateTime();
  let dDraftDate = draft?.date || dflt.date;
  let dDraftTime = draft?.start ? padTime(draft.start) : dflt.time;
  if (draft?.starts_at) {
    const [d, t] = draft.starts_at.split("T");
    dDraftDate = d;
    dDraftTime = t.substring(0, 5); // "HH:MM"
  }

  const existingStudy = draft?.title?.match(/^Study circle · ([A-Z0-9&-]+)(?: — (.*))?$/);
  const [title, setTitle] = useState(existingStudy ? (existingStudy[2] || "Study circle") : (draft?.title || (draft?.id ? "" : "Catch-up")));
  const [planType, setPlanType] = useState(existingStudy ? "study" : "social");
  const [courseCode, setCourseCode] = useState(() => {
    return existingStudy?.[1] || "";
  });
  const [place, setPlace] = useState(draft?.place || "");
  const [date, setDate] = useState(dDraftDate);
  const [time, setTime] = useState(dDraftTime);
  const [selected, setSelected] = useState(() => new Set(draft?.member_ids || draft?.memberCloudIds || []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cloudFriends = friends.filter(f => f.cloudId);
  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const canCreate = (planType === "study" ? courseCode : title.trim()) && date && time && selected.size > 0 && !saving;

  const handleCreate = async () => {
    if (!canCreate) return;
    const startsAt = new Date(`${date}T${time}`);
    if (isNaN(startsAt.getTime())) { setError("Pick a valid date and time."); return; }
    if (startsAt.getTime() < Date.now() - 60_000) { setError("That time is in the past."); return; }
    setSaving(true);
    
    const storedTitle = planType === "study"
      ? `Study circle · ${courseCode}${title.trim() && title.trim() !== "Study circle" ? ` — ${title.trim()}` : ""}`
      : title.trim();
    let row;
    if (draft?.id) {
      row = await updateMeetup(draft.id, {
        title: storedTitle, place, startsAt: startsAt.toISOString(), memberIds: [...selected]
      }, userId);
      setSaving(false);
      if (row) onCreated(row, true);
      else setError("Couldn't update the plan — try again.");
    } else {
      row = await createMeetup({
        userId, userName,
        title: storedTitle, place,
        startsAt: startsAt.toISOString(),
        groupId: draft?.groupId || null,
        groupName: draft?.groupName || null,
        memberIds: [...selected],
      });
      setSaving(false);
      if (row) onCreated(row, false);
      else setError("Couldn't create the plan — try again.");
    }
  };

  return (
    <div className="fr-modal-backdrop" onClick={onClose}>
      <div className="fr-status-modal fr-meetup-modal" onClick={e => e.stopPropagation()}>
        <div className="fr-friends-modal-title-row">
          <h2 className="fr-friends-modal-title">{draft?.id ? "Edit plan" : "New plan"}</h2>
          <button className="fr-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="fr-plan-type" aria-label="Plan type">
          <button className={planType === "social" ? "is-active" : ""} onClick={() => setPlanType("social")}><Coffee size={14} /> Social plan</button>
          <button className={planType === "study" ? "is-active" : ""} onClick={() => { setPlanType("study"); if (title === "Catch-up") setTitle("Study circle"); }}><BookOpenCheck size={14} /> Study circle</button>
        </div>

        {planType === "study" && <label className="fr-study-course">Course<select value={courseCode} onChange={(event) => setCourseCode(event.target.value)}><option value="">Choose a course</option>{Object.entries(legend).map(([code, item]) => <option key={code} value={code}>{code} · {item.name}</option>)}</select></label>}

        <input
          className="fr-add-input"
          type="text"
          placeholder={planType === "study" ? "Topic or goal (optional)" : "What's the plan?"}
          maxLength={80}
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <div className="fr-status-presets">
          {PLACE_PRESETS.map(p => (
            <button
              key={p}
              className={`fr-status-preset ${place === p ? "is-active" : ""}`}
              onClick={() => setPlace(prev => prev === p ? "" : p)}
            >
              <MapPin size={13} /> {p}
            </button>
          ))}
        </div>
        <input
          className="fr-add-input"
          type="text"
          placeholder="Or another place…"
          maxLength={60}
          value={PLACE_PRESETS.includes(place) ? "" : place}
          onChange={e => setPlace(e.target.value)}
        />

        <div className="fr-meetup-when">
          <input className="fr-add-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input className="fr-add-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>

        <div className="fr-meetup-invitees">
          <span className="fr-status-durations-label">Invite ({selected.size})</span>
          {cloudFriends.length === 0 ? (
            <p className="fr-meetup-empty-invitees">Add friends with a cloud code to invite them to plans.</p>
          ) : (
            <div className="fr-meetup-invitee-list">
              {cloudFriends.map(f => {
                const [c1] = avatarGradient(f.name);
                const on = selected.has(f.cloudId);
                return (
                  <button
                    key={f.cloudId}
                    className={`fr-status-preset fr-meetup-invitee ${on ? "is-active" : ""}`}
                    onClick={() => toggle(f.cloudId)}
                  >
                    <span className="fr-meetup-invitee-dot" style={{ background: c1 }} />
                    {f.name.split(" ")[0]}
                    {on && <Check size={12} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && <p className="fr-meetup-error">{error}</p>}

        <div className="fr-status-modal-foot">
          <button className="fr-btn fr-btn-primary" style={{ marginLeft: "auto" }} onClick={handleCreate} disabled={!canCreate}>
            <CalendarPlus size={14} /> {saving ? (draft?.id ? "Updating…" : "Creating…") : (draft?.id ? "Update plan" : "Create plan")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ meetup, rsvps, userId, userName, onChanged, onEdit, showToast }) {
  const isCreator = meetup.created_by === userId;
  const mine = rsvps.find(r => r.user_id === userId)?.response || null;
  const going = rsvps.filter(r => r.response === "going");
  const inviteeCount = (meetup.member_ids || []).length;
  const [confirmCancel, setConfirmCancel] = useState(false);

  const handleRsvp = async (response) => {
    if (mine === response) return;
    const ok = await rsvpMeetup(meetup, userId, userName, response);
    if (ok) { onChanged(); showToast(response === "going" ? "You're in!" : "Marked as can't make it", "success"); }
    else showToast("Couldn't save your RSVP", "error");
  };

  const handleCancel = async () => {
    const ok = await cancelMeetup(meetup, userId, userName);
    if (ok) { onChanged(); showToast("Plan cancelled", "info"); }
    else showToast("Couldn't cancel the plan", "error");
  };

  // Creator + confirmed attendees, capped avatar stack
  const stack = [{ name: meetup.created_by_name || "?" }, ...going.filter(r => r.user_id !== meetup.created_by).map(r => ({ name: r.user_name || "?" }))].slice(0, 4);

  return (
    <div className={`fr-plan-card ${mine === "declined" ? "is-declined" : ""}`}>
      <div className="fr-plan-when">{fmtMeetupTime(meetup.starts_at)}</div>
      <div className="fr-plan-body">
        <span className="fr-plan-title">{meetup.title}</span>
        <span className="fr-plan-meta">
          {meetup.place && <><MapPin size={11} /> {meetup.place} · </>}
          <Users size={11} /> {going.length + 1}/{inviteeCount + 1} in
          {meetup.group_name && <> · {meetup.group_name}</>}
        </span>
      </div>
      <div className="fr-plan-stack" title={stack.map(s => s.name).join(", ")}>
        {stack.map((s, i) => {
          const [c1, c2] = avatarGradient(s.name);
          return (
            <span key={i} className="fr-plan-avatar" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
              {s.name[0]?.toUpperCase()}
            </span>
          );
        })}
      </div>
      <div className="fr-plan-actions">
        {isCreator ? (
          confirmCancel ? (
            <>
              <button className="fr-btn fr-btn-small fr-plan-btn-no" onClick={handleCancel}>Confirm</button>
              <button className="fr-btn fr-btn-small" onClick={() => setConfirmCancel(false)}>Keep</button>
            </>
          ) : (
            <>
              <button className="fr-btn fr-btn-icon" title="Edit plan" onClick={() => onEdit(meetup)}>
                <Pencil size={14} />
              </button>
              <button className="fr-btn fr-btn-icon" title="Cancel plan" onClick={() => setConfirmCancel(true)}>
                <Ban size={14} />
              </button>
            </>
          )
        ) : (
          <>
            <button className={`fr-btn fr-btn-small fr-plan-btn-go ${mine === "going" ? "is-active" : ""}`} onClick={() => handleRsvp("going")}>
              <Check size={13} /> Going
            </button>
            <button className={`fr-btn fr-btn-small fr-plan-btn-no ${mine === "declined" ? "is-active" : ""}`} onClick={() => handleRsvp("declined")}>
              Can&rsquo;t
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function MeetupsStrip({ userId, userName, friends, legend, draft, onDraftConsumed, showToast }) {
  const [data, setData] = useState({ meetups: [], rsvpsByMeetup: {} });
  const [modalDraft, setModalDraft] = useState(null); // null = closed, {} = blank
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(() => {
    if (!userId) return;
    fetchMyMeetups(userId).then(d => { setData(d); setLoaded(true); });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchMyMeetups(userId).then(d => { setData(d); setLoaded(true); });
    return subscribeMeetups(userId, refetch);
  }, [userId, refetch]);

  // A prefilled draft arriving from CompareView / a group card opens the modal.
  // Deferred a tick: consuming the draft synchronously inside the effect both
  // trips the set-state-in-effect lint and re-renders the parent mid-effect.
  useEffect(() => {
    if (!draft) return;
    const id = setTimeout(() => { setModalDraft(draft); onDraftConsumed?.(); }, 0);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  if (!userId) return null;

  return (
    <section className="fr-plans-section">
      <div className="fr-section-header">
        <h3 className="fr-section-title"><CalendarPlus size={15} /> Plans</h3>
        <button className="fr-btn fr-btn-secondary fr-btn-small" style={{ borderRadius: 20 }} onClick={() => setModalDraft({})}>
          <CalendarPlus size={13} /> New plan
        </button>
      </div>

      {loaded && data.meetups.length === 0 ? (
        <EmptyState compact icon={CalendarPlus} sub="No upcoming plans — make one from a free slot in Compare, or hit New plan." />
      ) : (
        <div className="fr-plan-list">
          {data.meetups.map(m => (
            <PlanCard
              key={m.id}
              meetup={m}
              rsvps={data.rsvpsByMeetup[m.id] || []}
              userId={userId}
              userName={userName}
              onChanged={refetch}
              onEdit={setModalDraft}
              showToast={showToast}
            />
          ))}
        </div>
      )}

      {modalDraft !== null && (
        <MeetupModal
          userId={userId}
          userName={userName}
          friends={friends}
          legend={legend}
          draft={modalDraft}
          onCreated={(row, isUpdate) => { setModalDraft(null); refetch(); showToast(isUpdate ? "Plan updated" : "Plan created — invites sent", "success"); }}
          onClose={() => setModalDraft(null)}
        />
      )}
    </section>
  );
}
