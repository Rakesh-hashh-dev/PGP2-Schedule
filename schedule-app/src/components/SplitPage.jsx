import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Users, ArrowLeft, Trash2, Check, Receipt,
  ArrowRight, HandCoins, Pencil, ChevronRight, Share2, Copy,
  WifiOff, AlertTriangle,
  Utensils, Car, ShoppingCart, Home, ShoppingBag, Lightbulb, PartyPopper, Tag
} from "lucide-react";
import {
  CATEGORIES, fmtMoney, toPaise, computeBalances, simplifyDebts,
  pairwiseDebts, groupInsights,
  createGroup, updateGroup, deleteGroup,
  fetchGroupLedger, deleteExpense,
  settleUp, deleteSettlement, remindToSettle, settleAll, remindAll,
  buildInviteUrl, flushQueue, queuedCount,
  subscribeGroupLedger,
} from "../lib/expenses.js";
import { EmptyState } from "./ui.jsx";
import ExpenseModal from "./split/ExpenseForm.jsx";
import SplitWorkspace from "./split/SplitWorkspace.jsx";
import { CirclePanel, ExpenseDetails, SecureInvite } from "./split/Collaboration.jsx";
import ImportExpenses from "./split/ImportExpenses.jsx";
import { useReceipt } from "../lib/useSplitReceipt.js";
import { exportCSV, downloadFile } from "../lib/splitCircle.js";
import "../styles/split.css";
import "../styles/split-circle.css";

// TermFlow Split — Splitwise-style shared expenses. Two screens: a list of
// groups (with your net position) and a group ledger (balances, simplified /
// pairwise settle-up, receipts, insights). Money math lives in lib/expenses.js.

const CAT_META = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const CAT_ICONS = {
  food: Utensils,
  travel: Car,
  groceries: ShoppingCart,
  stay: Home,
  shopping: ShoppingBag,
  utilities: Lightbulb,
  entertainment: PartyPopper,
  other: Tag,
};

function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function Ava({ name, size = 28 }) {
  return (
    <span className="sp-ava" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Create / edit group modal
// ═══════════════════════════════════════════════════════════════
function GroupModal({ userId, userName, friends, existing, balances, onClose, onSaved, onDeleted }) {
  const cloudFriends = useMemo(() => (friends || []).filter(f => f.cloudId), [friends]);
  const [name, setName] = useState(existing?.name || "");
  const [picked, setPicked] = useState(() => {
    if (!existing) return new Set();
    return new Set((existing.member_ids || []).filter(id => id !== userId));
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [warnRemove, setWarnRemove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isCreator = existing && existing.created_by === userId;

  async function handleDelete() {
    if (busy) return;
    setBusy(true); setFailed(false);
    const ok = await deleteGroup(existing.id, userId);
    setBusy(false);
    if (!ok) { setFailed(true); return; }
    onDeleted?.();
  }

  function toggle(cloudId) {
    setPicked(prev => {
      const next = new Set(prev);
      next.has(cloudId) ? next.delete(cloudId) : next.add(cloudId);
      return next;
    });
    setWarnRemove(false);
  }

  // Members being removed who still carry a non-zero balance
  const removedWithBalance = useMemo(() => {
    if (!existing) return [];
    return (existing.member_ids || [])
      .filter(id => id !== userId && !picked.has(id) && Math.abs(balances?.[id] || 0) > 0)
      .map(id => ({ id, name: existing.member_names?.[id] || "Member", bal: balances[id] }));
  }, [existing, picked, balances, userId]);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    if (removedWithBalance.length && !warnRemove) { setWarnRemove(true); return; }
    setBusy(true); setFailed(false);
    const membersFromFriends = cloudFriends
      .filter(f => picked.has(f.cloudId))
      .map(f => ({ id: f.cloudId, name: f.name }));
    const extra = existing
      ? (existing.member_ids || [])
          .filter(id => id !== userId && !cloudFriends.some(f => f.cloudId === id) && picked.has(id))
          .map(id => ({ id, name: existing.member_names?.[id] || "Member" }))
      : [];
    const members = [...membersFromFriends, ...extra];

    let row;
    if (existing) {
      row = await updateGroup(existing.id, userId, {
        name,
        members: [{ id: userId, name: userName || "You" }, ...members],
      });
    } else {
      row = await createGroup({ userId, userName, name, members });
    }
    setBusy(false);
    if (!row) { setFailed(true); return; }
    onSaved(row);
  }

  const balanceNote = (id) => {
    const b = balances?.[id] || 0;
    if (!b) return null;
    return <span className={`sp-mbal ${b > 0 ? "pos" : "neg"}`}>{b > 0 ? "owed " : "owes "}{fmtMoney(Math.abs(b))}</span>;
  };

  return createPortal(
    <div className="sp-modal-backdrop" onClick={onClose}>
      <form className="sp-modal" role="dialog" aria-modal="true" aria-label={existing ? "Edit group" : "New group"} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Escape") onClose(); }} onSubmit={submit}>
        <div className="sp-modal-head">
          <h3><Users size={16} /> {existing ? "Edit group" : "New group"}</h3>
          <button type="button" className="sp-icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <label className="sp-field-label" htmlFor="sp-group-name">Group name</label>
        <input id="sp-group-name" className="sp-input" placeholder="Goa trip, Flat 402, Sunday brunch…" maxLength={60} value={name} onChange={e => setName(e.target.value)} autoFocus />

        <label className="sp-field-label">Members {picked.size > 0 && <span className="sp-field-count">{picked.size + 1}</span>}</label>
        {cloudFriends.length === 0 && !existing ? (
          <p className="sp-hint">Add friends first (Compare → add by code). Only cloud-linked friends can share a split group — or create the group and share its invite link.</p>
        ) : (
          <div className="sp-member-picker">
            <div className="sp-member-chip sp-me">
              <Ava name={userName} size={24} /> <span>{userName || "You"} (you)</span>
            </div>
            {cloudFriends.map(f => (
              <button type="button" key={f.cloudId} className={`sp-member-chip${picked.has(f.cloudId) ? " on" : ""}`} onClick={() => toggle(f.cloudId)}>
                <Ava name={f.name} size={24} /> <span>{f.name}</span>
                {existing && balanceNote(f.cloudId)}
                {picked.has(f.cloudId) && <Check size={14} className="sp-member-check" />}
              </button>
            ))}
            {/* Members who joined via link (not in your friends list) */}
            {existing && (existing.member_ids || [])
              .filter(id => id !== userId && !cloudFriends.some(f => f.cloudId === id))
              .map(id => (
                <button type="button" key={id} className={`sp-member-chip${picked.has(id) ? " on" : ""}`} onClick={() => toggle(id)}>
                  <Ava name={existing.member_names?.[id] || "?"} size={24} /> <span>{existing.member_names?.[id] || "Member"}</span>
                  {balanceNote(id)}
                  {picked.has(id) && <Check size={14} className="sp-member-check" />}
                </button>
              ))}
          </div>
        )}

        {warnRemove && (
          <div className="sp-warn">
            <AlertTriangle size={14} />
            <span>{removedWithBalance.map(m => m.name).join(", ")} still {removedWithBalance.length > 1 ? "have" : "has"} an open balance. Removing them drops it from the ledger. Save anyway?</span>
          </div>
        )}
        {failed && <div className="sp-error">Couldn&rsquo;t save — check your connection and try again.</div>}
        <button type="submit" className="sp-submit" disabled={!name.trim() || busy}>
          {busy ? "Saving…" : warnRemove ? "Remove & save" : existing ? "Save changes" : "Create group"}
        </button>

        {isCreator && (
          confirmDelete ? (
            <div className="sp-delete-confirm">
              <span><AlertTriangle size={13} /> Delete &ldquo;{existing.name}&rdquo; and all its expenses for everyone? This can&rsquo;t be undone.</span>
              <div className="sp-delete-actions">
                <button type="button" className="sp-secondary-btn" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button>
                <button type="button" className="sp-delete-btn" onClick={handleDelete} disabled={busy}>
                  <Trash2 size={14} /> {busy ? "Deleting…" : "Delete group"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="sp-delete-link" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={13} /> Delete group
            </button>
          )
        )}
      </form>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════
//  Add / edit expense modal
// ═══════════════════════════════════════════════════════════════
function SettleModal({ userId, userName, group, members, suggested, onClose, onSettled }) {
  const others = members.filter(m => m.id !== userId);
  const [toUser, setToUser] = useState(suggested?.toUser || others[0]?.id || "");
  const [amount, setAmount] = useState(suggested?.amountPaise ? (suggested.amountPaise / 100).toString() : "");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const amountPaise = toPaise(amount || 0);
  const nameOf = (id) => group.member_names?.[id] || members.find(m => m.id === id)?.name || "Member";

  async function submit(e) {
    e.preventDefault();
    if (!toUser || amountPaise <= 0 || !Number.isSafeInteger(amountPaise) || busy) return;
    setBusy(true); setError("");
    const row = await settleUp({ userId, userName, group, toUser, amountPaise, note: paymentMode });
    setBusy(false);
    if (!row) { setError("Couldn't record — try again."); return; }
    onSettled();
  }

  return createPortal(
    <div className="sp-modal-backdrop" onClick={onClose}>
      <form className="sp-modal" role="dialog" aria-modal="true" aria-label="Settle up" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Escape") onClose(); }} onSubmit={submit}>
        <div className="sp-modal-head">
          <h3><HandCoins size={16} /> Settle up</h3>
          <button type="button" className="sp-icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="sp-settle-flow">
          <div className="sp-settle-party"><Ava name={userName} /> <span>You</span></div>
          <ArrowRight size={18} className="sp-settle-arrow" />
          <select className="sp-input sp-select" aria-label="Pay to" value={toUser} onChange={e => setToUser(e.target.value)}>
            {others.map(m => <option key={m.id} value={m.id}>{nameOf(m.id)}</option>)}
          </select>
        </div>

        <label className="sp-field-label" htmlFor="sp-settle-amount">Amount</label>
        <div className="sp-amount-wrap">
          <span className="sp-cur">{group.currency || "₹"}</span>
          <input id="sp-settle-amount" className="sp-input sp-amount" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </div>

        <label className="sp-field-label" style={{ marginTop: 12 }}>Payment Mode</label>
        <div className="sp-input-group">
          <div className="sp-cat-picker">
            {["Cash", "PhonePe", "GPay", "CRED"].map(mode => (
              <button
                key={mode} type="button"
                className={`sp-cat-btn ${paymentMode === mode ? "on" : ""}`}
                onClick={() => setPaymentMode(mode)}
                disabled={busy}
              >
                <span>{mode}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="sp-error">{error}</div>}
        <button type="submit" className="sp-submit" disabled={!toUser || !amountPaise || busy}>
          {busy ? "Recording…" : `Record ${amountPaise ? fmtMoney(amountPaise, group.currency) : "payment"}`}
        </button>
        <p className="sp-hint">This records that you paid them — it doesn&rsquo;t move real money.</p>
      </form>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════
//  Invite modal
// ═══════════════════════════════════════════════════════════════
function InviteModal({ group, onClose }) {
  const url = buildInviteUrl(group.id);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* clipboard blocked */ }
  }
  return createPortal(
    <div className="sp-modal-backdrop" onClick={onClose}>
      <div className="sp-modal" onClick={e => e.stopPropagation()}>
        <div className="sp-modal-head">
          <h3><Share2 size={16} /> Invite to {group.name}</h3>
          <button type="button" className="sp-icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <p className="sp-hint">Anyone with this link who&rsquo;s signed in can join the group and start splitting.</p>
        <div className="sp-invite-link">
          <span className="sp-invite-url">{url}</span>
          <button className="sp-mini-btn" onClick={copy}>{copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}</button>
        </div>
        {navigator.share && (
          <button className="sp-secondary-btn" style={{ width: "100%", justifyContent: "center" }}
            onClick={() => navigator.share({ title: `Join "${group.name}" on TermFlow Split`, url }).catch(() => {})}>
            <Share2 size={15} /> Share…
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════
//  Group ledger (detail screen)
// ═══════════════════════════════════════════════════════════════
function GroupLedger({ userId, userName, friends, advanced, group, onBack, onGroupChanged, onGroupDeleted }) {
  const [ledger, setLedger] = useState(null);
  const [detail, setDetail] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loadError, setLoadError] = useState("");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleSuggest, setSettleSuggest] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelExp, setConfirmDelExp] = useState(null);
  const [reminded, setReminded] = useState(() => new Set());
  const [mode, setMode] = useState("simplified"); // simplified | pairwise
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  const members = useMemo(
    () => (group.member_ids || []).map(id => ({ id, name: id === userId ? (userName || "You") : (group.member_names?.[id] || "Member") })),
    [group, userId, userName]
  );

  const reload = () => fetchGroupLedger(group.id).then(data => { setLedger(data); setLoadError(""); }).catch(e => { setLedger(null); setLoadError(e.message); });
  useEffect(() => {
    reload();
    flushQueue(userId).then(n => { if (n) reload(); });
    const unsub = subscribeGroupLedger(group.id, reload);
    const onOnline = () => flushQueue(userId).then(n => { if (n) reload(); });
    window.addEventListener("online", onOnline);
    return () => { unsub(); window.removeEventListener("online", onOnline); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  const balances = useMemo(() => {
    if (!ledger) return {};
    return computeBalances(ledger.expenses, ledger.sharesByExpense, ledger.settlements, group.member_ids);
  }, [ledger, group.member_ids]);

  const transfers = useMemo(() => {
    if (!ledger) return [];
    return mode === "pairwise"
      ? pairwiseDebts(ledger.expenses, ledger.sharesByExpense, ledger.settlements)
      : simplifyDebts(balances);
  }, [ledger, balances, mode]);

  const insights = useMemo(() => ledger ? groupInsights(ledger.expenses, group.member_ids) : null, [ledger, group.member_ids]);

  const myNet = balances[userId] || 0;
  const iOwe = transfers.filter(t => t.from === userId);
  const owedToMe = transfers.filter(t => t.to === userId);
  const iOweTotal = iOwe.reduce((s, t) => s + t.amount, 0);
  const queued = queuedCount(group.id, userId);

  const nameOf = (id) => (id === userId ? "You" : group.member_names?.[id] || "Member");
  const isCreator = group.created_by === userId;
  const hasSettlements = (ledger?.settlements?.length || 0) > 0;
  const activity = ledger ? mergeActivity(ledger).filter(item => item.kind !== "expense" || (
    item.row.description.toLowerCase().includes(search.trim().toLowerCase()) &&
    (categoryFilter === "all" || item.row.category === categoryFilter)
  )) : [];
  const activityFiltered = search.trim() || categoryFilter !== "all";

  async function handleReminder(fromId, amount) {
    setReminded(prev => new Set(prev).add(fromId));
    await remindToSettle({ userId, userName, group, toUser: fromId, amountPaise: amount });
  }
  async function handleSettleAll() {
    setBatchBusy(true);
    await settleAll({ userId, userName, group, transfers: iOwe });
    setBatchBusy(false);
    reload();
  }
  async function handleRemindAll() {
    setBatchBusy(true);
    setReminded(prev => { const n = new Set(prev); owedToMe.forEach(t => n.add(t.from)); return n; });
    await remindAll({ userId, userName, group, transfers: owedToMe });
    setBatchBusy(false);
  }

  return (
    <div className="sp-ledger sc-ledger">
      <div className="sp-ledger-head">
        <button className="sp-back" onClick={onBack} aria-label="Back"><ArrowLeft size={18} /></button>
        <div className="sp-ledger-title">
          <span className="sp-kicker">GROUP LEDGER</span>
          <h2>{group.name}</h2>
          <span className="sp-members-line"><Users size={12} /> {members.length} · {members.map(m => m.name.split(" ")[0]).join(", ")}</span>
        </div>
        <button className="sp-icon-btn" onClick={() => setInviteOpen(true)} aria-label="Invite"><Share2 size={16} /></button>
        {isCreator && (
          <button className="sp-icon-btn" onClick={() => setEditOpen(true)} aria-label="Edit group"><Pencil size={16} /></button>
        )}
      </div>

      {queued > 0 && (
        <div className="sp-queued"><WifiOff size={13} /> {queued} expense{queued > 1 ? "s" : ""} waiting to sync</div>
      )}

      <div className="sp-ledger-hero">
        <div className={`sp-net-card${myNet > 0 ? " pos" : myNet < 0 ? " neg" : ""}`}>
          <span className="sp-kicker">YOUR POSITION</span>
          {!ledger ? <span className="sp-net-zero">{loadError ? "Position unavailable" : "Loading your position…"}</span> : myNet === 0
            ? <span className="sp-net-zero"><Check size={16} /> You&rsquo;re all settled up</span>
            : <><span className="sp-net-label">{myNet > 0 ? "You are owed" : "You owe"}</span><span className="sp-net-amt tf-motion-value" key={myNet}>{fmtMoney(Math.abs(myNet), group.currency)}</span></>}
        </div>
        <div className="sp-ledger-actions">
          <button className="sp-primary-btn" onClick={() => { setEditingExpense(null); setExpenseOpen(true); }}><Receipt size={16} /> Add expense</button>
          <button className="sp-secondary-btn" disabled={!ledger} onClick={() => { setSettleSuggest(iOwe[0] ? { toUser: iOwe[0].to, amountPaise: iOwe[0].amount } : null); setSettleOpen(true); }}><HandCoins size={16} /> Settle up</button>
        </div>
      </div>

      {loadError && <div className="sp-error" role="alert">{loadError}<button onClick={reload}>Retry</button></div>}
      <div className="sc-actions sc-ledger-tools"><button className="sp-secondary-btn" disabled={!ledger?.expenses.length} onClick={() => downloadFile(exportCSV(ledger.expenses.map(e => ({ ...e, group, shares: ledger.sharesByExpense[e.id] || [] }))), "termflow-group-expenses.csv", "text/csv")}><Receipt size={14}/>Export CSV</button>{advanced && <button className="sp-secondary-btn" onClick={() => setImportOpen(true)}>Import CSV</button>}</div>
      <div className="sp-ledger-sections">
        <aside className="sp-ledger-aside">
      {transfers.length > 0 && (
        <div className="sp-settle-block">
          <div className="sp-settle-block-head">
            <div className="sp-block-title">Balances</div>
            <div className="sp-mode-tabs">
              <button className={mode === "simplified" ? "on" : ""} onClick={() => setMode("simplified")}>Simplified</button>
              <button className={mode === "pairwise" ? "on" : ""} onClick={() => setMode("pairwise")}>Who owes whom</button>
            </div>
          </div>

          {iOwe.map((t, i) => (
            <div key={`o${i}`} className="sp-transfer">
              <span className="sp-transfer-txt"><b>You</b> <ArrowRight size={13} /> <b>{nameOf(t.to)}</b></span>
              <span className="sp-transfer-amt neg">{fmtMoney(t.amount, group.currency)}</span>
              <button className="sp-mini-btn" onClick={() => { setSettleSuggest({ toUser: t.to, amountPaise: t.amount }); setSettleOpen(true); }}>Settle</button>
            </div>
          ))}
          {owedToMe.map((t, i) => (
            <div key={`i${i}`} className="sp-transfer">
              <span className="sp-transfer-txt"><b>{nameOf(t.from)}</b> → <b>You</b></span>
              <span className="sp-transfer-amt pos">{fmtMoney(t.amount, group.currency)}</span>
              {reminded.has(t.from)
                ? <span className="sp-mini-done">Nudged</span>
                : <button className="sp-mini-btn ghost" onClick={() => handleReminder(t.from, t.amount)}>Remind</button>}
            </div>
          ))}
          {transfers.filter(t => t.from !== userId && t.to !== userId).map((t, i) => (
            <div key={`x${i}`} className="sp-transfer muted">
              <span className="sp-transfer-txt">{nameOf(t.from)} → {nameOf(t.to)}</span>
              <span className="sp-transfer-amt">{fmtMoney(t.amount, group.currency)}</span>
            </div>
          ))}

          {(iOwe.length > 1 || owedToMe.length > 1) && (
            <div className="sp-batch-row">
              {iOwe.length > 1 && <button className="sp-mini-btn" disabled={batchBusy} onClick={handleSettleAll}>Settle all · {fmtMoney(iOweTotal, group.currency)}</button>}
              {owedToMe.length > 1 && <button className="sp-mini-btn ghost" disabled={batchBusy} onClick={handleRemindAll}>Remind all</button>}
            </div>
          )}
        </div>
      )}

      {/* Insights */}
      {insights && insights.count > 0 && (
        <div className="sp-insights">
          <button className="sp-insights-toggle" onClick={() => setInsightsOpen(o => !o)} aria-expanded={insightsOpen}>
            <span className="sp-block-title">Insights</span>
            <span className="sp-insights-total">{fmtMoney(insights.total, group.currency)} · {insights.count} expense{insights.count > 1 ? "s" : ""}</span>
            <ChevronRight size={15} className={`sp-insights-caret${insightsOpen ? " open" : ""}`} />
          </button>
          {insightsOpen && (
            <div className="sp-insights-body">
              <div className="sp-insights-sub">By category</div>
              {(() => {
                const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
                let cumulativePct = 0;
                const gradientStops = insights.categories.map((c, i) => {
                  const pct = insights.total ? (c.paise / insights.total) * 100 : 0;
                  const start = cumulativePct;
                  cumulativePct += pct;
                  return `${colors[i % colors.length]} ${start}% ${cumulativePct}%`;
                }).join(', ');
                
                return (
                  <div className="sp-donut-wrap">
                    <div className="sp-donut" style={{ background: insights.total ? `conic-gradient(${gradientStops})` : 'var(--surface)' }}>
                      <div className="sp-donut-hole">
                        <span className="sp-donut-val">{fmtMoney(insights.total, group.currency)}</span>
                      </div>
                    </div>
                    <div className="sp-donut-legend">
                      {insights.categories.map((c, i) => {
                        const meta = CAT_META[c.id] || CAT_META.other;
                        return (
                          <div key={c.id} className="sp-bar-row">
                            <span className="sp-bar-label">
                              <span className="sp-leg-dot" style={{ background: colors[i % colors.length] }} />
                              {meta.label}
                            </span>
                            <span className="sp-bar-val">{fmtMoney(c.paise, group.currency)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <div className="sp-insights-sub">Paid by</div>
              {members.map(m => {
                const paid = insights.paidByMember[m.id] || 0;
                const pct = insights.total ? Math.round((paid / insights.total) * 100) : 0;
                return (
                  <div key={m.id} className="sp-bar-row">
                    <span className="sp-bar-label">{m.name.split(" ")[0]}</span>
                    <span className="sp-bar-track"><span className="sp-bar-fill alt" style={{ width: `${pct}%` }} /></span>
                    <span className="sp-bar-val">{fmtMoney(paid, group.currency)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
        </aside>
        <section className="sp-activity">
      <div className="sp-activity-head"><div><span className="sp-kicker">TRANSACTION HISTORY</span><h3>Activity</h3></div><span>{ledger ? `${activity.length} ${activityFiltered ? "matching " : ""}${activity.length === 1 ? "entry" : "entries"}` : loadError ? "Unavailable" : "Loading"}</span></div>
      {ledger && (ledger.expenses.length > 0 || ledger.settlements.length > 0) && <div className="sc-toolbar sc-activity-filters"><input className="sp-input" aria-label="Search group expenses" placeholder="Search expenses in this group" value={search} onChange={e => setSearch(e.target.value)}/><select className="sp-input" aria-label="Group category filter" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{CATEGORIES.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}</select>{activityFiltered && <button className="sc-text-btn" onClick={() => { setSearch(""); setCategoryFilter("all"); }}>Clear filters</button>}{activityFiltered && hasSettlements && <p className="sp-hint">Filters apply to expenses. Recorded payments stay visible.</p>}</div>}
      {loadError && !ledger ? (
        <EmptyState compact icon={AlertTriangle} title="Activity unavailable" sub="Retry loading the ledger to see your expenses." />
      ) : ledger === null ? (
        <div className="sp-feed">
          {[0, 1, 2].map(i => <div key={i} className="sp-feed-row sp-skeleton" style={{ opacity: 1 - i * 0.25 }} />)}
        </div>
      ) : (ledger.expenses.length === 0 && ledger.settlements.length === 0) ? (
        <EmptyState compact icon={Receipt} title="No expenses yet" sub="Add the first one to start splitting." />
      ) : !activity.length ? (
        <div className="sc-list-empty"><Receipt size={24}/><h4>No expenses match</h4><p>Try another search or category.</p><button className="sc-text-btn" onClick={() => { setSearch(""); setCategoryFilter("all"); }}>Clear filters</button></div>
      ) : (
        <div className="sp-feed">
          {activity.map(item => item.kind === "expense"
            ? <ExpenseRow key={`e${item.row.id}`} e={item.row} shares={ledger.sharesByExpense[item.row.id] || []}
                userId={userId} group={group} nameOf={nameOf}
                confirmDel={confirmDelExp === item.row.id} warnDel={hasSettlements}
                onDetails={() => setDetail(item.row)} onEdit={() => { setEditingExpense(item.row); setExpenseOpen(true); }}
                onAskDel={() => setConfirmDelExp(item.row.id)}
                onCancelDel={() => setConfirmDelExp(null)}
                onDel={async () => { setConfirmDelExp(null); await deleteExpense(item.row.id, userId); reload(); }} />
            : <SettlementRow key={`s${item.row.id}`} s={item.row} userId={userId} group={group} nameOf={nameOf}
                onDel={async () => { await deleteSettlement(item.row.id, userId); reload(); }} />
          )}
        </div>
      )}
        </section>
      </div>

      {expenseOpen && (
        <ExpenseModal advanced={advanced} onGroupChanged={onGroupChanged} userId={userId} userName={userName} group={group} members={members}
          existing={editingExpense}
          existingShares={editingExpense ? (ledger?.sharesByExpense[editingExpense.id] || []) : null}
          onClose={() => { setExpenseOpen(false); setEditingExpense(null); }}
          onSaved={() => { setExpenseOpen(false); setEditingExpense(null); reload(); }} />
      )}
      {settleOpen && (
        <SettleModal userId={userId} userName={userName} group={group} members={members} suggested={settleSuggest}
          onClose={() => setSettleOpen(false)} onSettled={() => { setSettleOpen(false); reload(); }} />
      )}
      {editOpen && (
        <GroupModal userId={userId} userName={userName} friends={friends} existing={group} balances={balances}
          onClose={() => setEditOpen(false)} onSaved={(row) => { setEditOpen(false); onGroupChanged(row); }}
          onDeleted={() => { setEditOpen(false); onGroupDeleted?.(group.id); }} />
      )}
      {advanced && ledger && <CirclePanel group={group} userId={userId} userName={userName} expenses={ledger.expenses} onChanged={reload}/>}
      {detail && <ExpenseDetails expense={ledger?.expenses.find(e => e.id === detail.id) || detail} shares={ledger?.sharesByExpense[detail.id] || []} group={group} userId={userId} userName={userName} advanced={advanced} onClose={() => setDetail(null)}/>}
      {importOpen && <ImportExpenses group={group} existing={ledger?.expenses || []} userId={userId} userName={userName} onClose={() => setImportOpen(false)} onImported={reload}/>}
      {inviteOpen && (advanced ? <SecureInvite group={group} userId={userId} onClose={() => setInviteOpen(false)}/> : <InviteModal group={group} onClose={() => setInviteOpen(false)}/>)}
    </div>
  );
}

function mergeActivity(ledger) {
  const items = [
    ...ledger.expenses.map(row => ({ kind: "expense", row, t: row.created_at })),
    ...ledger.settlements.map(row => ({ kind: "settlement", row, t: row.created_at })),
  ];
  items.sort((a, b) => new Date(b.t) - new Date(a.t));
  return items;
}

function ExpenseRow({ e, shares, userId, group, nameOf, confirmDel, warnDel, onEdit, onAskDel, onCancelDel, onDetails, onDel }) {
  const CategoryIcon = CAT_ICONS[e.category] || Tag;
  const myShare = shares.find(s => s.user_id === userId);
  const iPaid = e.paid_by === userId;
  const mine = e.created_by === userId;
  const receipt = useReceipt(e.image_path);
  let lent = 0;
  if (iPaid) lent = toPaise(e.amount) - toPaise(myShare?.amount || 0);
  else if (myShare) lent = -toPaise(myShare.amount);

  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <div className="sp-feed-row">
      <span className="sp-feed-kind" aria-hidden="true"><CategoryIcon size={17} /></span>
      {receipt && (
        <a className="sp-feed-receipt" href={receipt} target="_blank" rel="noopener noreferrer">
          <img src={receipt} alt="receipt" loading="lazy" />
        </a>
      )}
      <div className="sp-feed-main">
        <div className="sp-feed-top">
          <button className="sc-text-btn sc-expense-title" onClick={onDetails}>{e.description}</button>
          <span className="sp-feed-total">{fmtMoney(toPaise(e.amount), group.currency)}</span>
        </div>
        <div className="sp-feed-sub">
          <span>{iPaid ? "You" : nameOf(e.paid_by)} paid · {timeAgo(e.created_at)}</span>
          {lent !== 0 && (
            <span className={lent > 0 ? "sp-lent pos" : "sp-lent neg"}>
              {lent > 0 ? "you lent " : "you borrowed "}{fmtMoney(Math.abs(lent), group.currency)}
            </span>
          )}
        </div>
      </div>
      {mine && (
        confirmDel
          ? <div className="sp-feed-confirm">
              {warnDel && <span className="sp-feed-warn" title="This group has settlements — deleting changes balances">⚠️</span>}
              <button className="sp-feed-del danger" onClick={onDel} aria-label="Confirm delete">Delete</button>
              <button className="sp-feed-del" onClick={onCancelDel} aria-label="Cancel">Cancel</button>
            </div>
          : optionsOpen
            ? <div className="sp-feed-confirm">
                <button className="sp-feed-del" onClick={onEdit} aria-label="Edit">Edit</button>
                <button className="sp-feed-del" onClick={onAskDel} aria-label="Delete">Delete</button>
                <button className="sp-feed-del" onClick={() => setOptionsOpen(false)} aria-label="Close options"><X size={13} /></button>
              </div>
            : <div className="sp-feed-confirm">
                <button className="sp-feed-del" style={{ padding: "6px" }} onClick={() => setOptionsOpen(true)} aria-label="Options"><Pencil size={14} /></button>
              </div>
      )}
    </div>
  );
}

function SettlementRow({ s, userId, group, nameOf, onDel }) {
  const mine = s.created_by === userId;
  const fromTxt = s.from_user === userId ? "You" : nameOf(s.from_user);
  const toTxt = s.to_user === userId ? "you" : nameOf(s.to_user);
  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <div className="sp-feed-row sp-feed-settle">
      <span className="sp-feed-kind" aria-hidden="true"><HandCoins size={17} /></span>
      <div className="sp-feed-main">
        <div className="sp-feed-top">
          <span className="sp-feed-desc">{fromTxt} paid {toTxt}</span>
          <span className="sp-feed-total pos">{fmtMoney(toPaise(s.amount), group.currency)}</span>
        </div>
        <div className="sp-feed-sub"><span>{s.note ? `${s.note} · ` : "settlement · "}{timeAgo(s.created_at)}</span></div>
      </div>
      {mine && (
        optionsOpen
          ? <div className="sp-feed-confirm">
              <button className="sp-feed-del" onClick={onDel} aria-label="Delete">Delete</button>
              <button className="sp-feed-del" onClick={() => setOptionsOpen(false)} aria-label="Close options"><X size={13} /></button>
            </div>
          : <div className="sp-feed-confirm">
              <button className="sp-feed-del" style={{ padding: "6px" }} onClick={() => setOptionsOpen(true)} aria-label="Options"><Pencil size={14} /></button>
            </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Global Insights Hero
// ═══════════════════════════════════════════════════════════════
export default function SplitPage(props) {
  return <SplitWorkspace key={props.userId} {...props} GroupLedger={GroupLedger} GroupModal={GroupModal}/>;
}
