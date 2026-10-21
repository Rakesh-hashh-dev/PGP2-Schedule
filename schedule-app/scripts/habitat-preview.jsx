// Offline integration fixture: actual companion page, local fixture data only.
/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PetPage from '../src/components/PetPage.jsx';
import { adopt, emptyPet, normalize, setCosmetic, care, switchTo, rename } from '../src/lib/pet.js';
import { PETS } from '../src/components/greetingPets.jsx';
function Preview() {
  const [pet,setPet] = useState(() => {
    try { const raw = JSON.parse(localStorage.getItem('termflow-habitat-fixture')); if (raw) return normalize(raw); } catch { /* fixture starts fresh */ }
    const value = adopt(emptyPet(),'fox','Maple',new Date());
    return normalize({...value,legacyXp:20000,unlocked:PETS.map(p=>p.key),cosmetics:{...value.cosmetics,buddy:'nimbus'}});
  });
  const apply = transform => setPet(previous => {const next=transform(previous);localStorage.setItem('termflow-habitat-fixture',JSON.stringify(next));return next;});
  const [motion,setMotion]=useState(true);
  const [now] = useState(() => new Date());
  return <main style={{maxWidth:1040,margin:'auto',padding:20}}><label><input type="checkbox" checked={motion} onChange={event=>setMotion(event.target.checked)}/>Preview motion</label><PetPage pet={pet} now={now} petContext={{}} petSettings={{motion,signatures:true}} onBack={()=>{}} petActions={{setCosmetic:(key,value)=>apply(p=>setCosmetic(p,key,value)),care:(action,time)=>apply(p=>care(p,action,time)),switchTo:key=>apply(p=>switchTo(p,key)),rename:value=>apply(p=>rename(p,value))}} /></main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
