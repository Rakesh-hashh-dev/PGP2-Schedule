import { useState } from "react";
import { Lock, Plus, ChevronDown } from "lucide-react";
import { mutatePrivateBusyTime } from "../lib/planningUi.js";

function blockDate(value) { return new Date(value).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }); }
function blockTime(value) { return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

export default function SocialBusyBlocks({ userId, availability }) {
  const { blocks, loaded, error: loadError, refresh } = availability;
  const [draft, setDraft] = useState({ start: "", end: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);
  const [adding, setAdding] = useState(false);
  const mutate = async (kind, blockId) => {
    if (saving) return;
    setSaving(blockId || "add"); setError("");
    try {
      const next = await mutatePrivateBusyTime({ userId, kind, draft, blockId });
      if (kind === "add") { setDraft(next); setAdding(false); }
      window.dispatchEvent(new CustomEvent("pgp2:social-availability"));
    } catch (err) { setError(err.message); }
    finally { setSaving(null); }
  };
  return <details className="fr-private-availability fr-planning-private"><summary><Lock size={14} /><span>Private busy time</span><span className="fr-planning-block-count">{loaded ? `${blocks.length} block${blocks.length === 1 ? "" : "s"}` : loadError ? "Unavailable" : "Checking…"}</span><ChevronDown size={14} /></summary>
    <div className="fr-planning-private-body"><p className="fr-planning-confidence">Only you can see these blocks. They keep suggestions clear of your busy time.</p>
      {loadError ? <p className="fr-meetup-error" role="alert">{loadError} <button type="button" className="fr-text-button" onClick={refresh}>Retry</button></p> : !loaded ? <p className="fr-extra-help" role="status">Loading your private blocks…</p> : <>
        {!blocks.length && <p className="fr-private-empty">No private blocks yet. Add time you want to keep for yourself.</p>}
        <ul className="fr-private-blocks">{blocks.map(block => <li key={block.id}><div><strong>{blockDate(block.starts_at)}</strong><span>{blockTime(block.starts_at)}–{blockDate(block.starts_at) !== blockDate(block.ends_at) ? `${blockDate(block.ends_at)} · ` : ""}{blockTime(block.ends_at)}</span></div><button type="button" className="fr-text-button" aria-label={`Remove busy block on ${blockDate(block.starts_at)} at ${blockTime(block.starts_at)}`} disabled={Boolean(saving)} onClick={() => void mutate("remove", block.id)}>{saving === block.id ? "Removing…" : "Remove"}</button></li>)}</ul>
      </>}
      <button type="button" className="fr-text-button fr-private-add-toggle" aria-expanded={adding} onClick={() => setAdding(value => !value)}><Plus size={14} />{adding ? "Close add form" : "Add busy time"}</button>
      {adding && <form onSubmit={event => { event.preventDefault(); void mutate("add"); }}><fieldset disabled={Boolean(saving)}><div className="fr-private-add-fields"><label>Busy from<input className="fr-add-input" required type="datetime-local" value={draft.start} onChange={event => setDraft(current => ({ ...current, start: event.target.value }))} /></label><label>Until<input className="fr-add-input" required type="datetime-local" min={draft.start || undefined} value={draft.end} onChange={event => setDraft(current => ({ ...current, end: event.target.value }))} /></label><button type="submit" className="fr-btn fr-btn-secondary fr-btn-small">{saving === "add" ? "Saving…" : "Save private block"}</button></div></fieldset></form>}
      {error && <p role="alert" className="fr-meetup-error">{error} Your unsaved busy-time details are kept.</p>}
    </div>
  </details>;
}
