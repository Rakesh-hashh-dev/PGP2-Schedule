import { useState } from "react";
import { reviewCSV, dayToday } from "../../lib/splitCircle.js";
import { saveCircleExpense } from "../../lib/splitCloud.js";
import { fmtMoney } from "../../lib/expenses.js";
import { Modal } from "./SplitUI.jsx";
async function fingerprint(key) { const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)); return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, "0")).join(""); }
export default function ImportExpenses({ group, existing, userId, userName, onClose, onImported }) {
  const [text, setText] = useState(""), [rows, setRows] = useState([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [completed, setCompleted] = useState(0);
  function review() { try { setRows(reviewCSV(text, group, userId, existing)); setError(""); setCompleted(0); } catch (e) { setError(e.message); setRows([]); } }
  async function save() {
    setBusy(true); setError(""); let count = 0;
    try {
      for (const row of rows.filter(r => !r.duplicate && !r.imported)) {
        await saveCircleExpense({ ...row, userId, userName, group, date: row.date || dayToday(), splitType: "exact", requestKey: "import:" + await fingerprint(row.importKey), importKey: row.importKey }, true);
        count++; setRows(prev => prev.map(r => r.importKey === row.importKey ? { ...r, imported: true } : r)); setCompleted(n => n + 1);
      }
      onImported(count);
    } catch (e) { setError(`Import paused: ${e.message}. Successfully saved rows will be skipped on retry.`); if (count) onImported(count); }
    finally { setBusy(false); }
  }
  return <Modal title={`Import into ${group.name}`} onClose={onClose} wide><p className="sp-hint">Required columns: description,amount,date. Values use the group's currency. Review the payer and shares; source keys prevent duplicate imports.</p><label className="sc-field">CSV file<input type="file" accept=".csv,text/csv" disabled={busy} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 2 * 1024 * 1024) { setError("Choose a CSV under 2 MB."); return; } setText(await f.text()); setRows([]); }}/></label><textarea className="sp-input" aria-label="CSV text" rows={6} value={text} disabled={busy} onChange={e => { setText(e.target.value); setRows([]); }} placeholder="description,amount,date"/><button className="sp-secondary-btn" disabled={busy || !text.trim()} onClick={review}>Review rows</button>{rows.length > 0 && <><div className="sc-import-rows">{rows.map((r, i) => <div key={i}><span>{r.description}<small>{r.date} · {r.paidBy === userId ? "You paid" : group.member_names?.[r.paidBy] || "Member paid"}</small></span><b>{fmtMoney(r.amountPaise, group.currency)}</b><small>{r.imported ? "Saved" : r.duplicate ? "Duplicate · skipped" : "Ready"}</small></div>)}</div><button className="sp-submit" disabled={busy || !rows.some(r => !r.duplicate && !r.imported)} onClick={save}>{busy ? "Importing…" : "Import reviewed rows"}</button></>}{completed > 0 && <p role="status">{completed} expense{completed === 1 ? "" : "s"} saved.</p>}{error && <p className="sp-error" role="alert">{error}</p>}</Modal>;
}
