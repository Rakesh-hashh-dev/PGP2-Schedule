// Offline demo: uses the real artwork, wearable components and runtime hook.
/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PETS, getPetByKey } from '../src/components/greetingPets.jsx';
import PetHat from '../src/components/PetHat.jsx';
import PetNeckwear from '../src/components/PetNeckwear.jsx';
import { usePetPerformance } from '../src/hooks/usePetPerformance.js';
import { usePetGaze } from '../src/hooks/usePetGaze.js';
import { ACTION_MS } from '../src/lib/petDirector.js';
import CompanionPairDemo from './companion-pair-demo.jsx';
import { PET_PROFILES } from '../src/lib/petProfiles.js';
function Companion({ petKey, motion, signatures, mood, stage, hat, neck }) {
  const pet = getPetByKey(petKey);
  const [care, setCare] = useState(null);
  const gestureIndex = useRef(0);
  const { bind: petRef, action, source, replay, touch, greet, gesture } = usePetPerformance(mood, motion, petKey, care?.action, signatures, care?.id);
  const gaze = usePetGaze(motion);
  useEffect(() => {
    if (!care) return;
    const timer = setTimeout(() => setCare(null), ACTION_MS);
    return () => clearTimeout(timer);
  }, [care]);
  return <article data-card={petKey} data-gestures={JSON.stringify(PET_PROFILES[petKey].idles)}>
    <div className="portrait"><button ref={petRef} type="button" className="dg-pet" data-pet={petKey} data-motion={motion ? 'on' : 'off'} data-mood={mood} data-stage={stage} data-action={action} data-action-source={source} data-action-replay={replay} data-sig={signatures ? undefined : 'off'} data-reaction={care?.action} data-neck={neck || undefined} aria-label={`Say hello to ${pet.label}`} {...gaze} onPointerDown={e => { gaze.onPointerDown?.(e); touch(e); }} onClick={e => { if (!e.detail) greet(); }}>
      <pet.Svg /><PetHat hat={hat} /><PetNeckwear neck={neck} />
    </button></div>
    <h2>{pet.label}</h2><p>{PET_PROFILES[petKey]?.description}</p>
    <div className="care">{['pet', 'play', 'treat'].map(action => <button type="button" key={action} onClick={() => setCare(previous => ({ action, id: (previous?.id || 0) + 1 }))}>{action}</button>)}</div>
    <button type="button" data-gesture={petKey} onClick={() => { const choices = PET_PROFILES[petKey].idles; gesture(choices[gestureIndex.current++ % choices.length]); }}>Show gesture</button>
    <div className="feedback" aria-live="polite">{care ? `${pet.label} ${care.action === 'treat' ? 'enjoys a little snack.' : care.action === 'play' ? 'is happy to play!' : 'leans into your hand.'}` : 'Tap to say hello.'}</div>
    <div className="badge-row">{[17, 32, 48].map(size => <span key={size} className="dg-pet" data-pet={petKey} data-motion="off" style={{ width: size, height: size }}><pet.Svg /></span>)}</div>
  </article>;
}
function Demo() {
  const [motion, setMotion] = useState(true), [signatures, setSignatures] = useState(true);
  const [mood, setMood] = useState('content'), [stage, setStage] = useState('grown');
  const [hat, setHat] = useState(null), [neck, setNeck] = useState(null), [dark, setDark] = useState(false);
  return <main className={dark ? 'demo dark' : 'demo'}><div className="demo-inner"><header><span className="eyebrow">TERMFLOW / COMPANION STUDIO</span><h1>A little more life.<br /><em>A lot more character.</em></h1><p>All 32 study buddies, with movements that feel like their own.</p></header>
    <section className="controls" aria-label="Preview settings">
      <label>Moment<select aria-label="Moment" value={mood} onChange={e => setMood(e.target.value)}>{['content','focused','celebrating','rooting','determined','sleepy','weekend'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Growth<select aria-label="Growth" value={stage} onChange={e => setStage(e.target.value)}>{['hatchling','young','grown','elder','ascended'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Hat<select aria-label="Hat" value={hat || ''} onChange={e => setHat(e.target.value || null)}><option value="">None</option>{['crown','specs','bow','wizard'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Neckwear<select aria-label="Neckwear" value={neck || ''} onChange={e => setNeck(e.target.value || null)}><option value="">None</option>{['scarf','bandana','bowtie'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={motion} onChange={e => setMotion(e.target.checked)} />Motion</label>
      <label className="check"><input type="checkbox" checked={signatures} onChange={e => setSignatures(e.target.checked)} />Spontaneous gestures</label>
      <button type="button" onClick={() => setDark(v => !v)}>Toggle theme</button>
    </section>
    <CompanionPairDemo {...{mood,motion,signatures,hat,neck}} />
    <section className="collection">{PETS.map(({ key }) => <Companion key={key} petKey={key} {...{motion, signatures, mood, stage, hat, neck}} />)}</section>
    <footer>Explore their faces, wings, and tail. Care buttons and keyboard greetings work too.<br />This preview uses the app’s real components. No account data or XP is changed.</footer>
    </div></main>;
}
createRoot(document.getElementById('root')).render(<Demo />);
