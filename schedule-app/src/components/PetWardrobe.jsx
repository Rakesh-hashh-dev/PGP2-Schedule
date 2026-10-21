import { useState } from 'react';
import { Check, Lock, Shirt, Sparkles } from 'lucide-react';
import { HATS, NECKWEAR, COATS, hatRequirement, neckwearRequirement, coatRequirement } from '../lib/pet.js';
import PetHat from './PetHat.jsx';
import PetNeckwear from './PetNeckwear.jsx';
import '../styles/pet-wardrobe.css';

const CATEGORIES=[{id:'hats',label:'Headwear',slot:'hat',items:HATS,requirement:hatRequirement},{id:'collars',label:'Neckwear',slot:'neck',items:NECKWEAR,requirement:neckwearRequirement},{id:'coats',label:'Coats',slot:'coat',items:COATS,requirement:coatRequirement}];
const DETAILS={bow:'Satin ribbon · gold clasp',bloom:'Blossoms · woven leaves',cap:'Panelled cotton · curved brim',phones:'Cushioned cups · metal band',specs:'Round frames · clear lenses',devil:'Ruby horns · polished tips',beanie:'Ribbed knit · soft pompom',shades:'Dark lenses · gold bridge',grad:'Mortarboard · gold tassel',party:'Striped cone · pompom',crown:'Gold points · jewel setting',wizard:'Midnight felt · starlight',sunburst:'Golden rays · bright centre',sprig:'Fresh leaves · tiny bud',star:'Faceted gold · warm sparkle',halo:'Golden orbit · soft shine',laurel:'Paired branches · golden leaves',muffs:'Soft fleece · padded band',ember:'Warm flame · golden heart',comet:'Blue trail · golden core',moon:'Pearl crescent · gold stars',aurora:'Teal, violet and rose ribbons',stars:'Golden stars · violet arch',scarf:'Woven warmth · folded ends',bandana:'Soft fabric · neat knot',bowtie:'Satin wings · polished clasp',bell:'Classic collar · little bell',medal:'Ribbon · golden medallion',chain:'Fine links · diamond charm',frost:'A cool, brighter finish',caramel:'A warm amber tint',lavender:'A soft violet shift',dusk:'A muted evening tone',sand:'A light, warm finish',mint:'A gentle green shift',berry:'A richer rosy tint',ink:'A deep, muted finish',gold:'A warm golden wash'};

function OutfitArt({current,outfit,stage,accessoryOn,large=false}) {
 return <span className={`dg-pet ${large?'pet-outfit-hero':'pet-outfit-thumb'}`} data-pet={current.key} data-motion="off" data-mood="content" data-stage={stage} data-coat={outfit.coat || undefined} data-neck={outfit.neck || undefined} data-accessory={accessoryOn ? undefined:'off'} aria-hidden="true"><current.Svg/><PetHat hat={outfit.hat}/><PetNeckwear neck={outfit.neck}/></span>;
}

export default function PetWardrobe({current,petName,hat,neck,coat,stage,accessoryOn,earnedHats,earnedNeck,earnedCoats,hatsOff,onChange}) {
 const [category,setCategory]=useState('hats'),[ownedOnly,setOwnedOnly]=useState(false),[preview,setPreview]=useState(null);
 const outfit={hat,neck,coat},earned={hat:earnedHats,neck:earnedNeck,coat:earnedCoats};
 const selected=CATEGORIES.find(item=>item.id===category),available=selected.items.filter(item=>selected.slot!=='hat' || !hatsOff.includes(item.key));
 const options=available.filter(item=>!ownedOnly || earned[selected.slot].has(item.key));
 // Hover/focus previews are visual only; one intentional selection equips an item.
 const shown=preview?.petKey===current.key ? {...outfit,[preview.slot]:preview.key}:outfit;
 const labelFor=(slot,key)=>CATEGORIES.find(item=>item.slot===slot).items.find(item=>item.key===key)?.label || (slot==='hat'?'No headwear':slot==='neck'?'Original collar':'Original coat');
 const previewLabel=preview?.petKey===current.key ? labelFor(preview.slot,preview.key):null;
 function browse(index,event) {
  let next;
  if(event.key==='ArrowRight')next=(index+1)%CATEGORIES.length;else if(event.key==='ArrowLeft')next=(index+2)%CATEGORIES.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;
  event.preventDefault();setCategory(CATEGORIES[next].id);setPreview(null);event.currentTarget.parentElement.children[next].focus();
 }
 function card(item) {
  const key=item?.key || null,isEarned=!item || earned[selected.slot].has(key),isOn=outfit[selected.slot]===key;
  const label=item?.label || (selected.slot==='hat'?'No headwear':selected.slot==='neck'?'Original collar':'Original coat');
  const status=isOn?'Wearing':isEarned?'Available':selected.requirement(key);
  const candidate={...outfit,[selected.slot]:key};
  return <button key={key || 'original'} type="button" className={`pet-outfit-item${isOn?' is-equipped':''}${!isEarned?' is-locked':''}`} disabled={!isEarned} aria-pressed={isOn} aria-label={isEarned?`Wear ${label}`:`${label}, needs ${status}`} onMouseEnter={()=>isEarned && setPreview({slot:selected.slot,key,petKey:current.key})} onMouseLeave={()=>setPreview(null)} onFocus={()=>isEarned && setPreview({slot:selected.slot,key,petKey:current.key})} onBlur={()=>setPreview(null)} onClick={()=>{onChange(selected.slot,key);setPreview(null);}}>
   <span className="pet-outfit-swatch"><OutfitArt current={current} outfit={candidate} stage={stage} accessoryOn={accessoryOn}/>{isOn && <span className="pet-outfit-check"><Check size={12} strokeWidth={3}/></span>}</span>
   <strong>{label}</strong><span className="pet-outfit-status">{!isEarned && <Lock size={10}/>} {status}</span>
  </button>;
 }
 return <div className="pet-wardrobe-v2">
  <div className="pet-card-heading"><div><p className="pet-eyebrow"><Shirt size={12}/> A little personal style</p><h3 className="pet-h3">The dressing room</h3></div><span className="pet-total-pill">{earnedHats.size+earnedNeck.size+earnedCoats.size} unlocked</span></div>
  <div className="pet-wardrobe-studio">
   <aside className="pet-outfit-preview" aria-label="Outfit preview">
    <span className="pet-outfit-preview-label"><Sparkles size={12}/>{previewLabel?'Trying on':'Currently wearing'}</span>
    <div className="pet-outfit-mirror"><OutfitArt current={current} outfit={shown} stage={stage} accessoryOn={accessoryOn} large/></div>
    <h4>{previewLabel || petName || current.label}</h4><p>{previewLabel ? DETAILS[preview.key] || 'Their original look.': 'A look that feels like them.'}</p>
    <dl>{CATEGORIES.map(item=><div key={item.slot}><dt>{item.label}</dt><dd>{labelFor(item.slot,outfit[item.slot])}</dd></div>)}</dl>
    <p className="pet-outfit-help">Hover or focus to preview. Select an unlocked piece to wear it.</p>
   </aside>
   <div className="pet-outfit-catalogue">
    <div className="pet-subtabs" role="tablist" aria-label="Wardrobe categories">{CATEGORIES.map((item,index)=><button type="button" key={item.id} role="tab" id={`pet-wardrobe-tab-${item.id}`} aria-selected={category===item.id} aria-controls={`pet-wardrobe-panel-${item.id}`} tabIndex={category===item.id?0:-1} className={category===item.id?'is-active':''} onKeyDown={event=>browse(index,event)} onClick={()=>{setCategory(item.id);setPreview(null);}}>{item.label}<span>{earned[item.slot].size}</span></button>)}</div>
    <div className="pet-outfit-toolbar"><p>{available.filter(item=>earned[selected.slot].has(item.key)).length} of {available.length} unlocked</p><label><input type="checkbox" checked={ownedOnly} onChange={event=>setOwnedOnly(event.target.checked)}/> Unlocked only</label></div>
    <div className="pet-outfit-grid" id={`pet-wardrobe-panel-${category}`} role="tabpanel" aria-labelledby={`pet-wardrobe-tab-${category}`}>{card(null)}{options.map(card)}</div>
    <p className="pet-outfit-footnote">Your unlocked pieces travel with every companion. New styles arrive through levels and devotion.</p>
   </div>
  </div>
 </div>;
}
