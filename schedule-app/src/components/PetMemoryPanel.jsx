import { useState } from 'react';
import { getPetByKey } from './greetingPets.jsx';
import { HABITATS } from '../lib/petHabitat.js';
import '../styles/pet-memory.css';
const TARGET_NAMES={plant:'the little plant',books:'the book stack',lantern:'the warm lantern',cushion:'the soft cushion',sky:'the sky'};
export function PetDiscoveryArt({kind,...props}) {
 return <svg viewBox="0 0 32 32" className="pet-discovery-art" aria-hidden="true" focusable="false" {...props}><circle cx="16" cy="16" r="15" fill="#efe5c8"/>
 {kind==='leaf' ? <><path d="M9 23Q5 8 25 7q0 18-16 16" fill="#83a77c"/><path d="m9 24 12-12" stroke="#506d52" strokeWidth="1.5"/></> : kind==='bookmark' ? <><path d="M8 8q5-2 8 0 4-2 8 0v17q-5-2-8 0-3-2-8 0Z" fill="#b09ac2"/><path d="M16 8v17M19 7v9l2-2 2 2V7" fill="#d7b075" stroke="#8a6c96"/></> : kind==='feather' ? <><path d="M10 23Q3 13 23 7q4 13-13 16" fill="#b4a5c8"/><path d="m9 26 12-15m-6 9-5-1m8-3-5-1" stroke="#7b6a97" strokeWidth="1.5" fill="none"/></> : <path d="m16 6 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill={kind==='star'?'#b99ad2':'#d6ab57'}/>}</svg>;
}
export default function PetMemoryPanel({memory,favorite,familiarity,petKey,buddyKey,petName}) {
 const [limit,setLimit]=useState(12);
 const album=(memory?.events || []).filter(event=>event.kind==='album').toReversed();
 const status=memory?.status==='synced'?'Synced across your devices':memory?.status==='saving'?'Saving memories…':memory?.status==='unsaved'?'Memory storage is unavailable. Keep this page open and retry.':'Saved on this device';
 const Current=getPetByKey(petKey);
 return <section className="pet-card pet-memory-panel" aria-label="Companion memories"><div className="pet-card-heading"><div><p className="pet-eyebrow">Little things, remembered</p><h3 className="pet-h3">Memory album</h3></div><span className="pet-total-pill">{album.length} saved</span></div>
 <div className="pet-memory-bonds"><p><strong>{petName || Current.label}’s favourite</strong><span>{favorite?`Often returns to ${TARGET_NAMES[favorite.key]}.`:'Still discovering what feels like home.'}</span></p>{buddyKey && <p><strong>{familiarity.label}</strong><span>{familiarity.days?`${familiarity.days} ${familiarity.days===1?'day':'days'} of little moments together.`:'Say hello or explore a decoration together.'}</span></p>}</div><p className="pet-care-note">Favourites and familiarity grow over distinct days. There is no streak to protect.</p>
 {album.length?<div className="pet-memory-album">{album.slice(0,limit).map(event=>{const Primary=getPetByKey(event.petKey),Buddy=event.buddyKey?getPetByKey(event.buddyKey):null;return <article key={event.id} className="pet-memory-entry" data-scene={event.scene}><div className="pet-memory-picture" aria-hidden="true"><span className="dg-pet" data-pet={Primary.key} data-motion="off"><Primary.Svg/></span>{Buddy && <span className="dg-pet pet-memory-buddy" data-pet={Buddy.key} data-motion="off"><Buddy.Svg/></span>}{event.discovery && <PetDiscoveryArt kind={event.discovery}/>}</div><p className="pet-memory-names">{event.petName || Primary.label}{Buddy?` & ${event.buddyName || Buddy.label}`:''}</p><p>{event.caption}</p><small>{HABITATS.find(place=>place.key===event.scene)?.label} · <time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</time></small></article>;})}</div>:<div className="pet-memory-empty"><PetDiscoveryArt kind="bookmark"/><p>No moments saved yet.</p><span>Tap a decoration, then choose “Save moment” beside your companion.</span></div>}
 {album.length>limit && <button type="button" className="pet-social-greet" onClick={()=>setLimit(value=>value+12)}>Show more memories</button>}
 <div className="pet-memory-sync"><span role="status">{status}</span>{memory?.retry && ['device','unsaved'].includes(memory.status) && <button type="button" onClick={memory.retry}>Retry sync</button>}</div></section>;
}
