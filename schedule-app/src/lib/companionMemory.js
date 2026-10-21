import { PET_PROFILES } from './petProfiles.js';
import { ymd } from './datetime.js';
export const MEMORY_TARGETS = ['plant','books','lantern','cushion','sky'];
export const DISCOVERIES = {leaf:'a fallen leaf',bookmark:'a tiny bookmark',mote:'a little golden glimmer',feather:'a soft feather',star:'a new pattern in the stars'};
const KINDS = new Set(['visit','interaction','bond','discovery','album']);
const SCENES = new Set(['garden','study','observatory']);
export const pairKey=(a,b)=>a && b && a!==b ? [a,b].sort().join(':') : null;
const hasPet=key=>typeof key==='string' && Object.hasOwn(PET_PROFILES,key);
const hasDiscovery=key=>typeof key==='string' && Object.hasOwn(DISCOVERIES,key);
const validDay=day=>typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0,10)===day;
const clean=(value,max)=>typeof value==='string' ? value.slice(0,max) : '';
export function normalizeMemoryEvent(raw) {
 if(!raw || !KINDS.has(raw.kind) || !hasPet(raw.petKey) || typeof raw.id!=='string' || !/^[a-zA-Z0-9:_-]{1,150}$/.test(raw.id) || !Number.isFinite(raw.at) || raw.at<946684800000 || raw.at>4102444800000) return null;
 const target=MEMORY_TARGETS.includes(raw.target) ? raw.target:null;
 if(['interaction','discovery'].includes(raw.kind) && !target) return null;
 if(raw.kind==='discovery' && !hasDiscovery(raw.discovery)) return null;
 const buddyKey=hasPet(raw.buddyKey) && raw.buddyKey!==raw.petKey ? raw.buddyKey:null;
 if(raw.kind==='bond' && !buddyKey) return null;
 if(raw.kind==='album' && !clean(raw.caption,180)) return null;
 return {id:raw.id,kind:raw.kind,at:Math.floor(raw.at),day:validDay(raw.day) ? raw.day:ymd(new Date(raw.at)),petKey:raw.petKey,petName:clean(raw.petName,24),buddyKey,buddyName:buddyKey ? clean(raw.buddyName,24):'',scene:SCENES.has(raw.scene) ? raw.scene:'garden',target,discovery:hasDiscovery(raw.discovery) ? raw.discovery:null,caption:clean(raw.caption,180),context:raw.context==='class' ? 'class':'home'};
}
/** Set union; event IDs make retries, refreshes and concurrent devices idempotent. */
export function mergeMemoryEvents(...collections) {
 const events=new Map();
 for(const list of collections) for(const raw of Array.isArray(list) ? list:[]) {
  const event=normalizeMemoryEvent(raw);if(!event)continue;
  const old=events.get(event.id);
  if(!old || JSON.stringify(event)<JSON.stringify(old))events.set(event.id,event);
 }
 return [...events.values()].sort((a,b)=>a.at-b.at || a.id.localeCompare(b.id));
}
export function memoryEvent(kind,context,now=new Date()) {
 const at=now.getTime(),day=ymd(now),pair=pairKey(context.petKey,context.buddyKey);
 const suffix=kind==='interaction' ? `${context.petKey}:${context.target}:${day}`
  : kind==='bond' ? `${pair}:${day}` : kind==='discovery' ? `${context.petKey}:${day}`
  : kind==='visit' ? `${context.petKey}:${at}:${context.context==='class' ? 'class':'home'}:${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`
  : context.momentId || globalThis.crypto?.randomUUID?.() || `${at}-${Math.random().toString(36).slice(2)}`;
 return normalizeMemoryEvent({...context,kind,at,day,id:`${kind}:${suffix}`});
}
export function favoriteTarget(events,petKey) {
 const days=new Map(MEMORY_TARGETS.map(target=>[target,new Set()]));
 for(const event of events)if(event.kind==='interaction' && event.petKey===petKey)days.get(event.target)?.add(event.day);
 const ranked=MEMORY_TARGETS.map(key=>({key,days:days.get(key).size})).sort((a,b)=>b.days-a.days || a.key.localeCompare(b.key));
 return ranked[0].days>=3 ? ranked[0]:null;
}
export function buddyFamiliarity(events,primary,buddy) {
 const pair=pairKey(primary,buddy);if(!pair)return {days:0,label:'Getting acquainted'};
 const days=new Set(events.filter(event=>event.kind==='bond' && pairKey(event.petKey,event.buddyKey)===pair).map(event=>event.day)).size;
 return {days,label:days>=7 ? 'Old friends':days>=3 ? 'Familiar friends':'Getting acquainted'};
}
export function returnGreeting(events,petKey,now,inClass=false) {
 const last=events.filter(event=>event.kind==='visit' && event.petKey===petKey).at(-1);
 if(!last || inClass)return null;
 const gap=Math.max(0,now.getTime()-last.at);
 if(last.context==='class' && gap<72*3600000)return {kind:'class',caption:'Class is over. A quiet little welcome back.',action:'listen'};
 if(gap>=72*3600000)return {kind:'return',caption:'Welcome back. They settle beside you, right where you left off.',action:'nuzzle'};
 if(gap>=1800000)return {kind:'return',caption:'A familiar face after a little time away.',action:'nuzzle'};
 return null;
}
export function discoveryFor(events,petKey,target,now) {
 const day=ymd(now);
 if(!hasPet(petKey) || !MEMORY_TARGETS.includes(target) || events.some(event=>event.kind==='discovery' && event.petKey===petKey && event.day===day))return null;
 let hash=0;for(const letter of `${petKey}:${day}:${target}`)hash=(hash*31+letter.charCodeAt(0))>>>0;
 if(hash%7!==0)return null;
 const key={plant:'leaf',books:'bookmark',lantern:'mote',cushion:'feather',sky:'star'}[target];
 return {key,label:DISCOVERIES[key]};
}
