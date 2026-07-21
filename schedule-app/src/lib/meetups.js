import { supabase } from "./supabase.js";

// Meetup plans — time + place + one-tap RSVPs. Rows live in `meetups` /
// `meetup_rsvps` (see migration 20260719140000_meetups.sql). Invites, RSVP
// notices and cancellations are client-inserted `notifications` rows (scoped
// RLS pins data.from_id to the caller); the T-15min reminder is inserted
// server-side by the class-reminders sweep so it hits the inbox at fire time.

export const PLACE_PRESETS = ["Mess", "Library", "Amul", "Sports Complex", "Hostel"];

export function fmtMeetupTime(startsAtISO, now = new Date()) {
  const d = new Date(startsAtISO);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  const time = `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(d, now)) return `Today · ${time}`;
  if (sameDay(d, tomorrow)) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}

async function notifyMeetup(targetUserId, type, meetup, fromId, fromName, extra = {}) {
  if (!targetUserId || targetUserId === fromId) return;
  const when = fmtMeetupTime(meetup.starts_at);
  const COPY = {
    meetup_invite:    { title: `📅 ${meetup.title}`, body: `${fromName} invited you · ${meetup.place || "TBD"} · ${when}` },
    meetup_rsvp:      { title: extra.response === "going" ? "✅ RSVP: going" : "RSVP: can't make it", body: `${fromName} ${extra.response === "going" ? "is in for" : "can't make"} "${meetup.title}" (${when})` },
    meetup_cancelled: { title: "Plan cancelled", body: `${fromName} cancelled "${meetup.title}" (${when})` },
  };
  const copy = COPY[type];
  if (!copy) return;
  const dedupKey = type === "meetup_rsvp"
    ? `meetup_rsvp:${meetup.id}:${fromId}:${extra.response}`
    : `${type}:${meetup.id}:${fromId}`;
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: targetUserId,
      type,
      title: copy.title,
      body: copy.body,
      url: "/?view=friends",
      icon: "/icon-push-bell.png",
      data: {
        from_id: fromId,               // pinned to caller by RLS — do not change key
        from_name: fromName,
        meetup_id: meetup.id,
        urgency: "normal",
        // Don't push invites/cancellations after the plan time has passed
        expires_at: meetup.starts_at,
      },
      dedup_key: dedupKey,
    });
    if (error && error.code !== "23505") console.error("[notifyMeetup]", error.message);
  } catch (e) { console.error("[notifyMeetup]", e); }
}

/**
 * Create a meetup and send invites. memberIds = invitees' Clerk ids (creator
 * excluded). Returns the created row or null.
 */
export async function createMeetup({ userId, userName, title, place, startsAt, groupId = null, groupName = null, memberIds = [] }) {
  const invitees = [...new Set(memberIds.filter(id => id && id !== userId))];
  if (!userId || !title?.trim() || !startsAt || invitees.length === 0) return null;
  try {
    const { data, error } = await supabase
      .from("meetups")
      .insert({
        created_by: userId,
        created_by_name: userName || "Someone",
        title: title.trim().slice(0, 80),
        place: (place || "").trim().slice(0, 60) || null,
        starts_at: startsAt,
        group_id: groupId,
        group_name: groupName,
        member_ids: invitees,
      })
      .select()
      .single();
    if (error) { console.error("[createMeetup]", error.message); return null; }
    await Promise.all(invitees.map(id => notifyMeetup(id, "meetup_invite", data, userId, userName || "Someone")));
    return data;
  } catch (e) { console.error("[createMeetup]", e); return null; }
}

/**
 * Update an existing meetup. memberIds will overwrite the existing list.
 */
export async function updateMeetup(meetupId, { title, place, startsAt, memberIds = [] }, userId) {
  if (!meetupId || !userId || !title?.trim() || !startsAt) return null;
  const invitees = [...new Set(memberIds.filter(id => id && id !== userId))];
  try {
    const { data, error } = await supabase
      .from("meetups")
      .update({
        title: title.trim().slice(0, 80),
        place: (place || "").trim().slice(0, 60) || null,
        starts_at: startsAt,
        member_ids: invitees,
      })
      .eq("id", meetupId)
      .eq("created_by", userId)
      .select()
      .single();
    if (error) { console.error("[updateMeetup]", error.message); return null; }
    // Optionally notify about changes here, skipping for now
    return data;
  } catch (e) { console.error("[updateMeetup]", e); return null; }
}

/**
 * Upcoming plans I created or am invited to (starting within the last hour or
 * later, not cancelled), plus all their RSVPs.
 * Returns { meetups: [...], rsvpsByMeetup: { [id]: rows[] } }.
 */
export async function fetchMyMeetups(userId) {
  const empty = { meetups: [], rsvpsByMeetup: {} };
  if (!userId) return empty;
  try {
    const cutoff = new Date(Date.now() - 3600_000).toISOString();
    const { data: meetups, error } = await supabase
      .from("meetups")
      .select("*")
      .or(`created_by.eq.${userId},member_ids.cs.{${userId}}`)
      .eq("cancelled", false)
      .gte("starts_at", cutoff)
      .order("starts_at", { ascending: true })
      .limit(20);
    if (error || !meetups?.length) {
      if (error) console.error("[fetchMyMeetups]", error.message);
      return empty;
    }
    const { data: rsvps } = await supabase
      .from("meetup_rsvps")
      .select("*")
      .in("meetup_id", meetups.map(m => m.id));
    const rsvpsByMeetup = {};
    for (const r of rsvps || []) (rsvpsByMeetup[r.meetup_id] ||= []).push(r);
    return { meetups, rsvpsByMeetup };
  } catch { return empty; }
}

/** RSVP going/declined (upsert — tapping the other button changes it). */
export async function rsvpMeetup(meetup, userId, userName, response) {
  if (!meetup?.id || !userId) return false;
  try {
    const { error } = await supabase.from("meetup_rsvps").upsert(
      { meetup_id: meetup.id, user_id: userId, user_name: userName || "Someone", response, responded_at: new Date().toISOString() },
      { onConflict: "meetup_id,user_id" },
    );
    if (error) { console.error("[rsvpMeetup]", error.message); return false; }
    notifyMeetup(meetup.created_by, "meetup_rsvp", meetup, userId, userName || "Someone", { response });
    return true;
  } catch { return false; }
}

/** Creator-only: cancel the plan and notify invitees. */
export async function cancelMeetup(meetup, userId, userName) {
  if (!meetup?.id) return false;
  try {
    const { error } = await supabase.from("meetups").update({ cancelled: true }).eq("id", meetup.id);
    if (error) { console.error("[cancelMeetup]", error.message); return false; }
    await Promise.all(
      (meetup.member_ids || []).map(id => notifyMeetup(id, "meetup_cancelled", meetup, userId, userName || "Someone")),
    );
    return true;
  } catch { return false; }
}

/**
 * Coarse live updates: any change to meetups/RSVPs triggers a refetch upstream.
 * (Realtime can't filter on array membership, so filtering happens in the
 * refetch, which is already scoped by RLS.)
 */
export function subscribeMeetups(userId, onChange) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`meetups-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "meetups" }, () => onChange?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "meetup_rsvps" }, () => onChange?.())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
