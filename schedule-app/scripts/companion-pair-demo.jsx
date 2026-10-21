import { useEffect, useState } from 'react';
import { PETS, getPetByKey } from '../src/components/greetingPets.jsx';
import PetHat from '../src/components/PetHat.jsx';
import PetNeckwear from '../src/components/PetNeckwear.jsx';
import { useBuddyInteraction } from '../src/hooks/useBuddyInteraction.js';
import { usePetPerformance } from '../src/hooks/usePetPerformance.js';
function PairPet({ petKey, mood, motion, signatures, cue, side, reaction, reactionId, hat, neck }) {
  const art=getPetByKey(petKey);
  const {bind: petRef, action, source, replay}=usePetPerformance(mood,motion,petKey,reaction,signatures,reactionId,cue,true);
  return <span ref={petRef} className="dg-pet" data-pair-role={side==='right' ? 'primary' : 'buddy'} data-partner-side={side} data-pet={petKey} data-motion={motion ? 'on':'off'} data-mood={mood} data-action={action} data-action-source={source} data-action-replay={replay} data-neck={neck || undefined} data-reaction={reaction || undefined} data-sig={signatures ? undefined:'off'} aria-hidden="true"><art.Svg /><PetHat hat={hat} /><PetNeckwear neck={neck} /></span>;
}
export default function CompanionPairDemo({ mood, motion, signatures, hat, neck }) {
  const [primary,setPrimary]=useState('fox'),[buddy,setBuddy]=useState('nimbus');
  const [care,setCare]=useState(null);
  const social=useBuddyInteraction(mood,motion,primary,buddy,care?.action,care?.id,signatures);
  useEffect(()=>{if(!care)return;const t=setTimeout(()=>setCare(null),1800);return()=>clearTimeout(t);},[care]);
  return <section className="pair-preview" aria-label="Companion pair"><div><span className="eyebrow">BETTER TOGETHER</span><h2>A glance. A wave. A shared little win.</h2><p>Choose any two companions, then let them say hello.</p>
    <div className="pair-selects"><label>Companion<select aria-label="Pair companion" value={primary} onChange={e=>setPrimary(e.target.value)}>{PETS.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label><label>Buddy<select aria-label="Pair buddy" value={buddy} onChange={e=>setBuddy(e.target.value)}>{PETS.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label></div>
    <div className="pair-actions"><button type="button" onClick={social.greet}>Say hello together</button><button type="button" onClick={()=>setCare(previous=>({action:'pet',id:(previous?.id||0)+1}))}>Pet companion</button></div></div>
    <div className="pair-stage"><PairPet petKey={primary} {...{mood,motion,signatures,hat,neck}} cue={social.primary} side="right" reaction={care?.action} reactionId={care?.id} /><PairPet petKey={buddy} {...{mood,motion,signatures,hat,neck}} cue={social.buddy} side="left" /></div>
  </section>;
}
