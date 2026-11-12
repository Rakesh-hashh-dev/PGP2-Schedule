import { supabase } from "./supabase.js";
import { fetchMyMeetups } from "./meetups.js";
import { fetchAllSocialRows } from "./socialPaging.js";

export function acceptedCommitments(userId, { meetups = [], rsvpsByMeetup = {} } = {}) {
  return meetups.filter(m => !m.cancelled && (m.created_by === userId || (rsvpsByMeetup[m.id] || []).some(r => r.user_id === userId && r.response === "going")))
    .map(m => ({ id: m.id, seriesId: m.series_id, seriesIndex: m.series_index, startsAt: m.starts_at, endsAt: m.ends_at || new Date(new Date(m.starts_at).getTime() + 3600000).toISOString(), source: "Accepted plan" }));
}
export async function loadSocialAvailability(userId) {
  if (!userId) return { blocks: [], commitments: [] };
  const [blocks, plans] = await Promise.all([
    fetchAllSocialRows(() => supabase.from("social_busy_blocks").select("id,starts_at,ends_at").eq("user_id", userId).gt("ends_at", new Date().toISOString()).order("starts_at").order("id"), "Could not check your private busy blocks. Please retry."),
    fetchMyMeetups(userId, { strict: true }),
  ]);
  const rows = blocks;
  return { blocks: rows, commitments: [...rows.map(b => ({ id: b.id, startsAt: b.starts_at, endsAt: b.ends_at, source: "Private busy block" })), ...acceptedCommitments(userId, plans)] };
}

export function subscribeBusyBlocks(userId, onChange) {
  if (!userId) return () => {};
  const channel = supabase.channel(`social-busy:${userId}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "social_busy_blocks", filter: `user_id=eq.${userId}` }, onChange).subscribe();
  return () => supabase.removeChannel(channel);
}
export async function saveBusyBlock(userId, startsAt, endsAt) {
  const duration = new Date(endsAt) - new Date(startsAt);
  if (!userId || !Number.isFinite(duration) || duration < 60000 || duration > 7 * 86400000) throw new Error("Choose an end after the start, within seven days.");
  const { error } = await supabase.from("social_busy_blocks").insert({ user_id: userId, starts_at: startsAt, ends_at: endsAt });
  if (error) throw new Error("Could not save your private busy block.");
}
export async function deleteBusyBlock(userId, id) {
  const { data, error } = await supabase.from("social_busy_blocks").delete().eq("id", id).eq("user_id", userId).select("id");
  if (error || data?.length !== 1) throw new Error("Could not remove your private busy block.");
}
