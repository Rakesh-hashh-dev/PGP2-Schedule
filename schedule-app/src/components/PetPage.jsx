import { useMemo, useState } from "react";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { PETS, getPetByKey } from "./greetingPets.jsx";
import {
  CARE_ACTIONS, HATS, COATS, NECKWEAR, TITLES, MAX_DEVOTION, MAX_LEVEL,
  STARTER_KEYS, UNLOCKS, DEVOTION_UNLOCKS, BUDDY_DEVOTION, STREAK_CAP,
  careLeft, devotionFor, hatRequirement, hatsFor, hoursSince, isAdopted,
  levelProgress, moodExplainFor, unlockedFor, visibleHat, xpBySource, xpOf,
  growthStageFor, nextGrowthStage,
  coatsFor, neckwearFor, coatRequirement, neckwearRequirement,
  visibleCoat, visibleNeckwear, titlesFor, visibleTitle, titleLabel,
  buddyFor, careStreak, devotionMultiplier, nextUnlockFor,
} from "../lib/pet.js";
import PetSleepCue from "./PetSleepCue.jsx";
import PetHat from "./PetHat.jsx";
import PetNeckwear from "./PetNeckwear.jsx";
import { usePetBeat } from "../hooks/usePetBeat.js";
import { usePetGaze } from "../hooks/usePetGaze.js";
import "../styles/pet.css";

const MOOD_COPY = {
  celebrating: "Levelled up — look at them go.",
  proud: "Proud of you for clearing that.",
  birthday: "One whole year together today.",
  festive: "Winding down with the year.",
  excited: "Bouncing off the walls.",
  focused: "Sitting in on class with you.",
  restless: "Fidgeting — class is nearly on.",
  playful: "Ready for another little game.",
  happy: "Having a good day.",
  curious: "Watching the day begin.",
  rooting: "Sitting close — exams are near.",
  content: "Hanging out, quite content.",
  relaxed: "Nothing scheduled. Blissful.",
  cozy: "Settled into a warm, quiet afternoon.",
  tired: "Winding down after a long day.",
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

/**
 * What it takes to unlock a companion, as a label. Two of them are earned by
 * devotion rather than by level, so "Lv null" is not a hypothetical — it is
 * what the roster rendered the moment the first devotion pet was registered.
 */
function unlockRequirement(key) {
  const tier = Object.entries(DEVOTION_UNLOCKS).find(([, k]) => k === key);
  if (tier) return `Dv ${tier[0]}`;
  const level = unlockLevel(key);
  return level ? `Lv ${level}` : null;
}

export default function PetPage({ pet, petActions, petContext, petSettings, now, onBack }) {
  const [nameDraft, setNameDraft] = useState(null);
  const [adoptChoice, setAdoptChoice] = useState(null);

  const adopted = isAdopted(pet);
  const xp = xpOf(pet);
  const progress = levelProgress(xp);
  const { mood, because } = adopted
    ? moodExplainFor(pet, now, petContext)
    : { mood: "content", because: "" };
  const beat = usePetBeat(mood, adopted);
  const gaze = usePetGaze(true);
  const left = careLeft(pet, now);
  const unlocked = useMemo(() => new Set(unlockedFor(pet)), [pet]);
  const sources = useMemo(() => xpBySource(pet), [pet]);
  const current = adopted ? getPetByKey(pet.petKey) : null;
  const stage = growthStageFor(progress.level);
  const nextStage = nextGrowthStage(progress.level);
  const accessoryOn = pet?.cosmetics?.accessory !== false;
  // Cohort policy, defaulting ON: a config written before the wardrobe shipped
  // must not read as "everything withdrawn".
  const wardrobeOn = petSettings?.wardrobe !== false;
  const hatsOff = useMemo(() => petSettings?.hatsOff || [], [petSettings?.hatsOff]);
  const signaturesOn = petSettings?.signatures !== false;
  const hat = visibleHat(pet, { wardrobe: wardrobeOn, hatsOff });
  const earnedHats = useMemo(
    () => new Set(hatsFor(pet, { wardrobe: wardrobeOn, hatsOff })),
    [pet, wardrobeOn, hatsOff]
  );
  const devotion = devotionFor(xp);
  const coat = visibleCoat(pet, { wardrobe: wardrobeOn });
  const neck = visibleNeckwear(pet, { wardrobe: wardrobeOn });
  const earnedCoats = useMemo(() => new Set(coatsFor(pet, { wardrobe: wardrobeOn })), [pet, wardrobeOn]);
  const earnedNeck = useMemo(() => new Set(neckwearFor(pet, { wardrobe: wardrobeOn })), [pet, wardrobeOn]);
  const earnedTitles = useMemo(() => new Set(titlesFor(pet, now)), [pet, now]);
  const title = visibleTitle(pet, now);
  const buddyKey = buddyFor(pet);
  const buddy = buddyKey ? getPetByKey(buddyKey) : null;
  const streak = careStreak(pet, now);
  const multiplier = devotionMultiplier(pet, now);
  const nextUnlock = useMemo(() => nextUnlockFor(pet), [pet]);

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
          {adoptChoice && (
            <div className="pet-adopt-hero">
              <span
                className="dg-pet pet-hero"
                data-pet={adoptChoice}
                data-motion="on"
                data-mood="excited"
                aria-hidden="true"
                {...gaze}
              >
                {(() => { const Chosen = getPetByKey(adoptChoice).Svg; return <Chosen />; })()}
              </span>
              <p className="pet-mood">Ready when you are.</p>
            </div>
          )}
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
        <div className="pet-hero-row">
          <span
            className="dg-pet pet-hero"
            data-pet={current.key}
            data-motion="on"
            data-stage={stage.key}
            data-mood={mood}
            data-beat={beat || undefined}
            data-sig={signaturesOn ? undefined : "off"}
            data-accessory={accessoryOn ? "on" : "off"}
            data-coat={coat || undefined}
            data-neck={neck || undefined}
            aria-hidden="true"
            {...gaze}
          >
            <current.Svg />
            <PetHat hat={hat} />
            <PetNeckwear neck={neck} />
            <PetSleepCue />
          </span>
          {/* The second companion, once devotion opens the slot. Display only:
              it shares the mood but has no XP of its own — see `buddyFor`. */}
          {buddy && (
            <span
              className="dg-pet pet-buddy"
              data-pet={buddy.key}
              data-motion="on"
              data-mood={mood}
              data-coat={coat || undefined}
              aria-hidden="true"
            >
              <buddy.Svg />
            </span>
          )}
        </div>
        {title && <p className="pet-title-line">{titleLabel(title)}</p>}
        <p className="pet-mood">{MOOD_COPY[mood]}</p>
        {/* Why the pet is in this mood. The companion reads the timetable;
            without this it had no way to say so, and a mood that looks
            arbitrary is a mood nobody believes. */}
        {because && <p className="pet-because">{because}</p>}
        <p className="pet-stage">
          <span className="pet-stage-now">{stage.label}</span>
          {nextStage
            ? <span className="pet-stage-next">{nextStage.label} at Lv {nextStage.from}</span>
            : <span className="pet-stage-next">Fully grown</span>}
        </p>
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

        {/* What the next rung actually gives you. The page could say what you
            have and never what was coming, which is the one thing that makes a
            curve worth climbing. Derived from the same registries the wardrobe
            reads, so a new hat appears here without anyone remembering to. */}
        {nextUnlock && (
          <p className="pet-next">
            <span className="pet-next-at">{nextUnlock.by === "level" ? `Lv ${nextUnlock.at}` : `Devotion ${nextUnlock.at}`}</span>
            {nextUnlock.kind === "companion"
              ? `A new companion — ${getPetByKey(nextUnlock.key)?.label || nextUnlock.label}`
              : nextUnlock.kind === "slot"
                ? nextUnlock.label
                : `${nextUnlock.label} (${nextUnlock.kind})`}
          </p>
        )}

        {/* Past level 12 the XP bar is pinned at 100% and every pet is already
            unlocked, so without this the rest of term earns nothing at all. */}
        {progress.maxed && (
          <div className="pet-xp pet-devotion">
            <div className="pet-xp-bar" aria-hidden="true">
              <div className="pet-xp-fill is-devotion" style={{ width: `${devotion.pct}%` }} />
            </div>
            <div className="pet-xp-nums">
              <span>Devotion {devotion.tier}{devotion.capped ? " · max" : ""}</span>
              <span>{devotion.capped ? "Nothing left to prove" : `${devotion.into} / ${devotion.need} to ${devotion.tier + 1}`}</span>
            </div>
            {/* Past the cap, care is most of what is left to earn, so the streak
                is what keeps the last stretch from being the slowest one. */}
            <p className="pet-care-note">
              {streak > 0
                ? `${streak}-day streak — care is worth ${multiplier.toFixed(2)}x${streak >= STREAK_CAP ? " (the most it goes)" : ""}.`
                : "Look after them daily and care starts earning more."}
            </p>
          </div>
        )}

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
            const at = unlockRequirement(option.key);
            return (
              <button
                key={option.key}
                type="button"
                className={`pet-slot${isCurrent ? " on" : ""}${isUnlocked ? "" : " locked"}`}
                disabled={!isUnlocked}
                aria-pressed={isCurrent}
                aria-label={isUnlocked ? `Switch to ${option.label}` : `${option.label}, unlocks at ${at}`}
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
                {!isUnlocked && <span className="pet-slot-lock"><Lock size={10} /> {at}</span>}
              </button>
            );
          })}
        </div>
        {devotion.tier >= BUDDY_DEVOTION && (
          <>
            {/* The stable. A companion you already earned gets to stand next to
                the one you are levelling — no second XP bar, nothing to split. */}
            <h4 className="pet-h4">Second companion</h4>
            <div className="pet-wardrobe">
              <button
                type="button"
                className={`pet-hat-slot${buddyKey === null ? " on" : ""}`}
                aria-pressed={buddyKey === null}
                onClick={() => petActions.setCosmetic("buddy", null)}
              >
                <span className="pet-hat-art" aria-hidden="true" />
                <span className="pet-slot-name">None</span>
              </button>
              {PETS.filter(o => unlocked.has(o.key) && o.key !== current.key).map(option => {
                const isOn = buddyKey === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`pet-hat-slot${isOn ? " on" : ""}`}
                    aria-pressed={isOn}
                    aria-label={`Stand ${option.label} beside them`}
                    onClick={() => petActions.setCosmetic("buddy", isOn ? null : option.key)}
                  >
                    <span className="dg-pet pet-coat-art" data-pet={option.key} data-motion="off" aria-hidden="true">
                      <option.Svg />
                    </span>
                    <span className="pet-slot-name">{option.label}</span>
                    {isOn && <span className="pet-slot-badge"><Check size={11} strokeWidth={3} /></span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <p className="pet-care-note">
          Switching is free — XP belongs to you, not the animal.
          {progress.level < MAX_LEVEL
            ? " Keep levelling to meet the rest."
            : devotion.tier < Math.max(...Object.keys(DEVOTION_UNLOCKS).map(Number))
              && " Two more are out there, earned by devotion rather than levels."}
        </p>
      </section>

      {wardrobeOn && (
      <section className="pet-card">
        <h3 className="pet-h3">
          Wardrobe <span className="pet-h3-note">{earnedHats.size} of {HATS.filter(h => !hatsOff.includes(h.key)).length}</span>
        </h3>
        <div className="pet-wardrobe">
          <button
            type="button"
            className={`pet-hat-slot${hat === null ? " on" : ""}`}
            aria-pressed={hat === null}
            onClick={() => petActions.setCosmetic("hat", null)}
          >
            <span className="pet-hat-art" aria-hidden="true" />
            <span className="pet-slot-name">None</span>
          </button>
          {HATS.filter(option => !hatsOff.includes(option.key)).map(option => {
            const isEarned = earnedHats.has(option.key);
            const isOn = hat === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={`pet-hat-slot${isOn ? " on" : ""}${isEarned ? "" : " locked"}`}
                disabled={!isEarned}
                aria-pressed={isOn}
                aria-label={isEarned ? `Wear the ${option.label}` : `${option.label}, needs ${hatRequirement(option.key)}`}
                onClick={() => isEarned && petActions.setCosmetic("hat", isOn ? null : option.key)}
              >
                <span className="pet-hat-art" aria-hidden="true">
                  <PetHat hat={option.key} />
                </span>
                <span className="pet-slot-name">{option.label}</span>
                {isOn && <span className="pet-slot-badge"><Check size={11} strokeWidth={3} /></span>}
                {!isEarned && <span className="pet-slot-lock"><Lock size={10} /> {hatRequirement(option.key)}</span>}
              </button>
            );
          })}
        </div>
        <p className="pet-care-note">
          {devotion.tier >= MAX_DEVOTION
            ? "Every wearable is yours."
            : progress.maxed
              ? "Devotion keeps the wardrobe growing — every tier past level 12 opens something."
              : "More arrive as you level, and more still after level 12."}
        </p>

        {/* A second slot, independent of the hat. Two slots multiply: the
            wardrobe grows faster than the art does. */}
        <h4 className="pet-h4">Collars</h4>
        <div className="pet-wardrobe">
          <button
            type="button"
            className={`pet-hat-slot${neck === null ? " on" : ""}`}
            aria-pressed={neck === null}
            onClick={() => petActions.setCosmetic("neck", null)}
          >
            <span className="pet-hat-art" aria-hidden="true" />
            <span className="pet-slot-name">Their own</span>
          </button>
          {NECKWEAR.map(option => {
            const isEarned = earnedNeck.has(option.key);
            const isOn = neck === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={`pet-hat-slot${isOn ? " on" : ""}${isEarned ? "" : " locked"}`}
                disabled={!isEarned}
                aria-pressed={isOn}
                aria-label={isEarned ? `Wear the ${option.label}` : `${option.label}, needs ${neckwearRequirement(option.key)}`}
                onClick={() => isEarned && petActions.setCosmetic("neck", isOn ? null : option.key)}
              >
                <span className="pet-hat-art" aria-hidden="true">
                  <PetNeckwear neck={option.key} />
                </span>
                <span className="pet-slot-name">{option.label}</span>
                {isOn && <span className="pet-slot-badge"><Check size={11} strokeWidth={3} /></span>}
                {!isEarned && <span className="pet-slot-lock"><Lock size={10} /> {neckwearRequirement(option.key)}</span>}
              </button>
            );
          })}
        </div>

        {/* Coats recolour the animal you already have, which is why they are
            devotion-only: they are for the stretch where there is nothing new
            left to unlock. */}
        <h4 className="pet-h4">Coats</h4>
        <div className="pet-wardrobe">
          <button
            type="button"
            className={`pet-coat-slot${coat === null ? " on" : ""}`}
            aria-pressed={coat === null}
            onClick={() => petActions.setCosmetic("coat", null)}
          >
            <span className="dg-pet pet-coat-art" data-pet={current.key} data-motion="off" aria-hidden="true">
              <current.Svg />
            </span>
            <span className="pet-slot-name">Their own</span>
          </button>
          {COATS.map(option => {
            const isEarned = earnedCoats.has(option.key);
            const isOn = coat === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={`pet-coat-slot${isOn ? " on" : ""}${isEarned ? "" : " locked"}`}
                disabled={!isEarned}
                aria-pressed={isOn}
                aria-label={isEarned ? `${option.label} coat` : `${option.label} coat, needs ${coatRequirement(option.key)}`}
                onClick={() => isEarned && petActions.setCosmetic("coat", isOn ? null : option.key)}
              >
                <span
                  className="dg-pet pet-coat-art"
                  data-pet={current.key}
                  data-coat={option.key}
                  data-motion="off"
                  aria-hidden="true"
                >
                  <current.Svg />
                </span>
                <span className="pet-slot-name">{option.label}</span>
                {isOn && <span className="pet-slot-badge"><Check size={11} strokeWidth={3} /></span>}
                {!isEarned && <span className="pet-slot-lock"><Lock size={10} /> {coatRequirement(option.key)}</span>}
              </button>
            );
          })}
        </div>
      </section>
      )}

      {/* Titles. Every one is derived from the pet's own history, so this is a
          read-out of what actually happened, not a second currency. */}
      <section className="pet-card">
        <h3 className="pet-h3">
          Titles <span className="pet-h3-note">{earnedTitles.size} of {TITLES.length}</span>
        </h3>
        <div className="pet-titles">
          <button
            type="button"
            className={`pet-title${title === null ? " on" : ""}`}
            aria-pressed={title === null}
            onClick={() => petActions.setCosmetic("title", null)}
          >
            No title
          </button>
          {TITLES.map(option => {
            const isEarned = earnedTitles.has(option.key);
            const isOn = title === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={`pet-title${isOn ? " on" : ""}${isEarned ? "" : " locked"}`}
                disabled={!isEarned}
                aria-pressed={isOn}
                onClick={() => isEarned && petActions.setCosmetic("title", isOn ? null : option.key)}
              >
                {isEarned ? option.label : <><Lock size={10} /> {option.label}</>}
              </button>
            );
          })}
        </div>
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
