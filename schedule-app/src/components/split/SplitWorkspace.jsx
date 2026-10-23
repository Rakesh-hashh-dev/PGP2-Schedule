import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard, Users, Receipt, ChartNoAxesCombined, Repeat2, Plus, ChevronRight, Download, Search, RefreshCw, ArrowUpRight, ArrowDownLeft, Wallet, Check, Utensils, Car, ShoppingCart, Home, ShoppingBag, Lightbulb, PartyPopper, Tag } from "lucide-react";
import { CATEGORIES, fetchMyGroups, fetchGroupLedger, subscribeMyGroups, subscribeGroupLedger, joinGroup, flushQueue, fmtMoney, toPaise } from "../../lib/expenses.js";
import { splitFeatures, acceptSecureInvite, getPreferences, savePreferences } from "../../lib/splitCloud.js";
import { analytics, balancesByCurrency, currencyCode, dayToday, expenseDate, exportCSV, downloadFile } from "../../lib/splitCircle.js";
import { CirclePanel } from "./Collaboration.jsx";
import MobileV2Breadcrumbs from "../mobile/MobileV2Breadcrumbs.jsx";
import { useBackClose } from "../../lib/backClose.js";
const tabs = [["overview", LayoutDashboard, "Overview"], ["groups", Users, "Groups"], ["expenses", Receipt, "Expenses"], ["insights", ChartNoAxesCombined, "Insights"], ["recurring", Repeat2, "Recurring"]];
const categoryIcons = { food: Utensils, travel: Car, groceries: ShoppingCart, stay: Home, shopping: ShoppingBag, utilities: Lightbulb, entertainment: PartyPopper, other: Tag };
const monthLabel = value => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));

export default function SplitWorkspace({ userId, userName, friends, initialGroupId, initialJoinId, onConsumeDeepLink, GroupLedger, GroupModal, v2Navigation }) {
  const [ready, setReady] = useState(false);
  const [groups, setGroups] = useState([]), [ledgers, setLedgers] = useState({}), [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState("overview"), [loading, setLoading] = useState(true), [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState(""), [creating, setCreating] = useState(false), [search, setSearch] = useState(""), [category, setCategory] = useState("all");
  const [groupSearch, setGroupSearch] = useState(""), [groupStatus, setGroupStatus] = useState("all");
  const [month, setMonth] = useState(dayToday().slice(0, 7)), [currency, setCurrency] = useState("INR"), [selectedGroup, setSelectedGroup] = useState("all");
  const [preferences, setPreferences] = useState({ budget: 0, currency: "INR" }), [budgetInput, setBudgetInput] = useState("15000"), [budgetBusy, setBudgetBusy] = useState(false);
  const joining = useRef(null), generation = useRef(0);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    try {
      const result = await fetchMyGroups(userId);
      const data = await Promise.all(result.map(g => fetchGroupLedger(g.id)));
      if (request !== generation.current) return;
      setReady(true); setGroups(result); setLedgers(Object.fromEntries(result.map((g, i) => [g.id, data[i]]))); setError("");
    } catch (e) { if (request === generation.current) { setReady(false); setError(e.message); } }
    finally { if (request === generation.current) setLoading(false); }
  }, [userId]);
  useEffect(() => { const timer = setTimeout(reload, 0); const unsub = subscribeMyGroups(userId, reload); const invalidate = () => { generation.current++; }; return () => { clearTimeout(timer); invalidate(); unsub(); }; }, [userId, reload]);
  useEffect(() => {
    let alive = true;
    splitFeatures().then(async available => { if (!alive) return; setAdvanced(available); if (available) { try { const p = await getPreferences(userId); if (alive) { setPreferences(p); setBudgetInput(String(p.budget)); setCurrency(p.currency); } } catch (e) { if (alive) setError(e.message); } } });
    return () => { alive = false; };
  }, [userId]);
  const groupKey = groups.map(g => g.id).join(",");
  useEffect(() => {
    let timer; const refresh = () => { clearTimeout(timer); timer = setTimeout(reload, 150); };
    const unsubs = groupKey.split(",").filter(Boolean).map(id => subscribeGroupLedger(id, refresh));
    const online = () => { void flushQueue(userId).then(reload); };
    window.addEventListener("online", online); void flushQueue(userId).then(n => { if (n) refresh(); });
    return () => { clearTimeout(timer); unsubs.forEach(fn => fn()); window.removeEventListener("online", online); };
  }, [groupKey, userId, reload]);
  useEffect(() => {
    if (!initialJoinId || !userId || joining.current === initialJoinId) return;
    joining.current = initialJoinId;
    const run = /^[a-f0-9]{64}$/i.test(initialJoinId) ? acceptSecureInvite(initialJoinId, userName) : joinGroup(initialJoinId, userName);
    Promise.resolve(run).then(row => { if (!row) throw new Error("This invitation is unavailable. Ask the owner for a new link."); setActiveId(row.id); void reload(); }).catch(e => setError(e.message)).finally(() => onConsumeDeepLink?.());
  }, [initialJoinId, userId, userName, reload, onConsumeDeepLink]);
  useEffect(() => {
    if (!initialGroupId || loading) return;
    const timer = setTimeout(() => { if (groups.some(g => g.id === initialGroupId)) setActiveId(initialGroupId); else setError("This group is unavailable to your account."); onConsumeDeepLink?.(); }, 0);
    return () => clearTimeout(timer);
  }, [initialGroupId, loading, groups, onConsumeDeepLink]);
  const entries = useMemo(() => groups.flatMap(g => (ledgers[g.id]?.expenses || []).map(e => ({ ...e, group: g, shares: ledgers[g.id]?.sharesByExpense[e.id] || [] }))).sort((a, b) => expenseDate(b).localeCompare(expenseDate(a))), [groups, ledgers]);
  const filtered = entries.filter(e => (selectedGroup === "all" || e.group.id === selectedGroup) && (category === "all" || e.category === category) && (e.description + e.group.name).toLowerCase().includes(search.trim().toLowerCase()));
  const totals = balancesByCurrency(groups, ledgers, userId), summary = totals[currency] || { net: 0, owe: 0, owed: 0 };
  const stats = analytics(entries, userId, month, currency);
  const active = groups.find(g => g.id === activeId);
  // An open group is a step of its own: back returns to the group list.
  useBackClose(() => { setActiveId(null); void reload(); }, Boolean(activeId));
  const codes = [...new Set([currency, "INR", ...Object.keys(totals)])];
  const groupBalances = Object.fromEntries(groups.map(g => [g.id, balancesByCurrency([g], ledgers, userId)[currencyCode(g.currency)]?.net || 0]));
  const visibleGroups = groups.filter(g => g.name.toLowerCase().includes(groupSearch.trim().toLowerCase()) && (groupStatus === "all" || (groupStatus === "settled" ? groupBalances[g.id] === 0 : groupBalances[g.id] !== 0)));
  const filtersActive = search.trim() || category !== "all" || selectedGroup !== "all";
  function clearFilters() { setSearch(""); setCategory("all"); setSelectedGroup("all"); }
  function exportData(json = false) {
    if (json) downloadFile(JSON.stringify({ format: "termflow-split-v1", exported_at: new Date().toISOString(), groups, ledgers, preferences, excludes: ["receipt image bytes", "comments", "audit history"] }, null, 2), "termflow-split-ledger.json", "application/json");
    else downloadFile(exportCSV(filtered), "termflow-split-expenses.csv", "text/csv");
  }
  const openGroup = g => { setActiveId(g.id); };
  async function saveBudget(e) { e.preventDefault(); setBudgetBusy(true); try { const p = await savePreferences(userId, budgetInput, currency); setPreferences(p); setError(""); } catch (e) { setError(e.message); } finally { setBudgetBusy(false); } }
  function groupCards() {
    const shown = tab === "overview" ? groups.slice(0, 3) : visibleGroups;
    return <div className="sc-group-grid">{shown.map((g, index) => {
      const b = groupBalances[g.id];
      return <button key={g.id} className={`sc-group-card tone-${index % 3}`} onClick={() => openGroup(g)}>
        <div><span className="sc-group-icon"><Users size={20}/></span><span className="sc-group-currency">{currencyCode(g.currency)}</span><ChevronRight size={16}/></div>
        <h3>{g.name}</h3><p>{g.member_ids.length} members · {ledgers[g.id]?.expenses.length || 0} expense{ledgers[g.id]?.expenses.length === 1 ? "" : "s"}</p>
        <div className="sc-avatar-stack">{g.member_ids.slice(0, 4).map(id => <span key={id} title={g.member_names?.[id]}>{(g.member_names?.[id] || "?").trim().split(/\s+/).map(n => n[0]).slice(0, 2).join("")}</span>)}{g.member_ids.length > 4 && <span title={`${g.member_ids.length - 4} more members`}>+{g.member_ids.length - 4}</span>}</div>
        <footer className={b < 0 ? "neg" : "pos"}>{b === 0 ? <><Check size={14}/>All settled up</> : <><span>{b > 0 ? "You are owed" : "You owe"}</span><strong>{fmtMoney(Math.abs(b), g.currency)}</strong></>}</footer>
      </button>;
    })}</div>;
  }
  function expenseList(limit) {
    return <div className="sc-expense-list">{filtered.slice(0, limit).map(e => {
      const mine = toPaise(e.shares.find(s => s.user_id === userId)?.amount || 0), Icon = categoryIcons[e.category] || Tag;
      const date = expenseDate(e);
      const label = new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
      return <button key={e.id} className="sc-expense-line" onClick={() => openGroup(e.group)}>
        <time className="sc-date" dateTime={date} title={label}><small>{new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</small><b>{date.slice(-2)}</b></time>
        <span className="sc-expense-icon" aria-hidden="true"><Icon size={18}/></span><span className="sc-expense-copy"><strong>{e.description}</strong><small>{e.group.name} · {e.paid_by === userId ? "You" : e.group.member_names?.[e.paid_by] || "Member"} paid {fmtMoney(toPaise(e.amount), e.group.currency)}</small></span><span className="sc-expense-value"><b>{fmtMoney(mine, e.group.currency)}</b><small>your share</small></span><ChevronRight size={14} aria-hidden="true"/>
      </button>;
    })}{!filtered.length && <div className="sc-list-empty"><Receipt size={24}/><h4>{filtersActive ? "No expenses match" : "Your shared spending starts here"}</h4><p>{filtersActive ? "Try another search, category or group." : "Open a group and add an expense to see it here."}</p>{filtersActive ? <button className="sc-text-btn" onClick={clearFilters}>Clear filters</button> : <button className="sc-text-btn" onClick={() => setTab("groups")}>Go to groups <ChevronRight size={14}/></button>}</div>}</div>;
  }
  function insightCards() {
    const budget = preferences.currency === currency ? toPaise(preferences.budget) : 0, used = budget ? Math.round(stats.total / budget * 100) : 0, max = Math.max(1, ...stats.daily);
    return <><div className="sc-insight-grid"><article className="sc-panel sc-rhythm"><div className="sc-panel-heading"><h3>Spending rhythm</h3><span>{monthLabel(month)}</span></div><strong className="sc-large-number">{fmtMoney(stats.total, currency + " ")}</strong><p>Your share this month</p><div className="sc-daily" aria-label="Daily spending">{stats.daily.map((n, i) => <button key={i} aria-label={`${i + 1} ${month}: ${fmtMoney(n, currency + " ")}`} title={`${i + 1} ${month}: ${fmtMoney(n, currency + " ")}`} style={{ "--bar": `${Math.max(3, n / max * 100)}%` }}><i/></button>)}</div><div className="sc-axis"><span>1 {monthLabel(month)}</span><span>{stats.daily.length} {monthLabel(month)}</span></div></article><article className="sc-panel sc-budget"><div className="sc-panel-heading"><h3>Room to spend</h3><Wallet size={17}/></div><div className={`sc-budget-ring${used > 100 ? " over" : ""}`} style={{ "--progress": `${Math.min(100, used)}%` }}><span><b>{budget ? used + "%" : "—"}</b><small>{budget ? "of your budget" : "No budget set"}</small></span></div><p>{budget ? `${fmtMoney(Math.abs(budget - stats.total), currency + " ")} ${stats.total > budget ? "over budget" : "remaining"}` : "Set a budget for this currency"}</p></article><article className="sc-panel"><div className="sc-panel-heading"><h3>Month over month</h3><ChartNoAxesCombined size={17}/></div><strong className="sc-large-number">{stats.prior ? `${Math.round(Math.abs(stats.total - stats.prior) / stats.prior * 100)}%` : "—"}</strong><p>{stats.prior ? `${stats.total >= stats.prior ? "Higher" : "Lower"} than ${monthLabel(stats.previous)}` : "No baseline for the previous month"}</p><div className="sc-compare"><span>{monthLabel(stats.previous)}<b>{fmtMoney(stats.prior, currency + " ")}</b></span><span>{monthLabel(month)}<b>{fmtMoney(stats.total, currency + " ")}</b></span></div><small>The selected month may still be in progress.</small></article></div>{tab === "insights" && <div className="sc-insight-grid"><article className="sc-panel"><h3>By category</h3>{!stats.categories.length && <p className="sc-empty">No shared spending in {monthLabel(month)} for {currency}.</p>}{stats.categories.map(([id, n]) => <div className="sc-category" key={id}><span>{CATEGORIES.find(c => c.id === id)?.label || "Other"}</span><b>{fmtMoney(n, currency + " ")}</b><i style={{ width: `${stats.total ? n / stats.total * 100 : 0}%` }}/></div>)}</article><article className="sc-panel"><h3>Worth a closer look</h3>{stats.spikes.length ? stats.spikes.map(e => <p key={e.id}><b>{e.description}</b><br/>Your share exceeds twice the category's earlier median.</p>) : <p className="sc-empty">No spending spikes found. At least three earlier category expenses are needed.</p>}</article><article className="sc-panel"><h3>Your monthly budget</h3>{advanced ? <form onSubmit={saveBudget}><label className="sc-field">Budget ({currency})<input className="sp-input" type="number" min="0" step="0.01" required value={budgetInput} onChange={e => setBudgetInput(e.target.value)}/></label><button className="sp-add-btn" disabled={budgetBusy}>{budgetBusy ? "Saving…" : "Save budget"}</button></form> : <p className="sp-hint">Personal budgets will be available after the workspace update.</p>}<p className="sp-hint">Your preference is private to your account. Saving a new currency replaces your current budget.</p></article></div>}</>;
  }
  if (active) return <div className="sc-workspace"><GroupLedger v2Navigation={v2Navigation} key={active.id} userId={userId} userName={userName} friends={friends} group={active} advanced={advanced} onBack={() => { setActiveId(null); void reload(); }} onGroupChanged={row => { setGroups(prev => prev.map(g => g.id === row.id ? row : g)); void reload(); }} onGroupDeleted={() => { setActiveId(null); void reload(); }}/></div>;
  return (
    <div className="sp-pg sc-workspace">
      {v2Navigation && <MobileV2Breadcrumbs view="split" {...v2Navigation} />}
      <header className="sc-header">
        <div><span className="sc-eyebrow">TERMFLOW / SPLIT</span><h2>Shared plans.<span> Clear balances.</span></h2><p>Keep track of what you share, what you owe and what comes next.</p></div>
        <div className="sc-actions"><button className="sp-secondary-btn" onClick={() => exportData()} disabled={loading || !ready || !filtered.length}><Download size={15}/>Export CSV</button><button className="sp-add-btn" onClick={() => setCreating(true)}><Plus size={16}/>New group</button></div>
      </header>
      <nav className="sc-nav" aria-label="Split sections">{tabs.map(([id, Icon, label]) => <button key={id} aria-current={id === tab ? "page" : undefined} className={id === tab ? "on" : ""} onClick={() => setTab(id)}><Icon size={17}/>{label}{id === "groups" && <small>{groups.length}</small>}</button>)}</nav>
      {error && <div className="sp-error sc-error" role="alert"><span>{error}</span><button className="sp-secondary-btn" onClick={reload}><RefreshCw size={14}/>Retry</button></div>}
      {loading ? <div className="sc-loading" role="status"><span>Loading your shared expenses…</span><div className="sc-stats" aria-hidden="true">{[0, 1, 2].map(i => <div className="sc-stat sc-placeholder" key={i}><i/><i/><i/></div>)}</div></div> : !ready ? <p className="sc-empty">Your balances are unavailable. Retry loading your shared expenses.</p> : <>
        {tab !== "recurring" && <div className="sc-context">
          <div><h3>{({ overview: "Your shared spending", groups: "Your groups", expenses: "Expense history", insights: "Spending insights" })[tab]}</h3><p>{tab === "insights" ? "Your personal share, by month and currency." : tab === "expenses" ? "All dates and currencies. Select an expense to open its group." : "Balances include all dates. Each currency is kept separate."}</p></div>
          <div className="sc-toolbar">
            {tab === "insights" && <label className="sc-field">Month<input className="sp-input" type="month" value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }}/></label>}
            {tab !== "expenses" && <label className="sc-field">{tab === "insights" ? "Spending currency" : "Balance currency"}<select className="sp-input" value={currency} onChange={e => setCurrency(e.target.value)}>{codes.map(c => <option key={c}>{c}</option>)}</select></label>}
            {tab === "expenses" && <button className="sp-secondary-btn" onClick={() => exportData(true)} disabled={!groups.length}><Download size={15}/>Ledger backup</button>}
          </div>
        </div>}
        {["overview", "groups"].includes(tab) && <section className="sc-stats" aria-label={`All-time balances in ${currency}`}>
          <article className="sc-stat sc-stat-main"><Wallet size={20}/><span>YOUR NET BALANCE · {currency}</span><strong>{fmtMoney(Math.abs(summary.net), currency + " ")}</strong><p>{summary.net > 0 ? "Overall, you are owed" : summary.net < 0 ? "Overall, you owe" : summary.owe || summary.owed ? "Your balances offset across groups" : "No outstanding balance"}</p></article>
          <article className="sc-stat sc-stat-owed"><ArrowUpRight size={20}/><span>YOU ARE OWED</span><strong>{fmtMoney(summary.owed, currency + " ")}</strong><p>Across your groups in {currency}</p></article>
          <article className="sc-stat sc-stat-owe"><ArrowDownLeft size={20}/><span>YOU OWE</span><strong>{fmtMoney(summary.owe, currency + " ")}</strong><p>Across your groups in {currency}</p></article>
        </section>}
        {["overview", "groups"].includes(tab) && <section>
          <div className="sc-section-heading"><div><h3>Your circles <small>{groups.length}</small></h3><p>A group for each trip, dinner or everyday plan.</p></div><button className="sc-text-btn" onClick={() => tab === "overview" && groups.length ? setTab("groups") : setCreating(true)}>{tab === "overview" && groups.length ? <>View all groups <ChevronRight size={14}/></> : <>Create group <Plus size={14}/></>}</button></div>
          {tab === "groups" && groups.length > 0 && <div className="sc-toolbar sc-group-filters"><label className="sc-search"><Search size={16}/><input aria-label="Search groups" placeholder="Find a group" value={groupSearch} onChange={e => setGroupSearch(e.target.value)}/></label><div className="sc-filter-pills" aria-label="Group balance filters">{[["all", "All groups"], ["open", "Outstanding"], ["settled", "Settled"]].map(([id, label]) => <button key={id} aria-pressed={groupStatus === id} className={groupStatus === id ? "on" : ""} onClick={() => setGroupStatus(id)}>{label}</button>)}</div></div>}
          {groups.length ? tab === "groups" && !visibleGroups.length ? <div className="sc-list-empty"><Search size={24}/><h4>No groups match</h4><p>Try another name or balance filter.</p><button className="sc-text-btn" onClick={() => { setGroupSearch(""); setGroupStatus("all"); }}>Clear group filters</button></div> : groupCards() : <div className="sc-welcome"><span className="sc-welcome-icon"><Users size={28}/></span><h3>Start with a circle.</h3><p>Bring your people together, add a shared expense<br/>and let the balances take care of themselves.</p><button className="sp-add-btn" onClick={() => setCreating(true)}><Plus size={16}/>Create your first group</button><div className="sc-welcome-steps"><span>1. Create a group</span><ChevronRight size={13}/><span>2. Add an expense</span><ChevronRight size={13}/><span>3. Settle up</span></div></div>}
        </section>}
        {["overview", "expenses"].includes(tab) && <section className="sc-panel sc-expenses">
          <div className="sc-section-heading"><div><h3>{tab === "overview" ? "Recent expenses" : "All expenses"}</h3><p>{filtersActive ? `${filtered.length} of ${entries.length} expenses match your filters` : `${entries.length} shared expense${entries.length === 1 ? "" : "s"} · all dates`}</p></div>{tab === "overview" && <button className="sc-text-btn" onClick={() => setTab("expenses")}>View all <ChevronRight size={14}/></button>}</div>
          <div className="sc-toolbar"><label className="sc-search"><Search size={16}/><input aria-label="Search expenses" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses or groups"/></label><select className="sp-input" aria-label="Filter category" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select><select className="sp-input" aria-label="Filter group" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}><option value="all">All groups</option>{groups.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select>{filtersActive && <button className="sc-text-btn" onClick={clearFilters}>Clear filters</button>}</div>
          {expenseList(tab === "overview" ? 6 : filtered.length)}
        </section>}
        {tab === "overview" && entries.length > 0 && <div className="sc-insights-link"><span className="sc-group-icon"><ChartNoAxesCombined size={20}/></span><div><h3>See the bigger picture.</h3><p>Explore your monthly spending, categories and budget.</p></div><button className="sc-text-btn" onClick={() => setTab("insights")}>Spending insights <ArrowUpRight size={16}/></button></div>}
        {tab === "insights" && insightCards()}
        {tab === "recurring" && <><div className="sc-section-heading"><div><h3>Recurring bills</h3><p>Review and post each due bill to its group.</p></div></div>{!groups.length ? <div className="sc-welcome"><Repeat2 size={28}/><h3>Give regular bills a home.</h3><p>Create a group to keep recurring expenses together.</p><button className="sp-add-btn" onClick={() => setCreating(true)}>Create group</button></div> : advanced ? groups.map(g => <section key={g.id}><div className="sc-section-heading"><h3>{g.name}</h3><button className="sc-text-btn" onClick={() => openGroup(g)}>Open group <ChevronRight size={14}/></button></div><CirclePanel group={g} userId={userId} userName={userName} expenses={ledgers[g.id]?.expenses || []} onChanged={reload}/></section>) : <div className="sc-panel"><p>Recurring schedules will be available after the workspace update.</p></div>}</>}
      </>}
      {creating && <GroupModal userId={userId} userName={userName} friends={friends} existing={null} balances={{}} onClose={() => setCreating(false)} onSaved={row => { setCreating(false); setGroups(prev => [row, ...prev]); setActiveId(row.id); void reload(); }}/>}
    </div>
  );
}
