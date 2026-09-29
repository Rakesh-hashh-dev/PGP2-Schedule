import { useMemo, useState } from "react";
import { Clock3, RotateCcw } from "lucide-react";
import { getConfigHistoryDiff } from "../lib/configHistory";
import "../styles/config-history.css";

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function ConfigHistoryPanel({ history = [], liveFlags, hasStagedChanges = false, isReadOnly = false, onStage }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const entries = useMemo(() => history.filter(entry => entry?.flags && typeof entry.flags === "object" && !Array.isArray(entry.flags)), [history]);
  const selected = entries[selectedIndex] || null;
  const diff = useMemo(() => selected ? getConfigHistoryDiff(liveFlags, selected.flags) : [], [liveFlags, selected]);

  async function stage() {
    if (!selected || confirmText.trim().toUpperCase() !== "RESTORE" || busy || isReadOnly) return;
    setBusy(true);
    setError("");
    try {
      await onStage(selected);
      setConfirming(false);
      setConfirmText("");
    } catch (cause) {
      setError(cause?.message || "Could not stage this version.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="admin-card admin-g-system system-control-card config-history-card">
    <h2><Clock3 size={20} color="var(--blue)" /> Configuration history</h2>
    <p className="admin-subtext">Review a saved version against the live configuration. Restoring loads it into the editor; use Review changes and Deploy Config to publish it.</p>
    {entries.length === 0 ? <div className="admin-empty">No previous deployments are saved yet.</div> : <>
      <label className="config-history-picker">Previous version
        <select className="admin-input" value={Math.min(selectedIndex, entries.length - 1)} onChange={event => { setSelectedIndex(Number(event.target.value)); setConfirming(false); setConfirmText(""); setError(""); }}>
          {entries.map((entry, index) => <option value={index} key={`${entry.timestamp || "unknown"}-${index}`}>{formatDate(entry.timestamp)} · {entry.author || "Admin"}</option>)}
        </select>
      </label>
      <div className="config-history-meta"><span>{diff.length} setting{diff.length === 1 ? "" : "s"} would change</span><span>Captured during deploy by {selected.author || "Admin"}</span></div>
      {diff.length === 0 ? <div className="admin-empty">This version matches the live settings shown here.</div> : <div className="config-history-diff" role="list" aria-label="Settings that would change">
        {diff.map(change => <div className="config-history-change" role="listitem" key={change.key}>
          <strong>{change.label}</strong><span><small>Live</small>{change.before}</span><span><small>Version</small>{change.after}</span>
          {change.details && <em>{change.details}</em>}
          <details className="config-history-exact"><summary>Inspect exact values</summary><div><pre>{change.beforeRaw}</pre><pre>{change.afterRaw}</pre></div></details>
        </div>)}
      </div>}
      {!confirming ? <button type="button" className="admin-btn outline" disabled={isReadOnly || diff.length === 0 || !onStage} onClick={() => setConfirming(true)}><RotateCcw size={15} /> Stage this version</button> : <div className="config-history-confirm">
        <strong>Stage the selected version?</strong>
        <p>{hasStagedChanges ? "This replaces your current unsaved edits. " : ""}The change stays local until you review and deploy it. Current scheduled deploys are preserved.</p>
        <label>Type RESTORE to continue<input className="admin-input" value={confirmText} onChange={event => setConfirmText(event.target.value)} onKeyDown={event => { if (event.key === "Enter") stage(); }} /></label>
        <div><button type="button" className="admin-btn outline" disabled={busy} onClick={() => { setConfirming(false); setConfirmText(""); }}>Cancel</button><button type="button" className="admin-btn primary" disabled={busy || confirmText.trim().toUpperCase() !== "RESTORE"} onClick={stage}>{busy ? "Staging…" : "Stage version"}</button></div>
      </div>}
      {error && <p className="config-history-error" role="alert">{error}</p>}
    </>}
  </section>;
}
