import { supabase } from "./supabase.js";
import { dayToday, currencyCode } from "./splitCircle.js";
import { addExpense, updateExpense, resizeReceipt, notifyExpenseAdded } from "./expenses.js";

export async function splitFeatures() {
  const { data, error } = await supabase.rpc("split_features");
  return !error && data?.version >= 1;
}
function requireResult(result) {
  if (result.error) throw new Error(result.error.message || "Unable to save. Check your connection.");
  return result.data;
}
export async function saveCircleExpense(payload, advanced) {
  if (!advanced) {
    const row = payload.expenseId ? await updateExpense({ ...payload, expenseId: payload.expenseId }) : await addExpense(payload);
    if (!row) throw new Error("Unable to save. Check your connection and try again.");
    return row;
  }
  let imagePath = payload.imagePath || null;
  if (payload.imageFile) imagePath = await resizeReceipt(payload.userId, payload.imageFile);
  if (payload.imageFile && !imagePath) throw new Error("Receipt upload failed. Your draft is still open.");
  const data = {
    description: payload.description, amountPaise: payload.amountPaise, paidBy: payload.paidBy,
    splitType: payload.splitType, category: payload.category || "other", shares: payload.shares,
    notes: payload.notes || "", imagePath, date: payload.date || dayToday(),
    originalCurrency: payload.originalCurrency || currencyCode(payload.group.currency),
    originalPaise: payload.originalPaise || payload.amountPaise, originalShares: payload.originalShares || payload.shares,
    rate: Number(payload.rate || 1), items: payload.items || [], adjustment: Number(payload.adjustment || 0),
    repeat: payload.repeat || "never", requestKey: payload.requestKey, importKey: payload.importKey || null,
  };
  const row = requireResult(await supabase.rpc("save_split_expense", { p_group: payload.group.id, p_data: data, p_expense_id: payload.expenseId || null, p_version: payload.version ?? null }));
  if (!payload.expenseId && !row.replayed) await notifyExpenseAdded(payload, row);
  return row;
}
export async function fetchCircleData(groupId) {
  const queries = [
    supabase.from("split_comments").select("*").eq("group_id", groupId).order("created_at"),
    supabase.from("split_audit").select("*").eq("group_id", groupId).order("created_at", { ascending: false }).limit(100),
    supabase.from("split_recurring").select("*").eq("group_id", groupId).eq("active", true).order("next_date"),
  ];
  const results = await Promise.all(queries);
  for (const result of results) requireResult(result);
  return { comments: results[0].data || [], audit: results[1].data || [], recurring: results[2].data || [] };
}
export async function postComment({ groupId, expenseId, userId, userName, body }) {
  if (!body.trim() || body.length > 2000) throw new Error("Write a comment under 2,000 characters.");
  return requireResult(await supabase.from("split_comments").insert({ group_id: groupId, expense_id: expenseId, user_id: userId, author: userName || "Member", body: body.trim() }));
}
export async function saveDefaultShares(group, userId, weights) {
  if (group.created_by !== userId || Object.entries(weights).some(([id, n]) => !group.member_ids.includes(id) || !Number.isFinite(Number(n)) || Number(n) < 0) || !Object.values(weights).some(n => Number(n) > 0)) throw new Error("The owner can save positive group ratios.");
  return requireResult(await supabase.from("split_groups").update({ default_shares: weights }).eq("id", group.id).eq("created_by", userId).select().single());
}
export async function getPreferences(userId) {
  const row = requireResult(await supabase.from("split_preferences").select("*").eq("user_id", userId).maybeSingle());
  return row || { user_id: userId, budget: 0, currency: "INR" };
}
export async function savePreferences(userId, budget, currency) {
  if (!Number.isFinite(Number(budget)) || Number(budget) < 0 || Number(budget) > 9999999999.99) throw new Error("Enter a valid monthly budget.");
  return requireResult(await supabase.from("split_preferences").upsert({ user_id: userId, budget: Number(budget), currency }).select().single());
}
export async function postRecurring(schedule) {
  return requireResult(await supabase.rpc("post_split_recurring", { p_schedule: schedule.id, p_due: schedule.next_date }));
}
export async function stopRecurring(id) { requireResult(await supabase.rpc("stop_split_recurring", { p_schedule: id })); }
export async function createSecureInvite(groupId, invitedUser = null) { return requireResult(await supabase.rpc("create_split_invite", { p_group: groupId, p_user: invitedUser })); }
export async function revokeSecureInvite(id) { requireResult(await supabase.rpc("revoke_split_invite", { p_invite: id })); }
export async function fetchInvites(groupId) { return requireResult(await supabase.from("split_invitations").select("id,invited_user,expires_at,used_by,revoked").eq("group_id", groupId).order("created_at", { ascending: false })); }
export async function acceptSecureInvite(token, name) { return requireResult(await supabase.rpc("accept_split_invite", { p_token: token, p_name: name || "Member" })); }
export function subscribeCircle(groupId, reload) {
  const channel = supabase.channel(`split-circle-${groupId}-${crypto.randomUUID()}`);
  for (const table of ["split_comments", "split_audit", "split_recurring"]) channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `group_id=eq.${groupId}` }, reload);
  channel.subscribe(); return () => supabase.removeChannel(channel);
}
