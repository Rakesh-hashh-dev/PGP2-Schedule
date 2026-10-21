import { useEffect, useRef, useState } from "react";
import { ImagePlus, ScanLine, Plus, Trash2 } from "lucide-react";
import { CATEGORIES, resolveSplit, toPaise, fmtMoney, enqueueOfflineExpense } from "../../lib/expenses.js";
import { CURRENCIES, checkedMoney, currencyCode, dayToday, validDate, itemizedSplit, convertSplit, parseReceipt } from "../../lib/splitCircle.js";
import { saveCircleExpense, saveDefaultShares } from "../../lib/splitCloud.js";
import { Modal } from "./SplitUI.jsx";
import { useReceipt } from "../../lib/useSplitReceipt.js";

export default function ExpenseForm({ userId, userName, group, members, existing, existingShares, advanced = false, onClose, onSaved, onGroupChanged }) {
  const base = currencyCode(group.currency);
  const original = existing?.original_shares || Object.fromEntries((existingShares || []).map(s => [s.user_id, toPaise(s.amount)]));
  const [description, setDescription] = useState(existing?.description || "");
  const [amount, setAmount] = useState(existing ? String(existing.original_amount || existing.amount) : "");
  const [currency, setCurrency] = useState(existing?.original_currency || base);
  const [rate, setRate] = useState(String(existing?.exchange_rate || 1));
  const [paidBy, setPaidBy] = useState(existing?.paid_by || userId);
  const [category, setCategory] = useState(existing?.category || "food");
  const [date, setDate] = useState(existing?.expense_date || existing?.created_at?.slice(0, 10) || dayToday());
  const [notes, setNotes] = useState(existing?.notes || "");
  const [splitType, setSplitType] = useState(existing?.item_details?.length ? "items" : existing ? "exact" : Object.keys(group.default_shares || {}).length ? "shares" : "equal");
  const [participants, setParticipants] = useState(() => new Set(existing ? Object.keys(original) : members.map(m => m.id)));
  const [weights, setWeights] = useState(existing ? Object.fromEntries(Object.entries(original).map(([id, n]) => [id, n / 100])) : group.default_shares || {});
  const [items, setItems] = useState(existing?.item_details || []);
  const [adjustment, setAdjustment] = useState(String(existing?.adjustment || 0));
  const [printedTotal, setPrintedTotal] = useState(null);
  const [repeat, setRepeat] = useState(existing?.recurrence_interval || "never");
  const [keepRatio, setKeepRatio] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  const fileRef = useRef(null), mounted = useRef(true);
  const receipt = useReceipt(existing?.image_path);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const ids = members.map(m => m.id);
  const name = id => id === userId ? "You" : group.member_names?.[id] || "Member";
  let result = null, splitError = "";
  try {
    if (splitType === "items") result = itemizedSplit(items, adjustment, ids);
    else {
      const total = checkedMoney(amount || 0), selected = ids.filter(id => participants.has(id));
      if (Object.values(weights).some(n => !Number.isFinite(Number(n)) || Number(n) < 0)) throw new Error("Use nonnegative split values.");
      const r = resolveSplit(splitType, total, selected, weights);
      if (r.error) throw new Error(r.error);
      result = { total, shares: r.shares };
    }
  } catch (e) { splitError = e.message; }
  const mismatch = printedTotal !== null && result && Math.abs(toPaise(printedTotal) - result.total) > 1;
  function chooseMode(mode) {
    setSplitType(mode);
    if (mode === "items" && !items.length) setItems([{ name: "", amount: "", members: [...ids] }]);
    if (mode === "percent") setWeights(Object.fromEntries(ids.map((id, i) => [id, i === ids.length - 1 ? 100 - Math.floor(100 / ids.length) * (ids.length - 1) : Math.floor(100 / ids.length)])));
    if (mode === "shares") setWeights(group.default_shares || Object.fromEntries(ids.map(id => [id, 1])));
    if (mode === "exact" && Number(amount) > 0) { const r = resolveSplit("equal", toPaise(amount), ids); setWeights(Object.fromEntries(Object.entries(r.shares).map(([id, n]) => [id, n / 100]))); }
  }
  function pickImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) { setError("Choose a JPG, PNG or WebP under 8 MB."); return; }
    setImageFile(file); setPreview(URL.createObjectURL(file)); setError("");
  }
  async function scan() {
    if (!imageFile || scanBusy) return;
    setScanBusy(true); setError(""); setScanStatus("Loading receipt scanner…");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, { logger: m => { if (mounted.current && m.status === "recognizing text") setScanStatus(`Reading receipt… ${Math.round(m.progress * 100)}%`); } });
      try { const r = await worker.recognize(imageFile); if (mounted.current) { setOcrText(r.data.text); setScanStatus("Review the text, then extract items."); } } finally { await worker.terminate(); }
    } catch { if (mounted.current) setError("Unable to read this image. Paste receipt text or enter items manually."); }
    finally { if (mounted.current) setScanBusy(false); }
  }
  function extract() {
    const r = parseReceipt(ocrText, ids);
    if (!r.items.length) { setError("No price lines found. Use lines such as Pizza 450.00, or enter items manually."); return; }
    setItems(r.items); setAdjustment(String(r.adjustment)); setPrintedTotal(r.printedTotal); setSplitType("items"); setError("");
  }
  async function submit(event) {
    event.preventDefault(); if (busy || scanBusy) return;
    setError("");
    try {
      if (!description.trim() || !result?.total || splitError) throw new Error(splitError || "Enter a description and positive amount.");
      if (!validDate(date)) throw new Error("Choose a valid expense date.");
      if (mismatch) throw new Error("Reconcile items with the receipt total, or correct the printed total before saving.");
      const converted = currency === base ? { total: result.total, shares: result.shares } : convertSplit(result.shares, rate);
      const payload = { userId, userName, group, description, amountPaise: converted.total, paidBy, category, splitType, shares: converted.shares,
        imageFile, imagePath: existing?.image_path, date, notes, originalCurrency: currency, originalPaise: result.total, originalShares: result.shares,
        rate: currency === base ? 1 : Number(rate), items: splitType === "items" ? items : [], adjustment: splitType === "items" ? Number(adjustment) : 0,
        repeat, requestKey, expenseId: existing?.id, version: existing?.version };
      setBusy(true);
      if (!existing && navigator.onLine === false && !imageFile) { enqueueOfflineExpense(payload); onSaved({ queued: true }); return; }
      const row = await saveCircleExpense(payload, advanced);
      if (keepRatio && group.created_by === userId) {
        try { const updated = await saveDefaultShares(group, userId, splitType === "equal" ? Object.fromEntries([...participants].map(id => [id, 1])) : Object.fromEntries(Object.entries(weights).filter(([id]) => participants.has(id)).map(([id, n]) => [id, Number(n)]))); onGroupChanged?.(updated); } catch (e) { setError(`Expense saved; ratio update failed: ${e.message}`); onSaved(row); return; }
      }
      onSaved(row);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <Modal title={existing ? "Edit expense" : "Add an expense"} onClose={onClose} wide><form className="sc-form" onSubmit={submit}>
    <div className="sc-form-stage"><b>01</b><span>The expense<small>What did you share?</small></span></div>
    <label>Description<input className="sp-input" autoFocus required maxLength={100} value={description} onChange={e => setDescription(e.target.value)} placeholder="Dinner, a cab, groceries…"/></label>
    <div className="sp-row2"><label>Amount<input className="sp-input" type="number" min="0.01" step="0.01" value={splitType === "items" ? ((result?.total || 0) / 100).toFixed(2) : amount} disabled={splitType === "items"} onChange={e => setAmount(e.target.value)}/></label><label>Currency<select className="sp-input" aria-label="Currency" value={currency} disabled={!advanced} onChange={e => { setCurrency(e.target.value); setRate(e.target.value === base ? "1" : ""); }}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label></div>
    {currency !== base && <label>1 {currency} equals how many {base}?<input className="sp-input" type="number" step="any" min="0" required value={rate} onChange={e => setRate(e.target.value)}/><small>Use the rate on your payment receipt. The saved rate determines balances.</small></label>}
    <div className="sp-row2"><label>Paid by<select className="sp-input" value={paidBy} onChange={e => setPaidBy(e.target.value)}>{members.map(m => <option value={m.id} key={m.id}>{name(m.id)}</option>)}</select></label><label>Date<input className="sp-input" type="date" required disabled={!advanced} value={date} onChange={e => setDate(e.target.value)}/></label></div>
    <label>Category<select className="sp-input" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}</select></label>
    <div className="sc-form-stage"><b>02</b><span>Make it fair<small>Choose each person's share</small></span></div>
    <div className="sc-tabs" aria-label="Split method">{["equal", "exact", "percent", "shares", ...(advanced ? ["items"] : [])].map(mode => <button type="button" key={mode} aria-pressed={mode === splitType} className={mode === splitType ? "on" : ""} onClick={() => chooseMode(mode)}>{mode === "percent" ? "%" : mode}</button>)}</div>
    {splitType === "items" ? <><div className="sc-items">{items.map((item, index) => <div className="sc-item" key={index}><div className="sc-item-top"><input className="sp-input" aria-label={`Item ${index + 1} name`} placeholder="Item name" value={item.name} onChange={e => setItems(items.map((x, i) => i === index ? { ...x, name: e.target.value } : x))}/><input className="sp-input" aria-label={`Item ${index + 1} amount`} type="number" min="0.01" step="0.01" value={item.amount} onChange={e => setItems(items.map((x, i) => i === index ? { ...x, amount: e.target.value } : x))}/><button type="button" className="sp-icon-btn" aria-label={`Remove item ${index + 1}`} onClick={() => setItems(items.filter((_, i) => i !== index))}><Trash2 size={16}/></button></div><div className="sc-chips">{members.map(m => <label key={m.id}><input type="checkbox" checked={item.members.includes(m.id)} onChange={() => setItems(items.map((x, i) => i === index ? { ...x, members: x.members.includes(m.id) ? x.members.filter(id => id !== m.id) : [...x.members, m.id] } : x))}/>{name(m.id)}</label>)}</div></div>)}</div><button type="button" className="sp-secondary-btn" onClick={() => setItems([...items, { name: "", amount: "", members: [...ids] }])}><Plus size={15}/>Add item</button><label>Tax / tip (+) or discount (−)<input className="sp-input" type="number" step="0.01" value={adjustment} onChange={e => setAdjustment(e.target.value)}/></label>{printedTotal !== null && <label>Printed receipt total<input className="sp-input" type="number" step="0.01" value={printedTotal} onChange={e => setPrintedTotal(Number(e.target.value))}/>{mismatch && <small role="alert">Items do not match the printed total. Review amounts, taxes and discounts.</small>}</label>}</> : <div className="sp-split-list">{members.map(m => <div className="sp-split-row" key={m.id}><label className="sc-participant"><input type="checkbox" checked={participants.has(m.id)} onChange={() => setParticipants(prev => { const next = new Set(prev); next.has(m.id) ? next.delete(m.id) : next.add(m.id); return next; })}/>{name(m.id)}</label>{participants.has(m.id) && (splitType === "equal" ? <b>{fmtMoney(result?.shares[m.id] || 0, currency + " ")}</b> : <input className="sp-split-input" aria-label={`${name(m.id)} ${splitType}`} type="number" min="0" step="any" value={weights[m.id] ?? ""} onChange={e => setWeights({ ...weights, [m.id]: e.target.value })}/>)}</div>)}</div>}
    {advanced && group.created_by === userId && ["equal", "percent", "shares"].includes(splitType) && <label className="sc-check"><input type="checkbox" checked={keepRatio} onChange={e => setKeepRatio(e.target.checked)}/>Save these ratios for this group</label>}
    <div className="sc-form-stage"><b>03</b><span>A little context<small>Notes and receipts</small></span></div>
    <label>Note<textarea className="sp-input" maxLength={300} rows={2} value={notes} onChange={e => setNotes(e.target.value)}/></label>
    {advanced && <label>Repeat<select className="sp-input" value={repeat} onChange={e => setRepeat(e.target.value)}><option value="never">Never</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select><small>Review and post each due bill. No payment is charged automatically.</small></label>}
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickImage}/><div className="sc-actions"><button type="button" className="sp-secondary-btn" onClick={() => fileRef.current?.click()}><ImagePlus size={15}/>Attach receipt</button>{advanced && <button type="button" className="sp-secondary-btn" disabled={!imageFile || scanBusy} onClick={scan}><ScanLine size={15}/>{scanBusy ? "Reading…" : "Read receipt"}</button>}</div>
    {(preview || receipt) && <img className="sc-receipt-preview" src={preview || receipt} alt="Receipt for review"/>}
    {advanced && <details><summary>Review receipt text</summary><textarea aria-label="Receipt text" className="sp-input" rows={5} value={ocrText} onChange={e => setOcrText(e.target.value)} placeholder="Pizza 450.00"/><button type="button" className="sp-secondary-btn" disabled={scanBusy} onClick={extract}>Extract items</button><p className="sp-hint" aria-live="polite">{scanStatus || "Check every price, participant and total before saving."}</p></details>}
    {(error || splitError) && <div className="sp-error" role="alert">{error || splitError}</div>}
    <button className="sp-submit" disabled={busy || scanBusy || !description.trim() || !result?.total || !!splitError || mismatch}>{busy ? "Saving…" : existing ? "Save changes" : `Save ${fmtMoney(result?.total || 0, currency + " ")}`}</button>
  </form></Modal>;
}
