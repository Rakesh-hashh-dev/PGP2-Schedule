import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CalendarDays, Check, Clock3, Cookie, Gamepad2, Heart, Home, Lock,
  PawPrint, Shirt, Sparkles, Trophy, UserRound,
} from "lucide-react";
import { PETS, getPetByKey } from "./greetingPets.jsx";
import {
  CARE_ACTIONS, TITLES, MAX_LEVEL, DEVOTION_BASE_LEVEL,
  STARTER_KEYS, UNLOCKS, DEVOTION_COMPANIONS, BUDDY_DEVOTION, STREAK_CAP,
  careLeft, devotionFor, hatsFor, hoursSince, isAdopted,
  levelProgress, moodExplainFor, REUNION_HOURS, unlockedFor, visibleHat, xpBySource, xpOf,
  growthStageFor, nextGrowthStage,
  coatsFor, neckwearFor,
  visibleCoat, visibleNeckwear, titlesFor, visibleTitle, titleLabel,
  buddyFor, careStreak, devotionMultiplier, hasXpRecount,
} from "../lib/pet.js";
import { dismissRecount, isRecountDismissed } from "../lib/petStorage.js";
import { petMilestones, petWeek, recentPetMoments, unlockRoadmap } from "../lib/petInsights.js";
import PetHabitat, { PetHabitatControls } from "./PetHabitat.jsx";
import PetSleepCue from "./PetSleepCue.jsx";
import PetHat from "./PetHat.jsx";
import PetNeckwear from "./PetNeckwear.jsx";
import PetWardrobe from "./PetWardrobe.jsx";
import { routineFor } from "../lib/petRoutine.js";
import { useCompanionStory } from "../hooks/useCompanionStory.js";
import PetMemoryPanel from "./PetMemoryPanel.jsx";
import { useHabitatInteraction } from "../hooks/useHabitatInteraction.js";
import { useBuddyInteraction } from "../hooks/useBuddyInteraction.js";
import { usePetPerformance } from "../hooks/usePetPerformance.js";
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
  reunion: "So glad you are back.",
  determined: "Squared up — something is due today.",
  hyped: "Riding a streak, buzzing with it.",
  weekend: "Lounging. It is the weekend.",
};

const CARE_COPY = { pet: "Pet", play: "Play", treat: "Treat" };
const CARE_REACTION = { pet: "Loved the attention", play: "Had fun playing", treat: "Enjoyed the treat" };

const CARE_ICONS = { pet: Heart, play: Gamepad2, treat: Cookie };

const PET_SECTIONS = [
  { id: "overview", label: "Overview", Icon: Home },
  { id: "journey", label: "Journey", Icon: Trophy },
  { id: "companions", label: "Companions", Icon: PawPrint },
  { id: "habitat", label: "Habitat", Icon: Home },
  { id: "wardrobe", label: "Wardrobe", Icon: Shirt },
  { id: "profile", label: "Profile", Icon: UserRound },
];

function moveTabFocus(event, index, tabs, onChange) {
  let next = null;
  if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
  if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = tabs.length - 1;
  if (next === null) return;
  event.preventDefault();
  onChange(tabs[next].id);
  event.currentTarget.parentElement?.children[next]?.focus();
}

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
  const tier = DEVOTION_COMPANIONS.find(([, k]) => k === key);
  if (tier) return `Dv ${tier[0]}`;
  const level = unlockLevel(key);
  return level ? `Lv ${level}` : null;
}

function BuddyArt({ buddy, mood, motionEnabled, signaturesOn, coat, cue, habitatCue }) {
  const { bind: petRef, action, source, replay, activity } = usePetPerformance(mood, motionEnabled, buddy.key, null, signaturesOn, 0, cue, true, habitatCue);
  return <span ref={petRef} data-habitat-target={activity?.target} data-habitat-behavior={activity?.behavior} data-partner-side="left" className="dg-pet pet-identity-buddy" data-pet={buddy.key} data-motion={motionEnabled ? 'on' : 'off'} data-mood={mood} data-coat={coat || undefined} data-sig={signaturesOn ? undefined : 'off'} data-action={action} data-action-source={source} data-action-replay={replay} aria-hidden="true"><buddy.Svg /></span>;
}

export default function PetPage({ pet, petActions, petContext, petSettings, now, onBack, companionMemory, festive = false }) {
  const [nameDraft, setNameDraft] = useState(null);
  const [adoptChoice, setAdoptChoice] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [careFeedback, setCareFeedback] = useState(null);
  const [recountSeen, setRecountSeen] = useState(isRecountDismissed);

  const adopted = isAdopted(pet);
  const xp = xpOf(pet);
  const progress = levelProgress(xp);
  const { mood, because } = adopted
    ? moodExplainFor(pet, now, petContext)
    : { mood: "content", because: "" };
  const motionEnabled = petSettings?.motion !== false;
  const buddyKey = buddyFor(pet);
  const story = useCompanionStory({memory:companionMemory,petKey:pet?.petKey,petName:pet?.name || getPetByKey(pet?.petKey)?.label,buddyKey,buddyName:buddyKey ? getPetByKey(buddyKey)?.label:'',scene:pet?.cosmetics?.habitat?.scene || 'garden',inClass:petContext?.inClass,now});
  const routine = useMemo(() => routineFor({now,inClass:petContext?.inClass,minsToClass:petContext?.minsToClass,classesToday:petContext?.classesToday,habitat:pet?.cosmetics?.habitat,favorite:story.favorite?.key,mood}),[now,petContext?.inClass,petContext?.minsToClass,petContext?.classesToday,pet?.cosmetics?.habitat,story.favorite?.key,mood]);
  const performanceMood = routine?.mood || mood;
  const habitatInteraction = useHabitatInteraction({primary:pet?.petKey,buddy:buddyKey,habitat:pet?.cosmetics?.habitat,mood:performanceMood,enabled:adopted && motionEnabled,autonomous:petSettings?.signatures !== false,reaction:careFeedback?.action,reactionId:careFeedback?.at,favorite:story.favorite?.key,routine,familiarity:story.familiarity.days});
  const social = useBuddyInteraction(performanceMood, adopted && motionEnabled, pet?.petKey, buddyKey, careFeedback?.reunion ? "leap" : careFeedback?.action, careFeedback?.at, petSettings?.signatures !== false && !routine, story.familiarity.days);
  const { bind: petRef, beat, action, source, replay, touch, greet, activity } = usePetPerformance(performanceMood, adopted && motionEnabled, pet?.petKey, careFeedback?.reunion ? "leap" : careFeedback?.action, petSettings?.signatures !== false, careFeedback?.at, social.primary, Boolean(buddyKey), habitatInteraction.primary, story.accepted, story.welcome);
  const gaze = usePetGaze(motionEnabled);
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
  const neck = festive && wardrobeOn ? 'diwali' : visibleNeckwear(pet, { wardrobe: wardrobeOn });
  const earnedCoats = useMemo(() => new Set(coatsFor(pet, { wardrobe: wardrobeOn })), [pet, wardrobeOn]);
  const earnedNeck = useMemo(() => new Set(neckwearFor(pet, { wardrobe: wardrobeOn })), [pet, wardrobeOn]);
  const earnedTitles = useMemo(() => new Set(titlesFor(pet, now)), [pet, now]);
  const title = visibleTitle(pet, now);
  const buddy = buddyKey ? getPetByKey(buddyKey) : null;
  const streak = careStreak(pet, now);
  const multiplier = devotionMultiplier(pet, now);
  const roadmap = useMemo(() => unlockRoadmap(pet, { wardrobe: wardrobeOn, hatsOff }), [pet, wardrobeOn, hatsOff]);
  const nextReward = roadmap[0];
  const featuredCompanion = nextReward?.rewards
    .map(reward => reward.kind === "companion" ? PETS.find(option => option.label === reward.label) : null)
    .find(Boolean);
  const moments = useMemo(() => recentPetMoments(pet, 5, now), [pet, now]);
  const milestones = useMemo(() => petMilestones(pet), [pet]);
  const week = useMemo(() => petWeek(pet, now), [pet, now]);

  useEffect(() => {
    if (!careFeedback) return undefined;
    const timer = window.setTimeout(() => setCareFeedback(null), 3600);
    return () => window.clearTimeout(timer);
  }, [careFeedback]);

  const handleCare = action => {
    habitatInteraction.takeOver();
    const reunion = hoursSince(pet, now) >= REUNION_HOURS;
    petActions.care(action, now);
    setCareFeedback(previous => ({ action, earned: left > 0, reunion, at: (previous?.at || 0) + 1 }));
  };

  if (!adopted) {
    return (
      <div className="pet-page">
        <header className="pet-page-head">
          <div>
            <p className="pet-page-kicker"><PawPrint size={13} aria-hidden="true" /> Companion corner</p>
            <h1>Meet your companion</h1>
            <p>Choose a study buddy who grows with every class and deadline.</p>
          </div>
          <button type="button" className="pet-back" onClick={onBack} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
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
                data-motion={motionEnabled ? "on" : "off"}
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
                  <span className="dg-pet pet-slot-art" data-pet={key} data-motion={motionEnabled ? "on" : "off"} aria-hidden="true">
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
      <header className="pet-page-head">
        <div>
          <p className="pet-page-kicker"><PawPrint size={13} aria-hidden="true" /> Companion corner</p>
          <h1>Companion</h1>
          <p>{pet.name || current.label} grows as you make progress across TermFlow.</p>
        </div>
        <div className="pet-page-actions">
          <button type="button" className="pet-back" onClick={onBack} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
        </div>
      </header>

      <div className="pet-summary-grid">
        <section className="pet-card pet-identity-card" aria-label="Your companion">
          <PetHabitat value={pet.cosmetics?.habitat} now={now} motionEnabled={motionEnabled} care={careFeedback?.action} onInteract={habitatInteraction.interact} interactive={habitatInteraction.available} routine={routine?.key} activity={activity} discovery={activity ? story.moment?.discovery:null}>
            <button
              type="button"
              ref={petRef}
              data-action-routine={activity?.routine}
              data-habitat-target={activity?.target}
              data-habitat-behavior={activity?.behavior}
              data-partner-side="right"
              className="dg-pet pet-identity-pet"
              data-pet={current.key}
              data-motion={motionEnabled ? "on" : "off"}
              data-stage={stage.key}
              data-mood={performanceMood}
              data-beat={!careFeedback ? beat || undefined : undefined}
              data-action={action}
              data-action-source={source} data-action-replay={replay}
              data-sig={signaturesOn ? undefined : "off"}
              data-accessory={accessoryOn ? "on" : "off"}
              data-coat={coat || undefined}
              data-neck={neck || undefined}
              data-reaction={(careFeedback?.reunion ? "leap" : careFeedback?.action) || undefined}
              aria-label={`Say hello to ${pet.name || current.label}`}
              {...gaze}
              onPointerDown={event => { gaze.onPointerDown?.(event); habitatInteraction.takeOver(); touch(event); }}
              onClick={event => { if (event.detail === 0) { habitatInteraction.takeOver(); greet(); } }}
            >
              <current.Svg />
              <PetHat hat={hat} />
              <PetNeckwear neck={neck} />
              <PetSleepCue />
            </button>
            {buddy && <BuddyArt buddy={buddy} mood={performanceMood} motionEnabled={motionEnabled} signaturesOn={signaturesOn} coat={coat} cue={social.buddy} habitatCue={habitatInteraction.buddy} />}
          </PetHabitat>

          <div className="pet-identity-copy">
            <p className="pet-eyebrow">Your study companion</p>
            {festive && <p className="pet-eyebrow">Celebrating Diwali with you · festive outfit is temporary</p>}
            <div className="pet-identity-heading">
              <h2>{pet.name || current.label}</h2>
              <span className="pet-stage-chip"><Sparkles size={12} aria-hidden="true" /> {stage.label}</span>
            </div>
            {title && <p className="pet-title-line">{titleLabel(title)}</p>}
            <p className="pet-mood">{MOOD_COPY[mood]}</p>
            {because && <p className="pet-because">{because}</p>}
          {buddy && <button type="button" className="pet-social-greet" onClick={() => { habitatInteraction.takeOver(); social.greet(); story.rememberBuddy(); }} disabled={!motionEnabled}>Say hello together</button>}
            {routine && <section className="pet-routine-status" aria-label="Daily routine"><div><strong>{routine.label}</strong><span>{!motionEnabled || !signaturesOn ? "Automatic movement is paused." : habitatInteraction.pausedUntil ? "Your choice for now. Resume whenever you like." : routine.description}</span></div><button type="button" disabled={!motionEnabled || !signaturesOn} onClick={habitatInteraction.pausedUntil ? habitatInteraction.resume : habitatInteraction.pause}>{habitatInteraction.pausedUntil ? "Resume routine" : "Pause 10 min"}</button></section>}
            {story.welcome && <p className="pet-memory-welcome" role="status">{story.welcome.caption}</p>}
            <p className="pet-habitat-activity" role="status">{activity ? `${pet.name || current.label} ${activity.label}` : "Tap a decoration to explore their little home."}</p>
            {story.moment && <button type="button" className="pet-social-greet" disabled={story.saved} onClick={story.save}>{story.saved ? "Moment saved" : "Save moment"}</button>}
            <div className="pet-meta-row">
              <span>{nextStage ? `${nextStage.label} at Lv ${nextStage.from}` : "Fully grown"}</span>
              {seen && <span>Last together {seen}</span>}
            </div>
          </div>
        </section>

        <div className="pet-tools">
          <section className="pet-card pet-progress-panel" aria-label="Level progress">
            {hasXpRecount(pet) && !recountSeen && (
              <div className="pet-recount-note" role="status">
                <p>
                  <strong>XP recount.</strong> A sync bug double-counted some XP, so we
                  recounted it from your real activity. Everything you had unlocked is
                  still yours. You are Level {progress.level} now.
                </p>
                <button type="button" className="admin-btn outline" onClick={() => { dismissRecount(); setRecountSeen(true); }}>
                  Got it
                </button>
              </div>
            )}
            <div className="pet-xp-heading">
              <strong>Level {progress.level}{progress.maxed ? " · Max" : ""}</strong>
              <span>{xp} XP total</span>
            </div>
            <div className="pet-xp-bar" aria-label={`${progress.pct}% level progress`}>
              <div className="pet-xp-fill" style={{ width: `${progress.pct}%` }} />
            </div>
            <div className="pet-xp-nums">
              <span>{progress.maxed ? "Maximum level reached" : `${progress.into} earned`}</span>
              <span>{progress.maxed ? "Fully grown" : `${progress.need - progress.into} XP to Lv ${progress.level + 1}`}</span>
            </div>
            <div className="pet-featured-unlock">
              <span className="pet-featured-art" aria-hidden="true">
                {featuredCompanion ? <span className="dg-pet" data-pet={featuredCompanion.key} data-motion="off"><featuredCompanion.Svg /></span> : <Sparkles size={25} />}
              </span>
              <div>
                <p className="pet-eyebrow">Next unlock</p>
                <strong>{nextReward ? nextReward.rewards.slice(0, 2).map(reward => reward.label).join(" · ") : "Collection complete"}</strong>
                <span>{nextReward ? `${nextReward.remainingXp} XP to ${nextReward.by === "level" ? `Level ${nextReward.at}` : `Devotion ${nextReward.at}`}` : "Every available reward is yours"}</span>
              </div>
            </div>
          </section>

          <section className="pet-card pet-care-wrap" aria-label="Care for your companion">
            <p className="pet-eyebrow">A little care</p>
            <div className="pet-care" aria-label="Care actions">
              {CARE_ACTIONS.map(action => {
                const CareIcon = CARE_ICONS[action];
                return (
                  <button
                    key={action}
                    type="button"
                    className="pet-care-btn"
                    onClick={() => handleCare(action)}
                  >
                    <CareIcon size={16} aria-hidden="true" />
                    <span>{CARE_COPY[action]}</span>
                  </button>
                );
              })}
            </div>
            <p className="pet-care-note">
              {left > 0
                ? `${left} more today can earn XP. After that, care is just for fun.`
                : "Today's care XP is complete. Mark a class to keep growing."}
            </p>
            <p className="pet-care-feedback" role="status" aria-live="polite" key={careFeedback?.at || "empty"}>
              {careFeedback && <><strong>{pet.name || current.label} {CARE_REACTION[careFeedback.action].toLowerCase()}.</strong> {careFeedback.earned ? "Care XP earned." : "Just for fun — today's care XP is complete."}</>}
            </p>
          </section>
        </div>
      </div>

      <nav className="pet-section-nav" role="tablist" aria-label="Companion sections">
        {PET_SECTIONS.map((section, index) => (
          <button
            key={section.id}
            type="button"
            id={`pet-tab-${section.id}`}
            className={activeSection === section.id ? "is-active" : ""}
            role="tab"
            aria-selected={activeSection === section.id}
            aria-controls={`pet-panel-${section.id}`}
            tabIndex={activeSection === section.id ? 0 : -1}
            onClick={() => setActiveSection(section.id)}
            onKeyDown={event => moveTabFocus(event, index, PET_SECTIONS, setActiveSection)}
          >
            <section.Icon size={16} aria-hidden="true" />
            <span>{section.label}</span>
          </button>
        ))}
      </nav>

      {activeSection === "overview" && (
        <div
          className="pet-tab-panel pet-overview-grid"
          id="pet-panel-overview"
          role="tabpanel"
          aria-labelledby="pet-tab-overview"
        >
          <section className="pet-card pet-week-card">
            <div className="pet-card-heading">
              <div>
                <p className="pet-eyebrow"><CalendarDays size={12} aria-hidden="true" /> Weekly recap</p>
                <h3 className="pet-h3">What moved us forward</h3>
              </div>
              <span className="pet-total-pill">+{week.xp} XP this week</span>
            </div>
            <div className="pet-week-stats">
              <div><strong>{week.classes}</strong><span>Class awards</span></div>
              <div><strong>{week.deadlines}</strong><span>Deadlines cleared</span></div>
              <div><strong>{week.care}</strong><span>Care moments</span></div>
              <div><strong>{week.streak}</strong><span>Daily streak awards</span></div>
            </div>
            <p className="pet-week-note">{week.xp > 0 ? "Your classes, deadlines, and time together all count toward growth." : "No XP recorded yet this week. Marking a class or clearing a deadline gets things moving."}</p>
          </section>

          <section className="pet-card pet-moments-card">
            <div className="pet-card-heading">
              <div>
                <p className="pet-eyebrow">Recent moments</p>
                <h3 className="pet-h3">The story so far</h3>
              </div>
              <Clock3 size={18} aria-hidden="true" />
            </div>
            {moments.length ? (
              <ol className="pet-moments">
                {moments.map((moment, index) => (
                  <li key={`${moment.day}-${moment.kind}-${moment.label}-${index}`}>
                    <span className={`pet-moment-icon${moment.kind === "unlock" ? " is-unlock" : ""}`} aria-hidden="true">{moment.kind === "unlock" ? <Sparkles size={15} /> : moment.kind === "care" ? <Heart size={15} /> : <Clock3 size={15} />}</span>
                    <div><strong>{moment.label}{moment.count > 1 ? ` ×${moment.count}` : ""}</strong><span>{new Date(`${moment.day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>
                    {moment.xp > 0 && <b>+{moment.xp} XP</b>}
                  </li>
                ))}
              </ol>
            ) : <p className="pet-empty-copy">Recent XP and unlocks will appear here as you make progress.</p>}
            <p className="pet-history-note">Shows the last 30 days of recorded activity. Earlier XP remains in your total.</p>
          </section>
          <button type="button" className="pet-journey-link" onClick={() => setActiveSection("journey")}>
            Explore milestones and the full progress trail <ArrowLeft size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {activeSection === "journey" && (
        <div className="pet-tab-panel pet-journey-grid" id="pet-panel-journey" role="tabpanel" aria-labelledby="pet-tab-journey">
          <PetMemoryPanel memory={companionMemory} favorite={story.favorite} familiarity={story.familiarity} petKey={pet.petKey} buddyKey={buddyKey} petName={pet.name} />
          <section className="pet-card pet-roadmap-card">
            <div className="pet-card-heading">
              <div><p className="pet-eyebrow">Coming up</p><h3 className="pet-h3">Unlock roadmap</h3></div>
              <Sparkles size={18} aria-hidden="true" />
            </div>
            {roadmap.length ? (
              <ol className="pet-roadmap">
                {roadmap.map(gate => (
                  <li key={`${gate.by}-${gate.at}`}>
                    <span className="pet-roadmap-gate">{gate.by === "level" ? `Lv ${gate.at}` : `Devotion ${gate.at}`}</span>
                    <div><strong>{gate.rewards.slice(0, 2).map(reward => reward.label).join(" · ")}{gate.rewards.length > 2 ? ` +${gate.rewards.length - 2} more` : ""}</strong><span>{gate.remainingXp} XP to go</span></div>
                  </li>
                ))}
              </ol>
            ) : <p className="pet-empty-copy">Every available companion and reward is unlocked.</p>}
          </section>

          <section className="pet-card pet-milestones-card">
            <div className="pet-card-heading">
              <div>
                <p className="pet-eyebrow">Milestone shelf</p>
                <h3 className="pet-h3">Moments to collect</h3>
              </div>
              <Trophy size={18} aria-hidden="true" />
            </div>
            <div className="pet-milestones">
              {milestones.map(item => (
                <div className={`pet-milestone is-${item.status}`} key={item.key}>
                  <span className="pet-milestone-icon" aria-hidden="true">{item.status === "completed" ? <Trophy size={18} /> : item.status === "locked" ? <Lock size={17} /> : <Sparkles size={17} />}</span>
                  <div><strong>{item.label}</strong><span>{item.detail}</span></div>
                  <small>{item.status === "completed" ? "Collected" : item.status === "locked" ? "Locked" : `${item.value}/${item.target} · in progress`}</small>
                  <span className="pet-milestone-track" aria-hidden="true"><span style={{ width: `${item.progress}%` }} /></span>
                </div>
              ))}
            </div>
          </section>

          <section className="pet-card pet-journey-card">
            <div className="pet-card-heading">
              <div>
                <p className="pet-eyebrow">Your journey</p>
                <h3 className="pet-h3">Growing together</h3>
              </div>
            </div>
            <div className="pet-journey-stats">
              <div><strong>{unlocked.size}/{PETS.length}</strong><span>Companions</span></div>
              <div><strong>{streak} days</strong><span>Care streak</span></div>
            </div>
            {progress.level >= DEVOTION_BASE_LEVEL && (
              <div className="pet-devotion-panel">
                <div className="pet-xp-heading">
                  <strong>Devotion {devotion.tier}{devotion.capped ? " · Max" : ""}</strong>
                  <span>{devotion.capped ? "Nothing left to prove" : `${devotion.into} / ${devotion.need}`}</span>
                </div>
                <div className="pet-xp-bar" aria-label={`${devotion.pct}% devotion progress`}>
                  <div className="pet-xp-fill is-devotion" style={{ width: `${devotion.pct}%` }} />
                </div>
                <p className="pet-care-note">
                  {streak > 0
                    ? `${streak}-day streak — care is worth ${multiplier.toFixed(2)}x${streak >= STREAK_CAP ? " (maximum)" : ""}.`
                    : "Look after them daily and care starts earning more."}
                </p>
              </div>
            )}
          </section>

          <section className="pet-card">
            <div className="pet-card-heading">
              <div>
                <p className="pet-eyebrow">Progress trail</p>
                <h3 className="pet-h3">Where the XP came from</h3>
              </div>
            </div>
            {sources.length > 0 ? (
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
            ) : (
              <p className="pet-empty-copy">Complete a class or deadline and the story of your XP will appear here.</p>
            )}
          </section>
        </div>
      )}

      {activeSection === "companions" && (
      <section
        className="pet-card pet-tab-panel"
        id="pet-panel-companions"
        role="tabpanel"
        aria-labelledby="pet-tab-companions"
      >
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
                  data-motion={isCurrent && motionEnabled ? "on" : "off"}
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
            : devotion.tier < Math.max(...DEVOTION_COMPANIONS.map(([tier]) => Number(tier)))
              && " More companions are out there, earned by devotion rather than levels."}
        </p>
      </section>
      )}

      {activeSection === "wardrobe" && (wardrobeOn ? (
      <section
        className="pet-card pet-tab-panel"
        id="pet-panel-wardrobe"
        role="tabpanel"
        aria-labelledby="pet-tab-wardrobe"
      >
        <PetWardrobe current={current} petName={pet.name} hat={hat} neck={neck} coat={coat} stage={stage} accessoryOn={accessoryOn} earnedHats={earnedHats} earnedNeck={earnedNeck} earnedCoats={earnedCoats} hatsOff={hatsOff} onChange={petActions.setCosmetic}/>
      </section>
      ) : (
        <section
          className="pet-card pet-tab-panel pet-empty-state"
          id="pet-panel-wardrobe"
          role="tabpanel"
          aria-labelledby="pet-tab-wardrobe"
        >
          <Shirt size={24} aria-hidden="true" />
          <h3 className="pet-h3">Wardrobe unavailable</h3>
          <p>Your cohort has wardrobe customisation turned off.</p>
        </section>
      ))}

      {activeSection === "habitat" && (
        <section className="pet-card pet-tab-panel" id="pet-panel-habitat" role="tabpanel" aria-labelledby="pet-tab-habitat">
          <p className="pet-eyebrow">Make room for them</p>
          <h3 className="pet-h3">Their little habitat</h3>
          <PetHabitatControls value={pet.cosmetics?.habitat} onChange={value => petActions.setCosmetic("habitat", value)} />
        </section>
      )}

      {activeSection === "profile" && (
      <div
        className="pet-tab-panel pet-profile-grid"
        id="pet-panel-profile"
        role="tabpanel"
        aria-labelledby="pet-tab-profile"
      >
      <section className="pet-card">
        <div className="pet-card-heading">
          <div>
            <p className="pet-eyebrow">Achievements</p>
            <h3 className="pet-h3">Titles</h3>
          </div>
          <span className="pet-total-pill">{earnedTitles.size} of {TITLES.length}</span>
        </div>
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
        <p className="pet-eyebrow">Personalise</p>
        <h3 className="pet-h3">Companion details</h3>
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
      )}
    </div>
  );
}
