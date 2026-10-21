import { supabase } from "./supabase.js";
import { resizeImage } from "./board.js";

/**
 * expenses.js — TermFlow Split (Splitwise-style shared expenses)
 *
 * Rows live in `split_groups` / `split_expenses` / `split_shares` / `settlements`
 * (see migration 20260721120000_split.sql). Membership is server-side; the
 * creator manages the member list. Invites/settle notices/reminders are
 * client-inserted `notifications` rows (scoped RLS pins data.from_id to caller).
 *
 * Money: stored as numeric(12,2) rupees. All splitting happens in integer paise
 * (largest-remainder rounding) so participant shares always sum to the exact
 * total — no floating-point drift.
 */

export const CATEGORIES = [
  { id: "food", label: "Food", icon: "🍽️" },
  { id: "travel", label: "Travel", icon: "🚕" },
  { id: "groceries", label: "Groceries", icon: "🛒" },
  { id: "stay", label: "Stay", icon: "🏠" },
  { id: "shopping", label: "Shopping", icon: "🛍️" },
  { id: "utilities", label: "Utilities", icon: "💡" },
  { id: "entertainment", label: "Fun", icon: "🎬" },
  { id: "other", label: "Other", icon: "🧾" },
];

// ── Receipt images ──────────────────────────────────────────────

// Private receipt URLs are signed and cached briefly. React consumers subscribe to completion.
const receiptCache = new Map();
const receiptPending = new Map();
export function receiptImageUrl(imagePath) {
  if (!imagePath) return null;
  const cached = receiptCache.get(imagePath);
  if (cached?.expires > Date.now()) return cached.url;
  if (!receiptPending.has(imagePath)) {
    const request = supabase.storage.from("split-receipts").createSignedUrl(imagePath, 900).then(({ data, error }) => {
      receiptCache.set(imagePath, { url: !error ? data?.signedUrl || null : null, expires: Date.now() + (!error && data?.signedUrl ? 840000 : 30000) });
      window.dispatchEvent(new CustomEvent("split-receipt-ready", { detail: imagePath }));
    }).catch(() => { receiptCache.set(imagePath, { url: null, expires: Date.now() + 30000 }); }).finally(() => receiptPending.delete(imagePath));
    receiptPending.set(imagePath, request);
  }
  return null;
}

/** Resize + upload a receipt to the caller's folder. Returns the path or null. */
export async function resizeReceipt(userId, imageFile) {
  if (!imageFile) return null;
  try {
    const blob = imageFile.type === "image/webp" ? imageFile : await resizeImage(imageFile);
    const path = `${userId}/${Date.now()}.webp`;
    const { error } = await supabase.storage
      .from("split-receipts")
      .upload(path, blob, { contentType: "image/webp", upsert: false });
    if (error) { console.error("[uploadReceipt]", error.message); return null; }
    return path;
  } catch (e) { console.error("[uploadReceipt]", e); return null; }
}

// ── Money helpers ───────────────────────────────────────────────

/** Rupees (number or numeric string) → integer paise. */
export function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}
/** Integer paise → numeric(12,2)-safe rupees number. */
export function toRupees(paise) {
  return Math.round(paise) / 100;
}
/** Format paise as a display string, e.g. 12345 → "₹123.45" (trims .00). */
export function fmtMoney(paise, currency = "₹") {
  const neg = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = abs / 100;
  const s = rupees % 1 === 0 ? String(rupees) : rupees.toFixed(2);
  return `${neg ? "−" : ""}${currency}${s}`;
}

/**
 * Resolve a split into { [userId]: paise } that sums EXACTLY to totalPaise.
 *
 * @param splitType  'equal' | 'exact' | 'percent' | 'shares'
 * @param totalPaise integer paise of the expense
 * @param participants array of userIds (equal) — order matters for remainder
 * @param weights   for exact: { userId: rupees }; percent: { userId: percent };
 *                  shares: { userId: shareCount }. Ignored for 'equal'.
 * Returns { shares: { userId: paise }, error }. On imbalance for 'exact'/'percent'
 * returns an error string instead of silently fudging.
 */
export function resolveSplit(splitType, totalPaise, participants, weights = {}) {
  const ids = [...participants];
  if (!ids.length) return { error: "Pick at least one person to split with." };

  if (splitType === "exact") {
    const shares = {};
    let sum = 0;
    for (const id of ids) {
      const p = toPaise(weights[id] || 0);
      shares[id] = p;
      sum += p;
    }
    if (sum !== totalPaise) {
      const diff = toRupees(totalPaise - sum);
      return { error: `Exact amounts are off by ${diff > 0 ? "₹" + diff : "−₹" + Math.abs(diff)}. They must add up to the total.` };
    }
    return { shares };
  }

  if (splitType === "percent") {
    const totalPct = ids.reduce((s, id) => s + Number(weights[id] || 0), 0);
    if (Math.round(totalPct * 100) !== 10000) {
      return { error: `Percentages add up to ${totalPct}%. They must total 100%.` };
    }
    // Largest-remainder on percentages
    return { shares: largestRemainder(ids, totalPaise, ids.map(id => Number(weights[id] || 0))) };
  }

  if (splitType === "shares") {
    const w = ids.map(id => Math.max(0, Number(weights[id] || 0)));
    if (w.reduce((a, b) => a + b, 0) <= 0) return { error: "Give at least one person a share." };
    return { shares: largestRemainder(ids, totalPaise, w) };
  }

  // equal
  return { shares: largestRemainder(ids, totalPaise, ids.map(() => 1)) };
}

/**
 * Distribute totalPaise across ids proportional to weights, giving the leftover
 * paise (from flooring) to the ids with the largest fractional remainders.
 * Guarantees Σ result === totalPaise.
 */
function largestRemainder(ids, totalPaise, weights) {
  const wSum = weights.reduce((a, b) => a + b, 0);
  if (wSum <= 0) return Object.fromEntries(ids.map(id => [id, 0]));
  const raw = ids.map((id, i) => (totalPaise * weights[i]) / wSum);
  const floors = raw.map(Math.floor);
  let remainder = totalPaise - floors.reduce((a, b) => a + b, 0);
  const order = ids
    .map((id, i) => ({ i, frac: raw[i] - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const out = {};
  ids.forEach((id, i) => { out[id] = floors[i]; });
  for (let k = 0; k < remainder; k++) out[ids[order[k % ids.length].i]] += 1;
  return out;
}

// ── Balances & debt simplification ──────────────────────────────

/**
 * Compute net balance per member (paise) from expenses+shares and settlements.
 * Positive = the member is owed money; negative = the member owes.
 *
 * @param expenses [{ id, amount, paid_by }]
 * @param sharesByExpense { [expenseId]: [{ user_id, amount }] }
 * @param settlements [{ from_user, to_user, amount }]
 * @param memberIds full member list (so everyone shows, even at zero)
 * Returns { [userId]: paise }.
 */
export function computeBalances(expenses, sharesByExpense, settlements, memberIds) {
  const bal = Object.fromEntries((memberIds || []).map(id => [id, 0]));
  const bump = (id, delta) => { bal[id] = (bal[id] || 0) + delta; };

  for (const e of expenses || []) {
    bump(e.paid_by, toPaise(e.amount));                       // payer fronted it
    for (const s of sharesByExpense[e.id] || []) {
      bump(s.user_id, -toPaise(s.amount));                    // each owes their share
    }
  }
  for (const s of settlements || []) {
    bump(s.from_user, toPaise(s.amount));                     // paying reduces what you owe
    bump(s.to_user, -toPaise(s.amount));
  }
  return bal;
}

/**
 * Greedy minimum-cash-flow: collapse a balance map into the fewest transfers.
 * Returns [{ from, to, amount }] in paise. This is Splitwise's "simplify debts".
 */
export function simplifyDebts(balances) {
  const creditors = [];
  const debtors = [];
  for (const [id, amt] of Object.entries(balances)) {
    if (amt > 0) creditors.push({ id, amt });
    else if (amt < 0) debtors.push({ id, amt: -amt });
  }
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transfers = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci], d = debtors[di];
    const pay = Math.min(c.amt, d.amt);
    if (pay > 0) transfers.push({ from: d.id, to: c.id, amount: pay });
    c.amt -= pay;
    d.amt -= pay;
    if (c.amt === 0) ci++;
    if (d.amt === 0) di++;
  }
  return transfers;
}

/**
 * Exact pairwise net debts (who owes whom directly, NOT simplified).
 * Builds a directed debt matrix from expenses/shares, nets each pair, then
 * applies settlements. Returns [{ from, to, amount }] in paise, amount > 0.
 */
export function pairwiseDebts(expenses, sharesByExpense, settlements) {
  const owe = {}; // owe[a][b] = paise a owes b
  const add = (a, b, amt) => {
    if (a === b || amt <= 0) return;
    (owe[a] ||= {});
    owe[a][b] = (owe[a][b] || 0) + amt;
  };
  for (const e of expenses || []) {
    for (const s of sharesByExpense[e.id] || []) {
      add(s.user_id, e.paid_by, toPaise(s.amount)); // participant owes the payer
    }
  }
  for (const s of settlements || []) {
    add(s.to_user, s.from_user, toPaise(s.amount)); // paying cancels what you owe
  }
  // Net each unordered pair
  const seen = new Set();
  const out = [];
  for (const a of Object.keys(owe)) {
    for (const b of Object.keys(owe[a])) {
      const key = [a, b].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const net = (owe[a]?.[b] || 0) - (owe[b]?.[a] || 0);
      if (net > 0) out.push({ from: a, to: b, amount: net });
      else if (net < 0) out.push({ from: b, to: a, amount: -net });
    }
  }
  return out.sort((x, y) => y.amount - x.amount);
}

/**
 * Group spending insights from expenses: total, per-category totals, and
 * per-member "paid" totals. All in paise.
 */
export function groupInsights(expenses, memberIds) {
  let total = 0;
  const byCategory = {};
  const paidByMember = Object.fromEntries((memberIds || []).map(id => [id, 0]));
  for (const e of expenses || []) {
    const p = toPaise(e.amount);
    total += p;
    const cat = e.category || "other";
    byCategory[cat] = (byCategory[cat] || 0) + p;
    paidByMember[e.paid_by] = (paidByMember[e.paid_by] || 0) + p;
  }
  const categories = Object.entries(byCategory)
    .map(([id, paise]) => ({ id, paise }))
    .sort((a, b) => b.paise - a.paise);
  return { total, categories, paidByMember, count: (expenses || []).length };
}

/** Convenience: what does `me` owe / get owed, netted per other member. */
export function pairwiseForMember(transfers, me) {
  const owe = transfers.filter(t => t.from === me);   // I pay these
  const owed = transfers.filter(t => t.to === me);    // these pay me
  const oweTotal = owe.reduce((s, t) => s + t.amount, 0);
  const owedTotal = owed.reduce((s, t) => s + t.amount, 0);
  return { owe, owed, oweTotal, owedTotal, net: owedTotal - oweTotal };
}

// ── Groups CRUD ─────────────────────────────────────────────────

/** All split groups I'm a member of, newest first. */
export async function fetchMyGroups(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from("split_groups")
      .select("*")
      .contains("member_ids", [userId])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  } catch (e) { throw new Error(e.message || "Unable to load your groups.", { cause: e }); }
}

/**
 * Create a group. members = [{ id, name }] of everyone incl. the creator.
 * Returns the created row or null.
 */
export async function createGroup({ userId, userName, name, members = [], currency = "₹" }) {
  if (!userId || !name?.trim()) return null;
  const all = dedupeMembers([{ id: userId, name: userName || "You" }, ...members]);
  const memberNames = Object.fromEntries(all.map(m => [m.id, m.name]));
  try {
    const { data, error } = await supabase
      .from("split_groups")
      .insert({
        name: name.trim().slice(0, 60),
        created_by: userId,
        created_by_name: userName || "Someone",
        member_ids: all.map(m => m.id),
        member_names: memberNames,
        currency,
      })
      .select()
      .single();
    if (error) { console.error("[createGroup]", error.message); return null; }
    return data;
  } catch (e) { console.error("[createGroup]", e); return null; }
}

/** Creator-only: rename / replace members. members = [{ id, name }] incl. creator. */
export async function updateGroup(groupId, userId, { name, members }) {
  if (!groupId || !userId) return null;
  const patch = {};
  if (name != null) patch.name = name.trim().slice(0, 60);
  if (members) {
    const all = dedupeMembers(members);
    patch.member_ids = all.map(m => m.id);
    patch.member_names = Object.fromEntries(all.map(m => [m.id, m.name]));
  }
  try {
    const { data, error } = await supabase
      .from("split_groups")
      .update(patch)
      .eq("id", groupId)
      .eq("created_by", userId)
      .select()
      .single();
    if (error) { console.error("[updateGroup]", error.message); return null; }
    return data;
  } catch (e) { console.error("[updateGroup]", e); return null; }
}

/** Creator-only: delete the group (cascades expenses/shares/settlements). */
export async function deleteGroup(groupId, userId) {
  if (!groupId || !userId) return false;
  try {
    const { error } = await supabase.from("split_groups").delete().eq("id", groupId).eq("created_by", userId);
    if (error) { console.error("[deleteGroup]", error.message); return false; }
    return true;
  } catch { return false; }
}

function dedupeMembers(members) {
  const seen = new Map();
  for (const m of members) if (m?.id && !seen.has(m.id)) seen.set(m.id, { id: m.id, name: m.name || "Member" });
  return [...seen.values()];
}

// ── Expenses CRUD ───────────────────────────────────────────────

/**
 * Load a group's expenses + their shares + settlements in one shot.
 * Returns { expenses, sharesByExpense, settlements }.
 */
export async function fetchGroupLedger(groupId) {
  const empty = { expenses: [], sharesByExpense: {}, settlements: [] };
  if (!groupId) return empty;
  try {
    const [{ data: expenses, error: eErr }, { data: settlements, error: sErr }] = await Promise.all([
      supabase.from("split_expenses").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.from("settlements").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
    ]);
    if (eErr) throw new Error(eErr.message);
    if (sErr) throw new Error(sErr.message);
    const exp = expenses || [];
    let sharesByExpense = {};
    if (exp.length) {
      const { data: shares, error: shErr } = await supabase
        .from("split_shares").select("*").in("expense_id", exp.map(e => e.id));
      if (shErr) throw new Error(shErr.message);
      for (const s of shares || []) (sharesByExpense[s.expense_id] ||= []).push(s);
    }
    return { expenses: exp, sharesByExpense, settlements: settlements || [] };
  } catch (e) { throw new Error(e.message || "Unable to load this group ledger.", { cause: e }); }
}

/**
 * Add an expense: insert the expense row, then its resolved share rows.
 * shares = { [userId]: paise } from resolveSplit(). Notifies other participants.
 * Returns the created expense row or null.
 */
export async function addExpense({ userId, userName, group, description, amountPaise, paidBy, splitType, category, notes, shares, imageFile }) {
  if (!userId || !group?.id || !description?.trim() || !amountPaise || !paidBy) return null;
  try {
    const imagePath = await resizeReceipt(userId, imageFile);
    const { data: expense, error } = await supabase
      .from("split_expenses")
      .insert({
        group_id: group.id,
        description: description.trim().slice(0, 100),
        amount: toRupees(amountPaise),
        paid_by: paidBy,
        split_type: splitType || "equal",
        category: category || null,
        notes: (notes || "").trim().slice(0, 300) || null,
        image_path: imagePath,
        created_by: userId,
      })
      .select()
      .single();
    if (error) { console.error("[addExpense expense]", error.message); return null; }

    const shareRows = Object.entries(shares)
      .filter(([, p]) => p > 0)
      .map(([uid, p]) => ({ expense_id: expense.id, user_id: uid, amount: toRupees(p) }));
    if (shareRows.length) {
      const { error: shErr } = await supabase.from("split_shares").insert(shareRows);
      if (shErr) {
        console.error("[addExpense shares]", shErr.message);
        // Roll back the orphaned expense so the ledger stays consistent
        await supabase.from("split_expenses").delete().eq("id", expense.id);
        return null;
      }
    }

    // Notify every participant except the logger
    const targets = [...new Set(Object.keys(shares))].filter(id => id !== userId);
    await Promise.all(targets.map(id =>
      notifySplit(id, "split_added", group, userId, userName || "Someone", {
        description: expense.description, amountPaise,
      })
    ));
    return expense;
  } catch (e) { console.error("[addExpense]", e); return null; }
}

/**
 * Edit an expense: update the row and replace its share set. Only the logger may
 * (RLS enforces created_by). `shares` = { [userId]: paise } from resolveSplit().
 * Pass imageFile to add/replace the receipt; leave undefined to keep the current
 * one. Returns the updated row or null.
 */
export async function updateExpense({ userId, expenseId, description, amountPaise, paidBy, splitType, category, notes, shares, imageFile }) {
  if (!userId || !expenseId || !description?.trim() || !amountPaise || !paidBy) return null;
  try {
    const patch = {
      description: description.trim().slice(0, 100),
      amount: toRupees(amountPaise),
      paid_by: paidBy,
      split_type: splitType || "equal",
      category: category || null,
      notes: (notes || "").trim().slice(0, 300) || null,
    };
    if (imageFile) {
      const imagePath = await resizeReceipt(userId, imageFile);
      if (imagePath) patch.image_path = imagePath;
    }
    const { data: expense, error } = await supabase
      .from("split_expenses")
      .update(patch)
      .eq("id", expenseId)
      .eq("created_by", userId)
      .select()
      .single();
    if (error) { console.error("[updateExpense]", error.message); return null; }

    // Replace shares wholesale (simplest correct path)
    await supabase.from("split_shares").delete().eq("expense_id", expenseId);
    const shareRows = Object.entries(shares)
      .filter(([, p]) => p > 0)
      .map(([uid, p]) => ({ expense_id: expenseId, user_id: uid, amount: toRupees(p) }));
    if (shareRows.length) {
      const { error: shErr } = await supabase.from("split_shares").insert(shareRows);
      if (shErr) { console.error("[updateExpense shares]", shErr.message); return null; }
    }
    return expense;
  } catch (e) { console.error("[updateExpense]", e); return null; }
}

/** Logger-only: delete an expense (shares cascade). */
export async function deleteExpense(expenseId, userId) {
  if (!expenseId || !userId) return false;
  try {
    const { error } = await supabase.from("split_expenses").delete().eq("id", expenseId).eq("created_by", userId);
    if (error) { console.error("[deleteExpense]", error.message); return false; }
    return true;
  } catch { return false; }
}

// ── Settlements ─────────────────────────────────────────────────

/** Record a settle-up payment from `me` to `toUser`. Notifies the other party. */
export async function settleUp({ userId, userName, group, toUser, amountPaise, note }) {
  if (!userId || !group?.id || !toUser || !amountPaise || amountPaise <= 0) return null;
  try {
    const { data, error } = await supabase
      .from("settlements")
      .insert({
        group_id: group.id,
        from_user: userId,
        to_user: toUser,
        amount: toRupees(amountPaise),
        note: (note || "").trim().slice(0, 120) || null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) { console.error("[settleUp]", error.message); return null; }
    await notifySplit(toUser, "split_settled", group, userId, userName || "Someone", { amountPaise });
    return data;
  } catch (e) { console.error("[settleUp]", e); return null; }
}

export async function deleteSettlement(settlementId, userId) {
  if (!settlementId || !userId) return false;
  try {
    const { error } = await supabase.from("settlements").delete().eq("id", settlementId).eq("created_by", userId);
    if (error) { console.error("[deleteSettlement]", error.message); return false; }
    return true;
  } catch { return false; }
}

/** Nudge a debtor to settle up. targetUser owes `me`. */
export async function remindToSettle({ userId, userName, group, toUser, amountPaise }) {
  if (!userId || !toUser || toUser === userId) return false;
  await notifySplit(toUser, "split_reminder", group, userId, userName || "Someone", { amountPaise });
  return true;
}

/**
 * Record every debt `me` owes in one go. transfers = [{ to, amount(paise) }].
 * Returns the number of settlements recorded.
 */
export async function settleAll({ userId, userName, group, transfers }) {
  let done = 0;
  for (const t of transfers || []) {
    const row = await settleUp({ userId, userName, group, toUser: t.to, amountPaise: t.amount });
    if (row) done++;
  }
  return done;
}

/** Nudge every debtor who owes `me`. transfers = [{ from, amount(paise) }]. */
export async function remindAll({ userId, userName, group, transfers }) {
  await Promise.all((transfers || []).map(t =>
    remindToSettle({ userId, userName, group, toUser: t.from, amountPaise: t.amount })
  ));
  return (transfers || []).length;
}

// ── Join by invite link ─────────────────────────────────────────

/** Build a shareable invite URL for a group. */
export function buildInviteUrl(groupId) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?view=split&join=${encodeURIComponent(groupId)}`;
}

/** Join a group via the SECURITY DEFINER RPC. Returns the group row or null. */
export async function joinGroup(groupId, name) {
  if (!groupId) return null;
  try {
    const { data, error } = await supabase.rpc("join_split_group", { p_group_id: groupId, p_name: name || "Member" });
    if (error) { console.error("[joinGroup]", error.message); return null; }
    return Array.isArray(data) ? data[0] : data;
  } catch (e) { console.error("[joinGroup]", e); return null; }
}

// ── Offline queue (PWA) ─────────────────────────────────────────
//
// If an expense add fails while offline, its payload is stashed in localStorage
// (receipt photos are skipped offline — they need a live upload). flushQueue()
// runs on the next mount and on the browser 'online' event.

const QUEUE_KEY = "pgp2.split.queue";

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; }
  catch { return []; }
}
function writeQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); return true; } catch { return false; }
}

/** Stash a failed add. payload mirrors addExpense args minus imageFile. */
export function enqueueOfflineExpense(payload) {
  const q = readQueue();
  q.push({ ...payload, requestKey: payload.requestKey || crypto.randomUUID(), _queueId: crypto.randomUUID(), _queuedAt: Date.now() });
  if (!writeQueue(q)) throw new Error("Unable to store this offline draft. Keep the form open and reconnect.");
}

export function queuedCount(groupId, userId) {
  return readQueue().filter(p => (!groupId || p.group?.id === groupId) && (!userId || p.userId === userId)).length;
}

/**
 * Try to flush queued adds. Returns the number successfully sent. Silently keeps
 * anything that still fails (e.g. still offline) for the next attempt.
 */
let flushing = null;
export function flushQueue(userId) {
  if (flushing) return flushing;
  if (!userId || typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve(0);
  flushing = (async () => {
    const all = readQueue().map(p => ({ ...p, requestKey: p.requestKey || crypto.randomUUID(), _queueId: p._queueId || crypto.randomUUID() }));
    writeQueue(all);
    const q = all.filter(p => p.userId === userId);
    if (!q.length) return 0;
    const sentIds = new Set(); let sent = 0;
    const { saveCircleExpense, splitFeatures } = await import("./splitCloud.js");
    const advanced = await splitFeatures();
    for (const p of q) {
      try {
        const row = await saveCircleExpense({ ...p, requestKey: p.requestKey || crypto.randomUUID() }, advanced);
        if (row) { sent++; sentIds.add(p._queueId || p._queuedAt); }
      } catch { /* Retain the user's draft for the next retry. */ }
    }
    writeQueue(readQueue().filter(p => !sentIds.has(p._queueId || p._queuedAt)));
    return sent;
  })().finally(() => { flushing = null; });
  return flushing;
}

// ── Notifications ───────────────────────────────────────────────

async function notifySplit(targetUserId, type, group, fromId, fromName, extra = {}) {
  if (!targetUserId || targetUserId === fromId) return;
  const cur = group?.currency || "₹";
  const money = extra.amountPaise != null ? fmtMoney(extra.amountPaise, cur) : "";
  const COPY = {
    split_added: {
      title: `🧾 ${group?.name || "Split"}`,
      body: `${fromName} added "${extra.description}"${money ? ` · ${money}` : ""}`,
    },
    split_settled: {
      title: "💸 Payment recorded",
      body: `${fromName} settled ${money} with you in "${group?.name || "Split"}"`,
    },
    split_reminder: {
      title: "⏰ Settle up",
      body: `${fromName}: you owe ${money} in "${group?.name || "Split"}"`,
    },
  };
  const copy = COPY[type];
  if (!copy) return;
  const dedupKey =
    type === "split_added"
      ? `split_added:${group?.id}:${fromId}:${Date.now()}`   // each add is distinct
      : `${type}:${group?.id}:${fromId}:${extra.amountPaise || 0}`;
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: targetUserId,
      type,
      title: copy.title,
      body: copy.body,
      url: `/?view=split&g=${group?.id || ""}`,
      icon: "/icon-192.png",
      data: {
        from_id: fromId,               // pinned to caller by RLS — do not change key
        from_name: fromName,
        group_id: group?.id,
        urgency: "normal",
        ttl: 3 * 24 * 3600,
      },
      dedup_key: dedupKey,
    });
    if (error && error.code !== "23505") console.error("[notifySplit]", error.message);
  } catch (e) { console.error("[notifySplit]", e); }
}

// ── Realtime ────────────────────────────────────────────────────

/** Coarse live updates for a group's ledger — any relevant change refetches. */
export function subscribeGroupLedger(groupId, onChange) {
  if (!groupId) return () => {};
  const channel = supabase
    .channel(`split-ledger-${groupId}-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "split_expenses", filter: `group_id=eq.${groupId}` }, () => onChange?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "settlements", filter: `group_id=eq.${groupId}` }, () => onChange?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "split_shares" }, () => onChange?.())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/** Live updates to my group list (new group I'm added to, membership change). */
export function subscribeMyGroups(userId, onChange) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`split-groups-${userId}-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "split_groups" }, () => onChange?.())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function notifyExpenseAdded(payload, expense) {
  const targets = Object.entries(payload.shares).filter(([id, amount]) => id !== payload.userId && amount > 0).map(([id]) => id);
  await Promise.all(targets.map(id => notifySplit(id, "split_added", payload.group, payload.userId, payload.userName || "Someone", { description: expense.description, amountPaise: payload.amountPaise })));
}
