import { useMemo, useState } from "react";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { PETS, getPetByKey } from "./greetingPets.jsx";
import {
  CARE_ACTIONS, MAX_LEVEL, STARTER_KEYS, UNLOCKS,
  careLeft, hoursSince, isAdopted, levelProgress, moodFor,
  unlockedFor, xpBySource, xpOf,
} from "../lib/pet.js";
import "../styles/pet.css";

const MOOD_COPY = {
  excited: "Bouncing off the walls.",
  happy: "Having a good day.",
  content: "Hanging out, quite content.",
  sleepy: "Curled up, dozing.",
  bored: "A bit bored — say hello?",
  missing: "Missed you while you were gone.",
};

const CARE_COPY = { pet: "Pet", play: "Play", treat: "Treat" };

/** "3 hours ago" / "2 days ago", or null when never seen. */
function lastSeenLabel(pet, now) {
  const hrs = hoursSince(pet, now);
  if (!Number.isFinite(hrs)) return null;
  if (hrs < 1) return "just now";
  if (hrs < 24) return `${Math.floor(hrs)}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** The level a given pet key becomes available at (null ⇒ a starter). */
function unlockLevel(key) {
  const found = Object.entries(UNLOCKS).find(([, k]) => k === key);
  return found ? Number(found[0]) : null;
}

export default function PetPage({ pet, petActions, now, onBack }) {
  const [nameDraft, setNameDraft] = useState(null);
  const [adoptChoice, setAdoptChoice] = useState(null);

  const adopted = isAdopted(pet);
  const xp = xpOf(pet);
  const progress = levelProgress(xp);
  const mood = adopted ? moodFor(pet, now) : "content";
  const left = careLeft(pet, now);
  const unlocked = useMemo(() => new Set(unlockedFor(pet)), [pet]);
  const sources = useMemo(() => xpBySource(pet), [pet]);
  const current = adopted ? getPetByKey(pet.petKey) : null;
  const accessoryOn = pet?.cosmetics?.accessory !== false;

  if (!adopted) {
    return (
      <div className="pet-page">
        <header className="pet-head">
          <button type="button" className="pet-back" onClick={onBack} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <h2>Companion</h2>
        </header>
        <section className="pet-card pet-adopt">
          <p className="pet-adopt-lede">
            Pick a companion. It levels up as you mark classes and clear deadlines —
            not by tapping it.
          </p>
          <div className="pet-roster">
            {STARTER_KEYS.map(key => {
              const option = getPetByKey(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={`pet-slot${adoptChoice === key ? " on" : ""}`}
                  aria-pressed={adoptChoice === key}
                  onClick={() => setAdoptChoice(key)}
                >
                  <span className="dg-pet pet-slot-art" data-pet={key} data-motion="on" aria-hidden="true">
                    <option.Svg />
                  </span>
                  <span className="pet-slot-name">{option.label}</span>
                </button>
              );
            })}
          </div>
          {adoptChoice && (
            <div className="pet-adopt-confirm">
              <input
                className="pet-input"
                maxLength={24}
                value={nameDraft ?? ""}
                placeholder={`Name your ${getPetByKey(adoptChoice).label.toLowerCase()}`}
                aria-label="Companion name"
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") petActions.adopt(adoptChoice, (nameDraft || "").trim() || getPetByKey(adoptChoice).label, now); }}
              />
              <button
                type="button"
                className="pet-btn pet-btn-primary"
                onClick={() => petActions.adopt(adoptChoice, (nameDraft || "").trim() || getPetByKey(adoptChoice).label, now)}
              >
                Adopt
              </button>
            </div>
          )}
        </section>
      </div>
    );
  }

  const seen = lastSeenLabel(pet, now);

  return (
    <div className="pet-page">
      <header className="pet-head">
        <button type="button" className="pet-back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <h2>{pet.name || current.label}</h2>
        <span className="pet-head-lvl">Lv {progress.level}{progress.maxed ? " · Max" : ""}</span>
      </header>

      {/* Habitat. The pet is the same SVG as the greeting, just larger — the
          idle animations and mood states come from the shared .dg-pet CSS. */}
      <section className="pet-card pet-habitat">
        <span
          className="dg-pet pet-hero"
          data-pet={current.key}
          data-motion="on"
          data-mood={mood}
          data-accessory={accessoryOn ? "on" : "off"}
          aria-hidden="true"
        >
          <current.Svg />
        </span>
        <p className="pet-mood">{MOOD_COPY[mood]}</p>
        {seen && <p className="pet-seen">Last together {seen}</p>}

        <div className="pet-xp">
          <div className="pet-xp-bar" aria-hidden="true">
            <div className="pet-xp-fill" style={{ width: `${progress.pct}%` }} />
          </div>
          <div className="pet-xp-nums">
            <span>{xp} XP total</span>
            <span>{progress.maxed ? "Fully grown" : `${progress.into} / ${progress.need} to Lv ${progress.level + 1}`}</span>
          </div>
        </div>

        <div className="pet-care">
          {CARE_ACTIONS.map(action => (
            <button
              key={action}
              type="button"
              className="pet-btn"
              onClick={() => petActions.care(action, now)}
            >
              {CARE_COPY[action]}
            </button>
          ))}
        </div>
        <p className="pet-care-note">
          {left > 0
            ? `${left} more today will earn XP — after that they're just for fun.`
            : "That's today's XP from care. Mark a class to keep growing."}
        </p>
      </section>

      {sources.length > 0 && (
        <section className="pet-card">
          <h3 className="pet-h3">Where the XP came from</h3>
          <ul className="pet-sources">
            {sources.map(row => (
              <li key={row.prefix}>
                <span className="pet-source-label">{row.label}</span>
                <span className="pet-source-track" aria-hidden="true">
                  <span className="pet-source-fill" style={{ width: `${Math.round((row.xp / xp) * 100)}%` }} />
                </span>
                <span className="pet-source-xp">{row.xp}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pet-card">
        <h3 className="pet-h3">
          Companions <span className="pet-h3-note">{unlocked.size} of {PETS.length}</span>
        </h3>
        <div className="pet-roster">
          {PETS.map(option => {
            const isUnlocked = unlocked.has(option.key);
            const isCurrent = option.key === current.key;
            const at = unlockLevel(option.key);
            return (
              <button
                key={option.key}
                type="button"
                className={`pet-slot${isCurrent ? " on" : ""}${isUnlocked ? "" : " locked"}`}
                disabled={!isUnlocked}
                aria-pressed={isCurrent}
                aria-label={isUnlocked ? `Switch to ${option.label}` : `${option.label}, unlocks at level ${at}`}
                onClick={() => isUnlocked && petActions.switchTo(option.key)}
              >
                <span
                  className="dg-pet pet-slot-art"
                  data-pet={option.key}
                  data-motion={isCurrent ? "on" : "off"}
                  aria-hidden="true"
                >
                  <option.Svg />
                </span>
                <span className="pet-slot-name">{option.label}</span>
                {isCurrent && <span className="pet-slot-badge"><Check size={11} strokeWidth={3} /></span>}
                {!isUnlocked && <span className="pet-slot-lock"><Lock size={10} /> Lv {at}</span>}
              </button>
            );
          })}
        </div>
        <p className="pet-care-note">
          Switching is free — XP belongs to you, not the animal.
          {progress.level < MAX_LEVEL && " Keep levelling to meet the rest."}
        </p>
      </section>

      <section className="pet-card">
        <h3 className="pet-h3">Details</h3>
        <label className="pet-field">
          <span>Name</span>
          <input
            className="pet-input"
            maxLength={24}
            value={nameDraft ?? pet.name}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={() => {
              if (nameDraft !== null && nameDraft.trim() !== pet.name) petActions.rename(nameDraft);
              setNameDraft(null);
            }}
            onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
          />
        </label>
        <label className="pet-field pet-field-row">
          <input
            type="checkbox"
            checked={accessoryOn}
            onChange={e => petActions.setCosmetic("accessory", e.target.checked)}
          />
          <span>Show their collar / accessory</span>
        </label>
        {pet.adoptedAt && <p className="pet-care-note">Together since {pet.adoptedAt}.</p>}
      </section>
    </div>
  );
}
