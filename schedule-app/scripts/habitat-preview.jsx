// Offline integration fixture: actual companion page, local fixture data only.
/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useCompanionMemory } from '../src/hooks/useCompanionMemory.js';
import PetPage from '../src/components/PetPage.jsx';
import { adopt, emptyPet, normalize, setCosmetic, care, switchTo, rename } from '../src/lib/pet.js';
import { PETS } from '../src/components/greetingPets.jsx';
function Preview() {
  const [memoryOwner,setMemoryOwner]=useState("habitat-preview");
  const memory=useCompanionMemory(memoryOwner,{offline:true});
  const [pet,setPet] = useState(() => {
    try { const raw = JSON.parse(localStorage.getItem('termflow-habitat-fixture')); if (raw) return normalize(raw); } catch { /* fixture starts fresh */ }
    const legacy=new URLSearchParams(location.search).has('legacy');
    const value = adopt(emptyPet(),'fox','Maple',new Date());
    return normalize({...value,legacyXp:20000,unlocked:PETS.map(p=>p.key),cosmetics:{...value.cosmetics,buddy:'nimbus',habitat:{...value.cosmetics.habitat,...(legacy?{routines:false}:{})}}});
  });
  const apply = transform => setPet(previous => {const next=transform(previous);localStorage.setItem('termflow-habitat-fixture',JSON.stringify(next));return next;});
  const [motion,setMotion]=useState(true);
  const [signatures,setSignatures]=useState(true);
  const [moment,setMoment]=useState('content');
  const [hour,setHour]=useState(new Date().getHours());
  const now=new Date();now.setHours(hour,0,0,0);
  return <main style={{maxWidth:1040,margin:'auto',padding:20}}><label><input type="checkbox" checked={motion} onChange={event=>setMotion(event.target.checked)}/>Preview motion</label><label><input type="checkbox" checked={signatures} onChange={event=>setSignatures(event.target.checked)}/>Preview spontaneous gestures</label><label>Preview mood<select value={moment} onChange={event=>setMoment(event.target.value)}><option value="content">Content</option><option value="focused">Focused</option><option value="sleepy">Sleepy</option></select></label><label>Preview hour<select value={hour} onChange={event=>setHour(Number(event.target.value))}>{[0,5,6,12,17,18,21,22,23].map(value=><option key={value} value={value}>{value}:00</option>)}{![0,5,6,12,17,18,21,22,23].includes(hour) && <option value={hour}>{hour}:00</option>}</select></label><label>Preview account<select value={memoryOwner} onChange={event=>setMemoryOwner(event.target.value)}><option value="habitat-preview">Primary</option><option value="habitat-preview-other">Other account</option></select></label><PetPage companionMemory={memory} pet={pet} now={now} petContext={{inClass:moment==='focused',classesToday:3,minsToClass:moment==='focused'?null:60,moment:moment==='sleepy' ? 'sleepy' : undefined,momentUntil:now.getTime()+3600000}} petSettings={{motion,signatures}} onBack={()=>{}} petActions={{setCosmetic:(key,value)=>apply(p=>setCosmetic(p,key,value)),care:(action,time)=>apply(p=>care(p,action,time)),switchTo:key=>apply(p=>switchTo(p,key)),rename:value=>apply(p=>rename(p,value))}} /></main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
