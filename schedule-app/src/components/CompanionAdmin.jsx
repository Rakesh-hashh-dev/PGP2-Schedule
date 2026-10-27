import { useCallback, useEffect, useState } from "react";
import { PawPrint, Sparkles, Shirt, Activity, RefreshCw, AlertTriangle, Check, Users, TrendingUp, Gauge } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logAdminAction } from "../lib/adminAudit.js";
import { PETS, getPetByKey } from "./greetingPets.jsx";
import PetHat from "./PetHat.jsx";
import { HATS, COATS, NECKWEAR, SERVER_LEVEL_CAP, hatRequirement } from "../lib/pet.js";

// Admin › Companion. Two kinds of control live here and the layout keeps them
// apart: the greeting/progression/appearance settings are config flags (staged
// until Deploy), while the cohort XP actions are RPCs that hit every adopted
// pet the moment they are confirmed.

// Both `companion` and `xpRate` are absent in any config saved before the
// companion shipped, and `signatures`/`wardrobe`/`hatsOff` before signature
// motion and the wardrobe — so these defaults ARE the back-compat story.
const GREETING_DEFAULTS = {
  enabled: true,
  petKey: "cat",
  motion: true,
  companion: true,
  xpRate: 1,
  signatures: true,
  wardrobe: true,
  hatsOff: [],
};

const XP_RATES = [
  { value: 0.5, label: "0.5×", hint: "slower" },
  { value: 1, label: "1×", hint: "normal" },
  { value: 1.5, label: "1.5×", hint: "" },
  { value: 2, label: "2×", hint: "double" },
  { value: 3, label: "3×", hint: "max" },
];

function withDefaults(raw) {
  const merged = { ...GREETING_DEFAULTS, ...(raw || {}) };
  delete merged.mode; // retired daily/featured rotation setting
  return merged;
}

function Switch({ label, hint, checked, disabled, onChange, icon: Icon }) {
  return (
    <label className={`system-switch${disabled ? " is-disabled" : ""}`}>
      <span className="system-switch-copy">
        <strong>{Icon && <Icon size={15} aria-hidden="true" />}{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <span className="admin-toggle"><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span className="slider" /></span>
    </label>
  );
}

function CohortSnapshot({ overview, error, loading, onRefresh }) {
  if (error) {
    return (
      <div className="companion-snapshot is-error" role="alert">
        <AlertTriangle size={16} /> Couldn&rsquo;t load the cohort snapshot — {error}
        <button type="button" className="admin-btn outline" onClick={onRefresh}><RefreshCw size={14} /> Retry</button>
      </div>
    );
  }
  const o = overview;
  const levels = Array.from({ length: SERVER_LEVEL_CAP }, (_, i) => ({ level: i + 1, n: Number(o?.levels?.[i + 1] || 0) }));
  const maxLevelCount = Math.max(1, ...levels.map(l => l.n));
  const pets = Object.entries(o?.pets || {}).map(([key, n]) => ({ pet: getPetByKey(key), n: Number(n) })).sort((a, b) => b.n - a.n);
  const maxPetCount = Math.max(1, ...pets.map(p => p.n));
  const adoptionPct = o?.rows ? Math.round((o.adopted / o.rows) * 100) : 0;
  const tiles = [
    { Icon: PawPrint, label: "Adopted", value: o ? o.adopted : "—", sub: o ? `${adoptionPct}% of ${o.rows} students with a pet record` : "" },
    { Icon: Users, label: "Active this week", value: o ? o.active7d : "—", sub: "adopted pets seen in the last 7 days" },
    { Icon: TrendingUp, label: "Average level", value: o?.avgLevel ?? "—", sub: o?.maxLevel ? `highest is Level ${o.maxLevel}` : "" },
    { Icon: Gauge, label: "Admin-adjusted", value: o ? o.adjusted : "—", sub: "pets carrying granted XP" },
  ];
  return (
    <div className="companion-snapshot" aria-busy={loading}>
      <div className="companion-tiles">
        {tiles.map(({ Icon, label, value, sub }) => (
          <div key={label} className="companion-tile">
            <span><Icon size={14} aria-hidden="true" /> {label}</span>
            <strong>{value}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="companion-charts">
        <figure className="companion-chart">
          <figcaption>Pets per level</figcaption>
          {o && o.adopted === 0 ? <p className="companion-chart-empty">No adopted pets yet.</p> : (
            <div className="companion-levels" role="list">
              {levels.map(({ level, n }) => (
                <div key={level} className="companion-level" role="listitem" title={`Level ${level}: ${n} pet${n === 1 ? "" : "s"}`} aria-label={`Level ${level}: ${n} pet${n === 1 ? "" : "s"}`}>
                  <span className="companion-level-count">{n || ""}</span>
                  <span className="companion-level-bar" style={{ height: `${n ? Math.max(6, (n / maxLevelCount) * 100) : 0}%` }} />
                  <span className="companion-level-axis">{level}</span>
                </div>
              ))}
            </div>
          )}
        </figure>
        <figure className="companion-chart">
          <figcaption>Most adopted</figcaption>
          {pets.length === 0 ? <p className="companion-chart-empty">{o ? "No adopted pets yet." : "Loading…"}</p> : (
            <ol className="companion-pets">
              {pets.slice(0, 6).map(({ pet, n }) => {
                const Svg = pet.Svg;
                return (
                  <li key={pet.key} title={`${pet.label}: ${n}`}>
                    <span className="dg-pet companion-pet-ico" data-pet={pet.key} data-motion="off" aria-hidden="true"><Svg /></span>
                    <span className="companion-pet-name">{pet.label}</span>
                    <span className="companion-pet-bar"><i style={{ width: `${(n / maxPetCount) * 100}%` }} /></span>
                    <strong>{n}</strong>
                  </li>
                );
              })}
              {pets.length > 6 && <li className="companion-pets-more">+{pets.length - 6} more kinds</li>}
            </ol>
          )}
        </figure>
      </div>
      <p className="companion-snapshot-foot">
        {loading ? "Refreshing…" : o?.generatedAt ? `Live counts as of ${new Date(o.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
        <button type="button" className="system-link-btn" onClick={onRefresh} disabled={loading}><RefreshCw size={13} /> Refresh</button>
      </p>
    </div>
  );
}

export default function CompanionAdmin({ flags, setFlags, originalFlags, readOnly, adminId, requestConfirm }) {
  const gp = withDefaults(flags.greetingPets);
  const liveGp = withDefaults(originalFlags?.greetingPets);
  const previewPet = getPetByKey(gp.petKey); // getPetByKey maps legacy keys (e.g. "turtle")
  const PreviewSvg = previewPet.Svg;
  const companionOn = gp.enabled && gp.companion !== false;
  const hatsOff = gp.hatsOff || [];

  // Writes the whole greeting object; when every field is back to what is
  // live, the original raw value is restored so nothing shows as staged.
  const update = patch => {
    const next = { ...gp, ...patch };
    const matchesLive = Object.keys(next).every(k => JSON.stringify(next[k]) === JSON.stringify(liveGp[k]));
    const nextFlags = { ...flags };
    if (matchesLive) {
      if (originalFlags && "greetingPets" in originalFlags) nextFlags.greetingPets = originalFlags.greetingPets;
      else delete nextFlags.greetingPets;
    } else {
      nextFlags.greetingPets = next;
    }
    setFlags(nextFlags);
  };
  const staged = JSON.stringify(flags.greetingPets) !== JSON.stringify(originalFlags?.greetingPets);

  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState("");
  const [overviewLoading, setOverviewLoading] = useState(true);
  const applyOverview = useCallback(({ data, error }) => {
    setOverviewLoading(false);
    if (error) { setOverviewError(error.message); return; }
    setOverviewError("");
    setOverview(data);
  }, []);
  const loadOverview = useCallback(() => {
    setOverviewLoading(true);
    return supabase.rpc("admin_pet_overview").then(applyOverview);
  }, [applyOverview]);
  useEffect(() => {
    let alive = true;
    supabase.rpc("admin_pet_overview").then(res => { if (alive) applyOverview(res); });
    return () => { alive = false; };
  }, [applyOverview]);

  const [xpDraft, setXpDraft] = useState(100);
  const [levelDraft, setLevelDraft] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  async function runBulk(rpc, args, logAction, describe) {
    setBusy(true); setResult(null);
    const { data, error } = await supabase.rpc(rpc, args);
    setBusy(false);
    if (error) { setResult({ ok: false, text: `Could not update companions: ${error.message}` }); return; }
    setResult({ ok: true, text: describe(data) });
    await logAdminAction(adminId, logAction, { ...args, affected: data });
    loadOverview();
  }

  const adoptedCount = overview?.adopted;
  const who = adoptedCount != null ? `${adoptedCount} adopted companion${adoptedCount === 1 ? "" : "s"}` : "every adopted companion";

  function confirmXp(sign) {
    const amount = xpDraft;
    requestConfirm({
      title: `${sign > 0 ? "Add" : "Remove"} ${amount} XP ${sign > 0 ? "to" : "from"} all companions?`,
      description: `Applies to ${who}. Earned history is kept; apply the opposite amount or "Reset adjustments" to undo.`,
      impact: "Takes effect immediately for every student — there is no Deploy step.",
      confirmLabel: sign > 0 ? "Add XP" : "Remove XP",
      tone: sign > 0 ? "warning" : "danger",
      onConfirm: () => runBulk("admin_bulk_adjust_pet_xp", { p_delta: sign * amount }, "bulk_adjust_pet_xp",
        n => `${sign > 0 ? "Added" : "Removed"} ${amount} XP ${sign > 0 ? "to" : "from"} ${n} companion${n === 1 ? "" : "s"}.`),
    });
  }

  function confirmLevel() {
    const level = levelDraft;
    requestConfirm({
      title: `Set every companion to Level ${level}?`,
      description: `Applies to ${who}. Students who earned beyond Level ${level} are reduced to match — it flattens the leaderboard. Earned history is kept and "Reset adjustments" undoes it.`,
      impact: "Takes effect immediately and can take progress away from students who earned it.",
      confirmLabel: `Set all to Level ${level}`,
      requireText: String(level),
      tone: "danger",
      onConfirm: () => runBulk("admin_bulk_set_pet_level", { p_level: level }, "bulk_set_pet_level",
        n => `Set ${n} companion${n === 1 ? "" : "s"} to Level ${level}.`),
    });
  }

  function confirmReset() {
    requestConfirm({
      title: "Reset every admin adjustment?",
      description: `All companions fall back to purely earned XP${overview ? ` (${overview.adjusted} currently carry adjustments)` : ""}. Grants and reductions are cleared; nothing students earned is affected.`,
      impact: "Takes effect immediately for every student.",
      confirmLabel: "Reset adjustments",
      tone: "warning",
      onConfirm: () => runBulk("admin_bulk_reset_pet_adjustments", {}, "bulk_reset_pet_adjustments",
        n => n === 0 ? "No companions had adjustments to reset." : `Reset adjustments on ${n} companion${n === 1 ? "" : "s"}.`),
    });
  }

  const chips = [
    { on: gp.enabled, text: gp.enabled ? `Greeting: ${previewPet.label}` : "Greeting off" },
    { on: companionOn, text: companionOn ? "Adoption on" : "Adoption off" },
    { on: companionOn, text: `XP ${gp.xpRate ?? 1}×` },
    { on: gp.wardrobe !== false && companionOn, text: gp.wardrobe === false ? "Wardrobe off" : hatsOff.length ? `${hatsOff.length} hat${hatsOff.length === 1 ? "" : "s"} withdrawn` : "Full wardrobe" },
  ];

  return (
    <section className="admin-card admin-span-all admin-g-companion companion-admin">
      <header className="companion-head">
        <div>
          <span className="system-kicker companion-eyebrow">Student experience</span>
          <h2><PawPrint size={22} color="var(--violet)" /> Companion</h2>
          <p className="admin-subtext">Greeting pets, adoption and levelling, wardrobe availability, and cohort-wide XP.</p>
        </div>
        <ul className="companion-chips" aria-label="Current companion settings">
          {chips.map(c => <li key={c.text} className={c.on ? "is-on" : ""}>{c.text}</li>)}
          {staged && <li className="is-staged">Staged — deploy to publish</li>}
        </ul>
      </header>

      <CohortSnapshot overview={overview} error={overviewError} loading={overviewLoading} onRefresh={loadOverview} />

      <div className="companion-section-title">
        <h3>Settings</h3>
        <span className="admin-action-badge is-staged">Staged</span>
        <small>Saved with Review &amp; Deploy, like the rest of the config.</small>
      </div>

      <fieldset className="admin-readonly-group" disabled={readOnly}>
        <div className="companion-grid">
          <div className="companion-panel">
            <span className="system-kicker">Greeting pet</span>
            <Switch label="Show a greeting companion" hint="The pet beside the Today greeting, shown until a student adopts their own." checked={gp.enabled} onChange={v => update({ enabled: v })} icon={Sparkles} />
            <div className="companion-preview" data-disabled={!gp.enabled}>
              <span className="dg-pet" data-pet={previewPet.key} data-motion={gp.motion ? "on" : "off"} aria-hidden="true"><PreviewSvg /></span>
              <div>
                <strong>{gp.enabled ? `${previewPet.label} greets the cohort` : "Companions are hidden"}</strong>
                <small>{gp.motion ? "With motion." : "Motion off."} Students who ask their device for reduced motion never see it either way.</small>
              </div>
            </div>
            <div className="companion-pet-picker" role="radiogroup" aria-label="Greeting pet" data-disabled={!gp.enabled}>
              {PETS.map(pet => {
                const Svg = pet.Svg;
                const on = pet.key === previewPet.key;
                return (
                  <button key={pet.key} type="button" role="radio" aria-checked={on} disabled={!gp.enabled} className={on ? "on" : ""} onClick={() => update({ petKey: pet.key })} title={pet.label}>
                    <span className="dg-pet" data-pet={pet.key} data-motion="off" aria-hidden="true"><Svg /></span>
                    <span>{pet.label}</span>
                  </button>
                );
              })}
            </div>
            <Switch label="Motion" hint="Idle animation on the greeting pet." checked={gp.motion} disabled={!gp.enabled} onChange={v => update({ motion: v })} />
          </div>

          {/* Separate from the greeting switch so the decorative pet can stay
              while the game is turned off. */}
          <div className="companion-panel">
            <span className="system-kicker">Progression</span>
            <Switch
              label="Adoptable companion"
              hint="Students adopt and name a pet that levels up from marked classes and cleared deadlines, unlocking the Companion page and friends' pets on their cards. Off leaves only the greeting pet."
              checked={gp.companion !== false}
              disabled={!gp.enabled}
              onChange={v => update({ companion: v })}
              icon={PawPrint}
            />
            {!gp.enabled && <p className="companion-why"><AlertTriangle size={13} /> Turn the greeting companion on first — adoption sits on top of it.</p>}
            <div className="companion-field">
              <span className="system-kicker" id="companion-xp-label">XP rate</span>
              <div className="companion-segmented" role="radiogroup" aria-labelledby="companion-xp-label" data-disabled={!companionOn}>
                {XP_RATES.map(r => {
                  const on = Number(gp.xpRate ?? 1) === r.value;
                  return (
                    <button key={r.value} type="button" role="radio" aria-checked={on} className={on ? "on" : ""} disabled={!companionOn} onClick={() => update({ xpRate: r.value })}>
                      <strong>{r.label}</strong>{r.hint && <small>{r.hint}</small>}
                    </button>
                  );
                })}
              </div>
              <small className="system-help">Applies to new XP only — banked XP keeps its value. The server clamps the rate to 0.25×–3×.</small>
            </div>
          </div>

          {/* Presentation only: withdrawing a wearable hides it, it does not
              un-earn it, and turning it back on returns every student to the
              hat they had chosen. */}
          <div className="companion-panel companion-panel-wide">
            <span className="system-kicker">Appearance</span>
            <div className="companion-switch-row">
              <Switch
                label="Signature micro-motion"
                hint="Each companion's own small loop — the dog pants, the panda chews, the robot's light blinks. Off keeps the shared idle, moods and reactions."
                checked={gp.signatures !== false}
                disabled={!gp.enabled}
                onChange={v => update({ signatures: v })}
                icon={Sparkles}
              />
              <Switch
                label="Wardrobe"
                hint={`${HATS.length} hats, ${COATS.length} coats and ${NECKWEAR.length} collars, earned by level and devotion. Off hides every wearable on every pet.`}
                checked={gp.wardrobe !== false}
                disabled={!companionOn}
                onChange={v => update({ wardrobe: v })}
                icon={Shirt}
              />
            </div>
            {!companionOn && <p className="companion-why"><AlertTriangle size={13} /> The wardrobe needs the adoptable companion on.</p>}

            {gp.wardrobe !== false && (
              <div className="companion-hats" data-disabled={!companionOn}>
                <div className="system-subhead">
                  <span className="system-kicker">Hats · {HATS.length - hatsOff.length} of {HATS.length} available</span>
                  {hatsOff.length > 0 && <button type="button" className="system-link-btn" disabled={!companionOn} onClick={() => update({ hatsOff: [] })}>Restore all</button>}
                </div>
                <div className="companion-hat-grid">
                  {HATS.map(h => {
                    const withdrawn = hatsOff.includes(h.key);
                    return (
                      <button
                        key={h.key}
                        type="button"
                        disabled={!companionOn}
                        aria-pressed={!withdrawn}
                        className={withdrawn ? "is-off" : ""}
                        title={withdrawn ? `${h.label} — withdrawn. Tap to bring back.` : `${h.label} — ${hatRequirement(h.key)}. Tap to withdraw.`}
                        onClick={() => update({ hatsOff: withdrawn ? hatsOff.filter(k => k !== h.key) : [...hatsOff, h.key] })}
                      >
                        <span className="dg-pet companion-hat-art" data-motion="off" aria-hidden="true"><PetHat hat={h.key} /></span>
                        <strong>{h.label}</strong>
                        <small>{withdrawn ? "Withdrawn" : hatRequirement(h.key)}</small>
                      </button>
                    );
                  })}
                </div>
                <small className="system-help">Withdrawing hides a hat from the wardrobe but never un-earns it — turning it back on puts it straight back on anyone who chose it. Coats and collars follow the Wardrobe switch. To give one student a wearable early, raise their level in the student inspector.</small>
              </div>
            )}
          </div>
        </div>
      </fieldset>

      {/* Cohort-wide XP. These are RPCs, not flags — confirmed, they apply at
          once to every adopted pet, so they sit apart with their own warning. */}
      <fieldset className="admin-readonly-group" disabled={readOnly}>
        <div className="companion-live">
          <div className="companion-section-title">
            <h3><Activity size={17} /> Cohort actions</h3>
            <span className="admin-action-badge is-live">Live now</span>
            <small>Applies to {who} the moment you confirm. Adjustments sit beside earned XP, so nothing students earned is deleted. Totals floor at zero.</small>
          </div>
          <div className="companion-actions">
            <div className="companion-action">
              <label className="system-kicker" htmlFor="companion-xp-amount">Adjust XP</label>
              <div className="system-btn-row">
                <input id="companion-xp-amount" className="admin-input companion-num" type="number" min="1" step="10" value={xpDraft} disabled={busy} onChange={e => setXpDraft(Math.max(1, Number(e.target.value) || 0))} />
                <button type="button" className="admin-btn outline" disabled={busy || xpDraft < 1} onClick={() => confirmXp(1)}>Add to all</button>
                <button type="button" className="admin-btn outline is-danger-outline" disabled={busy || xpDraft < 1} onClick={() => confirmXp(-1)}>Remove from all</button>
              </div>
            </div>
            <div className="companion-action">
              <label className="system-kicker" htmlFor="companion-level">Set level</label>
              <div className="system-btn-row">
                {/* SERVER_LEVEL_CAP: the highest level the grant RPCs and pet_state check accept. */}
                <select id="companion-level" className="admin-input companion-num" value={levelDraft} disabled={busy} onChange={e => setLevelDraft(Number(e.target.value))}>
                  {Array.from({ length: SERVER_LEVEL_CAP }, (_, i) => i + 1).map(l => <option key={l} value={l}>Level {l}</option>)}
                </select>
                <button type="button" className="admin-btn outline is-danger-outline" disabled={busy} onClick={confirmLevel}>Set all to level</button>
              </div>
            </div>
            <div className="companion-action">
              <span className="system-kicker">Undo</span>
              <div className="system-btn-row">
                <button type="button" className="admin-btn outline" disabled={busy} onClick={confirmReset}>Reset adjustments</button>
              </div>
            </div>
          </div>
          {busy && <p className="companion-result" role="status"><RefreshCw size={14} className="spin-icon" /> Working…</p>}
          {result && !busy && (
            <p className={`companion-result ${result.ok ? "is-ok" : "is-error"}`} role={result.ok ? "status" : "alert"}>
              {result.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {result.text}
            </p>
          )}
        </div>
      </fieldset>
    </section>
  );
}
