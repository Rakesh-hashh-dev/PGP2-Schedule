import { useCallback, useEffect, useState } from "react";
import { Pin, Plus, Trash2, ExternalLink } from "lucide-react";
import { fetchGroupPins, saveGroupPin, removeGroupPin } from "../lib/socialActivity.js";
import { safeUrl } from "../lib/safeUrl.js";
import { supabase } from "../lib/supabase.js";

export default function GroupPins({ group, userId, userName }) {
  const [pins, setPins] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const load = useCallback(async () => {
    try { setPins(await fetchGroupPins(group)); setLoaded(true); setLoadError(""); } catch (err) { setLoaded(true); setLoadError(err.message); }
  }, [group]);
  useEffect(() => {
    let alive = true;
    fetchGroupPins(group).then(data => { if (alive) { setPins(data); setLoaded(true); setLoadError(""); } }).catch(err => { if (alive) { setLoadError(err.message); setLoaded(true); } });
    const reload = () => { if (alive) load(); };
    const channel = supabase.channel(`social-pins:${group.id}`).on("postgres_changes", { event: "*", schema: "public", table: "social_group_pins", filter: `group_id=eq.${group.id}` }, reload).subscribe();
    window.addEventListener("pgp2:social-pins", reload);
    return () => { alive = false; supabase.removeChannel(channel); window.removeEventListener("pgp2:social-pins", reload); };
  }, [group, load]);
  const add = async event => {
    event.preventDefault();
    const link = url.trim() ? safeUrl(url) : null;
    if (url.trim() && (!/^https?:\/\//i.test(url.trim()) || !link)) { setError("Use a complete http or https link."); return; }
    setBusy(true); setError("");
    try { await saveGroupPin({ groupId: group.id, userId, userName, title, body, url: link }); setTitle(""); setBody(""); setUrl(""); setOpen(false); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const remove = async id => { setBusy(true); setError(""); try { await removeGroupPin(id); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <section className="fr-pins" aria-label={`Pinned information for ${group.name}`}>
    <div className="fr-extra-head"><h3><Pin size={14} /> Pinned information</h3><button type="button" className="fr-btn fr-btn-secondary fr-btn-small" disabled={!loaded || Boolean(loadError) || busy} onClick={() => setOpen(value => !value)} aria-expanded={open}><Plus size={13} />{open ? "Close" : "Add pin"}</button></div>
    {pins.length > 0 && <div className="fr-pin-list">{pins.map(pin => { const link = pin.url && /^https?:\/\//i.test(pin.url) ? safeUrl(pin.url) : null; return <article className="fr-pin" key={pin.id}><div><strong>{pin.title}</strong>{pin.body && <p>{pin.body}</p>}{link && <a href={link} target="_blank" rel="noopener noreferrer">Open link <ExternalLink size={12} /></a>}<small>Pinned by {pin.created_by_name || "a member"}</small></div>{(pin.created_by === userId || !group.isReceived) && <button type="button" className="fr-btn fr-btn-icon" aria-label={`Remove pin: ${pin.title}`} disabled={busy} onClick={() => remove(pin.id)}><Trash2 size={13} /></button>}</article>; })}</div>}
    {loaded && pins.length === 0 && !loadError && !error && !open && <p className="fr-extra-help">Keep project details, locations and useful links here. You can also pin a chat message.</p>}
    {!loaded && <p className="fr-extra-help">Loading pins…</p>}
    {open && <form className="fr-pin-form" onSubmit={add}><label>Title<input className="fr-add-input" required maxLength={100} value={title} onChange={e => setTitle(e.target.value)} placeholder="Meeting location or project brief" /></label><label>Details<textarea className="fr-add-input" rows={3} maxLength={1500} value={body} onChange={e => setBody(e.target.value)} /></label><label>Link (optional)<input className="fr-add-input" type="url" maxLength={2048} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></label><button className="fr-btn fr-btn-primary fr-btn-small" type="submit" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save pin"}</button></form>}
    {loadError && <p className="fr-meetup-error" role="alert">{loadError} <button type="button" className="fr-text-button" onClick={load}>Retry</button></p>}
    {error && <p className="fr-meetup-error" role="alert">{error}</p>}
  </section>;
}
