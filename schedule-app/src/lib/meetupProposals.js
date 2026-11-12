import { supabase } from "./supabase.js";

// Votes express availability; they do not stand in for the new time's RSVP.
export function mapTimeProposals(proposals, votes, meetup, userId) {
  const members = new Set([meetup.created_by, ...(meetup.member_ids || [])]);
  const sameTime = (a, b) => a == null || b == null ? a === b : new Date(a).getTime() === new Date(b).getTime();
  const active = proposals.filter(p => p.state === "open" && new Date(p.starts_at).getTime() > Date.now() && sameTime(p.base_starts_at, meetup.starts_at) && sameTime(p.base_ends_at || null, meetup.ends_at || null));
  const rows = active.map(p => ({ ...p, count: votes.filter(v => v.proposal_id === p.id && members.has(v.user_id)).length, mine: votes.some(v => v.proposal_id === p.id && v.user_id === userId) }));
  const max = Math.max(0, ...rows.map(p => p.count));
  return rows.map(p => ({ ...p, winning: max > 0 && p.count === max, tied: max > 0 && rows.filter(row => row.count === max).length > 1 }));
}

export async function fetchTimeProposals(meetup, userId) {
  const [proposals, votes] = await Promise.all([
    supabase.from("meetup_time_proposals").select("*").eq("meetup_id", meetup.id).eq("state", "open").order("starts_at"),
    supabase.from("meetup_time_votes").select("*").eq("meetup_id", meetup.id),
  ]);
  if (proposals.error || votes.error) throw new Error("Could not load time suggestions. Please retry.");
  return mapTimeProposals(proposals.data || [], votes.data || [], meetup, userId);
}

export async function fetchTimePoll(meetupId, userId) {
  const { data: meetup, error } = await supabase.from("meetups").select("*").eq("id", meetupId).maybeSingle();
  if (error) throw new Error("Could not refresh this plan. Reload before making scheduling changes.");
  if (!meetup || (meetup.created_by !== userId && !meetup.member_ids?.includes(userId))) throw new Error("This plan is no longer available to you.");
  if (meetup.cancelled) throw new Error("This plan was cancelled. Scheduling is closed.");
  if (new Date(meetup.starts_at).getTime() <= Date.now()) throw new Error("This plan has started. Scheduling is closed.");
  return { meetup, rows: await fetchTimeProposals(meetup, userId) };
}

async function mutate(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || "Could not save the scheduling change.");
  if (data?.saved !== true) throw new Error(data?.reason === "duplicate" ? "These times are already in the poll. No new suggestions were added." : "The scheduling change was not saved. Refresh and retry.");
  window.dispatchEvent(new CustomEvent("pgp2:social-meetup"));
  return data;
}

export function proposeMeetupTimes(meetupId, times, userName) {
  const valid = [...new Set(times)].map(value => new Date(value));
  if (!valid.length || valid.length > 6 || valid.some(value => !Number.isFinite(value.getTime()) || value.getTime() <= Date.now())) return Promise.reject(new Error("Choose one to six future times."));
  return mutate("propose_meetup_times", { p_meetup_id: meetupId, p_times: valid.map(value => value.toISOString()), p_name: userName || "Someone" });
}

export const voteMeetupTime = (meetupId, proposalId) => mutate("vote_meetup_time", { p_meetup_id: meetupId, p_proposal_id: proposalId });
export const applyMeetupTime = (meetupId, proposalId, resolveTie = false) => mutate("apply_meetup_time", { p_meetup_id: meetupId, p_proposal_id: proposalId, p_resolve_tie: resolveTie });
