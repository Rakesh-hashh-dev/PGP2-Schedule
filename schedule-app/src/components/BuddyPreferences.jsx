import { useState } from "react";
import { SlidersHorizontal, Check } from "lucide-react";
import { STUDY_PURPOSES, normalizeBuddyPreferences, saveBuddyPreferences } from "../lib/buddyPreferences.js";
import { courseCodes } from "../lib/socialPlanning.js";

export default function BuddyPreferences({ userId, preferences, enrolled, onSaved }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(preferences);
  const [interests, setInterests] = useState(preferences.interests.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const configured = preferences.subjects.length + preferences.purposes.length + preferences.interests.length > 0;
  const toggle = (key, item) => setDraft(current => ({ ...current, [key]: current[key].includes(item) ? current[key].filter(value => value !== item) : [...current[key], item] }));
  const save = async event => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const value = normalizeBuddyPreferences({ ...draft, interests: interests.split(",") });
      const saved = await saveBuddyPreferences(userId, value);
      onSaved(saved); setOpen(false);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <section className="fr-extra-section fr-buddy-preferences">
    <button type="button" className="fr-preferences-toggle" aria-expanded={open} onClick={() => { if (!open) { setDraft(preferences); setInterests(preferences.interests.join(", ")); setError(""); } setOpen(value => !value); }}><SlidersHorizontal size={16} /><span><strong>Study-buddy preferences</strong><small>{configured ? `${preferences.subjects.length} subjects · ${preferences.purposes.length} purposes · ${preferences.discoverable ? "Included in matching" : "Private"}` : "Choose subjects and a purpose to improve matches"}</small></span><span>{open ? "Close" : configured ? "Edit" : "Set up"}</span></button>
    {open && <form className="fr-preferences-form" onSubmit={save}>
      <fieldset><legend>Subjects you want to work on</legend><div className="fr-choice-list">{courseCodes(enrolled).map(code => <button type="button" key={code} aria-pressed={draft.subjects.includes(code)} className={`fr-status-preset${draft.subjects.includes(code) ? " is-active" : ""}`} onClick={() => toggle("subjects", code)}>{code}</button>)}</div></fieldset>
      <fieldset><legend>Looking for</legend><div className="fr-choice-list">{STUDY_PURPOSES.map(purpose => <button type="button" key={purpose} aria-pressed={draft.purposes.includes(purpose)} className={`fr-status-preset${draft.purposes.includes(purpose) ? " is-active" : ""}`} onClick={() => toggle("purposes", purpose)}>{purpose}</button>)}</div></fieldset>
      <label>Interests <input className="fr-add-input" value={interests} maxLength={320} placeholder="Product management, finance, analytics" onChange={e => setInterests(e.target.value)} /></label><p className="fr-extra-help">Separate interests with commas. Up to eight interests.</p>
      <label className="fr-check-label"><input type="checkbox" checked={draft.discoverable} onChange={e => setDraft({ ...draft, discoverable: e.target.checked })} /> Include these preferences in buddy suggestions and match explanations</label>
      {error && <p className="fr-meetup-error" role="alert">{error}</p>}
      <button type="submit" className="fr-btn fr-btn-primary" disabled={busy || !userId}><Check size={14} />{busy ? "Saving…" : "Save preferences"}</button>
    </form>}
  </section>;
}
