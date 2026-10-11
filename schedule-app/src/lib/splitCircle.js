import { resolveSplit, toPaise, computeBalances } from "./expenses.js";

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "JPY", "SGD", "AED"];
export const MAX_PAISE = 999999999999;
export const currencyCode = value => ({ "₹": "INR", "$": "USD", "€": "EUR", "£": "GBP" }[value] || (CURRENCIES.includes(value) ? value : "INR"));
export const dayToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
export const expenseDate = e => e.expense_date || e.created_at?.slice(0, 10) || "";
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function checkedMoney(value) {
  const n = Number(value), minor = toPaise(n);
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(minor) || minor > MAX_PAISE) throw new Error("Enter a valid amount within the supported range.");
  return minor;
}
function exactAllocate(total, weights) {
  const entries = Object.entries(weights).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const sum = entries.reduce((s, [, n]) => s + BigInt(n), 0n);
  if (sum <= 0n) throw new Error("Choose at least one participant.");
  const rows = entries.map(([id, n]) => { const numerator = BigInt(total) * BigInt(n); return { id, value: Number(numerator / sum), remainder: numerator % sum }; });
  let remaining = total - rows.reduce((s, r) => s + r.value, 0);
  const order = [...rows].sort((a, b) => a.remainder === b.remainder ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.remainder > b.remainder ? -1 : 1);
  for (const row of order) { if (!remaining) break; row.value++; remaining--; }
  return Object.fromEntries(rows.map(r => [r.id, r.value]));
}
export function convertSplit(shares, rate) {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0 || r > 1000000 || Number(r.toFixed(8)) !== r) throw new Error("Use a positive conversion rate with at most eight decimal places.");
  const original = Object.values(shares).reduce((a, b) => a + b, 0);
  const converted = (BigInt(original) * BigInt(Math.round(r * 100000000)) + 50000000n) / 100000000n;
  if (converted <= 0n || converted > BigInt(MAX_PAISE)) throw new Error("Choose a valid conversion rate and amount.");
  const total = Number(converted);
  return { total, shares: exactAllocate(total, shares) };
}
export function itemizedSplit(items, adjustment, memberIds) {
  const result = Object.fromEntries(memberIds.map(id => [id, 0]));
  if (!items.length) throw new Error("Add at least one item.");
  for (const item of items) {
    const amount = checkedMoney(item.amount);
    const ids = [...new Set(item.members)].sort();
    if (!item.name.trim() || !amount || !ids.length || ids.some(id => !memberIds.includes(id))) throw new Error("Every item needs a name, positive amount and group participant.");
    const split = exactAllocate(amount, Object.fromEntries(ids.map(id => [id, 1])));
    for (const [id, n] of Object.entries(split)) result[id] += n;
  }
  const subtotal = Object.values(result).reduce((a, b) => a + b, 0);
  const adj = toPaise(adjustment || 0);
  if (!Number.isFinite(Number(adjustment)) || !Number.isSafeInteger(adj) || subtotal + adj <= 0 || subtotal + adj > MAX_PAISE) throw new Error("Check the tax, tip or discount adjustment.");
  if (adj) {
    const split = exactAllocate(Math.abs(adj), result);
    for (const [id, n] of Object.entries(split)) result[id] += Math.sign(adj) * n;
  }
  if (Object.values(result).some(n => n < 0)) throw new Error("Discount exceeds the items total.");
  return { shares: result, total: subtotal + adj };
}
export function nextOccurrence(date, repeat, anchor = date) {
  if (!validDate(date) || !validDate(anchor) || !["weekly", "monthly"].includes(repeat)) throw new Error("Choose a valid recurring date and interval.");
  const d = new Date(date + "T12:00:00Z");
  if (repeat === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else {
    d.setUTCMonth(d.getUTCMonth() + 1, 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(Number(anchor.slice(-2)), last));
  }
  return d.toISOString().slice(0, 10);
}
export function parseReceipt(text, memberIds) {
  const items = []; let adjustment = 0, printedTotal = null;
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(.+?)\s+[$₹€£]?\s*(-?[\d,]+(?:[.]\d{2}))\s*$/);
    if (!match) continue;
    const name = match[1].trim(), amount = Number(match[2].replaceAll(",", ""));
    if (!Number.isFinite(amount)) continue;
    if (/^(grand\s+)?total\b|amount\s+(due|payable)/i.test(name)) { printedTotal = amount; continue; }
    if (/subtotal|balance|change|cash|card|tender/i.test(name)) continue;
    if (/discount/i.test(name)) { adjustment -= Math.abs(amount); continue; }
    if (/tax|gst|service charge|tip/i.test(name)) { adjustment += amount; continue; }
    if (amount > 0) items.push({ name, amount, members: [...memberIds] });
  }
  return { items, adjustment: Math.round(adjustment * 100) / 100, printedTotal };
}
export function analytics(entries, userId, month, currency = "INR") {
  const relevant = entries.filter(e => currencyCode(e.group.currency) === currency);
  const share = e => toPaise(e.shares.find(s => s.user_id === userId)?.amount || 0);
  const current = relevant.filter(e => expenseDate(e).startsWith(month));
  const d = new Date(month + "-01T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1);
  const previous = d.toISOString().slice(0, 7);
  const total = current.reduce((s, e) => s + share(e), 0);
  const prior = relevant.filter(e => expenseDate(e).startsWith(previous)).reduce((s, e) => s + share(e), 0);
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const daily = Array.from({ length: days }, (_, i) => current.filter(e => Number(expenseDate(e).slice(-2)) === i + 1).reduce((s, e) => s + share(e), 0));
  const categories = Object.entries(current.reduce((out, e) => { const key = e.category || "other"; out[key] = (out[key] || 0) + share(e); return out; }, {})).sort((a, b) => b[1] - a[1]);
  const spikes = current.filter(e => {
    const history = relevant.filter(x => x.category === e.category && expenseDate(x) < month + "-01").map(share).filter(n => n > 0).sort((a, b) => a - b);
    if (history.length < 3) return false;
    const middle = Math.floor(history.length / 2), median = history.length % 2 ? history[middle] : (history[middle - 1] + history[middle]) / 2;
    return share(e) > 2 * median;
  });
  return { total, prior, previous, daily, categories, spikes, current };
}
export function balancesByCurrency(groups, ledgers, userId) {
  const out = {};
  for (const group of groups) {
    const l = ledgers[group.id]; if (!l) continue;
    const c = currencyCode(group.currency), b = computeBalances(l.expenses, l.sharesByExpense, l.settlements, group.member_ids)[userId] || 0;
    out[c] ||= { net: 0, owed: 0, owe: 0 };
    out[c].net += b; out[c].owed += Math.max(0, b); out[c].owe += Math.max(0, -b);
  }
  return out;
}
export function parseCSV(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if (c === "\n" && !quoted) { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter(r => r.some(Boolean));
}
const escapeCSV = value => { let s = String(value ?? ""); if (/^[=+@-]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
export function exportCSV(entries) {
  const keys = ["source_key", "description", "amount", "date", "category", "paid_by", "group_id", "currency", "shares_json", "notes"];
  return [keys, ...entries.map(e => [e.import_key || e.id, e.description, e.amount, expenseDate(e), e.category || "other", e.paid_by, e.group.id, currencyCode(e.group.currency), JSON.stringify(Object.fromEntries(e.shares.map(s => [s.user_id, toPaise(s.amount)]))), e.notes || ""])].map(r => r.map(escapeCSV).join(",")).join("\n");
}
export function reviewCSV(text, group, userId, existing = []) {
  const rows = parseCSV(text); if (rows.length < 2 || rows.length > 251) throw new Error("Import 1–250 rows at a time.");
  const header = rows.shift().map(s => s.replace(/^\uFEFF/, "").trim().toLowerCase());
  if (["description", "amount", "date"].some(key => !header.includes(key))) throw new Error("Required columns: description, amount, date (YYYY-MM-DD).");
  const seen = new Set(existing.map(e => e.import_key || e.id));
  return rows.map((row, i) => {
    const get = key => row[header.indexOf(key)] || "";
    const description = get("description"), amountPaise = checkedMoney(get("amount")), date = get("date"), payer = get("paid_by") || userId;
    if (!description.trim() || description.length > 100 || !amountPaise || !validDate(date) || !group.member_ids.includes(payer)) throw new Error(`Check description, date, amount or payer in row ${i + 2}.`);
    if (get("group_id") && get("group_id") !== group.id || get("currency") && get("currency") !== currencyCode(group.currency)) throw new Error(`Row ${i + 2} belongs to another group or currency.`);
    let shares = get("shares_json") ? JSON.parse(get("shares_json")) : resolveSplit("equal", amountPaise, group.member_ids).shares;
    if (!shares || typeof shares !== "object" || Array.isArray(shares) || Object.entries(shares).some(([id, n]) => !group.member_ids.includes(id) || !Number.isSafeInteger(n) || n < 0) || Object.values(shares).reduce((a, b) => a + b, 0) !== amountPaise) throw new Error(`Shares in row ${i + 2} must match the amount and group members.`);
    const key = get("source_key").replace(/^'/, "") || JSON.stringify([description.trim(), amountPaise, date, payer, shares]);
    const duplicate = seen.has(key); seen.add(key);
    return { description, amountPaise, date, paidBy: payer, shares, category: get("category") || "other", notes: get("notes"), importKey: key, duplicate };
  });
}
export function downloadFile(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement("a");
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
