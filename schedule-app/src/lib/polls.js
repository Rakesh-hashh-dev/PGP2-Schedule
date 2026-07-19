import { supabase } from "./supabase.js";

// Polls — group-chat quick votes + admin cohort polls. Rows live in `polls` /
// `poll_votes` (see migration 20260719120000_polls.sql). Group polls are
// announced in the chat stream via a marker message: `__poll:<uuid>` in
// group_messages — the chat renderer swaps the marker for a PollCard, so the
// message fetch/subscribe path needs no changes.

export const POLL_MARKER = "__poll:";

/**
 * Create a poll. scope: 'group' (groupId required) | 'cohort' (admin-only UI).
 * Returns the created row or null.
 */
export async function createPoll({ scope, groupId = null, userId, userName, question, options, multi = false, closesAt = null }) {
  const opts = (options || []).map(o => String(o).trim()).filter(Boolean);
  if (!userId || !question?.trim() || opts.length < 2) return null;
  try {
    const { data, error } = await supabase
      .from("polls")
      .insert({
        scope,
        group_id: scope === "group" ? groupId : null,
        created_by: userId,
        created_by_name: userName || "Someone",
        question: question.trim().slice(0, 200),
        options: opts.slice(0, 6),
        multi,
        closes_at: closesAt,
      })
      .select()
      .single();
    if (error) { console.error("[createPoll]", error.message); return null; }
    return data;
  } catch (e) { console.error("[createPoll]", e); return null; }
}

export async function fetchPoll(pollId) {
  if (!pollId) return null;
  try {
    const { data } = await supabase.from("polls").select("*").eq("id", pollId).maybeSingle();
    return data || null;
  } catch { return null; }
}

// Open cohort polls + recently-closed ones (14 days), newest first.
export async function fetchCohortPolls() {
  try {
    const cutoff = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
    const { data } = await supabase
      .from("polls")
      .select("*")
      .eq("scope", "cohort")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });
    return data || [];
  } catch { return []; }
}

/** All votes for a poll → { counts: number[], mine: number[]|null, total, voters: {name, choice}[] } */
export async function fetchPollVotes(pollId, userId, optionCount) {
  const empty = { counts: Array(optionCount).fill(0), mine: null, total: 0, voters: [] };
  if (!pollId) return empty;
  try {
    const { data } = await supabase.from("poll_votes").select("user_id, user_name, choice").eq("poll_id", pollId);
    return tallyVotes(data || [], userId, optionCount);
  } catch { return empty; }
}

export function tallyVotes(rows, userId, optionCount) {
  const counts = Array(optionCount).fill(0);
  let mine = null;
  const voters = [];
  for (const v of rows) {
    for (const idx of v.choice || []) {
      if (idx >= 0 && idx < optionCount) counts[idx]++;
    }
    if (v.user_id === userId) mine = v.choice || [];
    voters.push({ id: v.user_id, name: v.user_name || "Someone", choice: v.choice || [] });
  }
  return { counts, mine, total: rows.length, voters };
}

/** Cast/replace a vote. choice = array of option indices. Empty array retracts. */
export async function votePoll(pollId, userId, userName, choice) {
  if (!pollId || !userId) return false;
  try {
    if (!choice || choice.length === 0) {
      const { error } = await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", userId);
      return !error;
    }
    const { error } = await supabase.from("poll_votes").upsert(
      { poll_id: pollId, user_id: userId, user_name: userName || "Someone", choice, voted_at: new Date().toISOString() },
      { onConflict: "poll_id,user_id" },
    );
    if (error) console.error("[votePoll]", error.message);
    return !error;
  } catch { return false; }
}

export async function closePoll(pollId) {
  if (!pollId) return false;
  try {
    const { error } = await supabase.from("polls").update({ closed: true }).eq("id", pollId);
    return !error;
  } catch { return false; }
}

export async function deletePoll(pollId) {
  if (!pollId) return false;
  try {
    const { error } = await supabase.from("polls").delete().eq("id", pollId);
    return !error;
  } catch { return false; }
}

/**
 * Live updates for one poll: vote inserts/updates/deletes + poll close/delete.
 * Returns an unsubscribe fn.
 */
export function subscribePoll(pollId, { onVotes, onPoll } = {}) {
  const channel = supabase
    .channel(`poll-${pollId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` }, () => onVotes?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "polls", filter: `id=eq.${pollId}` }, (payload) => onPoll?.(payload.new || null, payload.eventType))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// True once closes_at has passed (client-side expiry; the row's `closed` flag
// is only flipped by the creator, so treat either as closed).
export function pollIsClosed(poll, now = new Date()) {
  if (!poll) return true;
  if (poll.closed) return true;
  return !!(poll.closes_at && new Date(poll.closes_at) <= now);
}
