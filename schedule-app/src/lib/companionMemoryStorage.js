import { supabase } from './supabase.js';
import { mergeMemoryEvents } from './companionMemory.js';
export const MEMORY_CACHE='termflow-companion-memory:v1:';
export function loadMemoryLocal(owner,storage=globalThis.localStorage) {
 try{return owner ? mergeMemoryEvents(JSON.parse(storage?.getItem(MEMORY_CACHE+owner) || '[]')):[];}catch{return [];}
}
export function saveMemoryLocal(owner,events,storage=globalThis.localStorage) {
 if(!owner)return false;
 try{if(!storage)return false;storage.setItem(MEMORY_CACHE+owner,JSON.stringify(events));return true;}catch{return false;}
}
export async function readMemoryCloud(owner,client=supabase) {
 const events=[];
 for(let start=0;;start+=1000) {
  const {data,error}=await client.from('companion_memory_events').select('event_id,payload').eq('user_id',owner).order('event_id').range(start,start+999);
  if(error)throw error;
  events.push(...data.map(row=>row.payload));if(data.length<1000)break;
 }
 return mergeMemoryEvents(events);
}
export async function writeMemoryCloud(owner,events,client=supabase) {
 for(let start=0;start<events.length;start+=100) {
  const {error}=await client.from('companion_memory_events').upsert(events.slice(start,start+100).map(event=>({user_id:owner,event_id:event.id,payload:event})),{onConflict:'user_id,event_id',ignoreDuplicates:true});
  if(error)throw error;
 }
}
/** One account-bound journal. Pending events stay in local storage until acknowledged. */
export function createMemoryStore({owner,remote={read:readMemoryCloud,write:writeMemoryCloud},storage=globalThis.localStorage,setTimer=setTimeout,clearTimer=clearTimeout}) {
 let snapshot={events:loadMemoryLocal(owner,storage),ready:!remote,status:'device'};
 let known=new Set(),loaded=false,busy=null,again=false,disposed=false,timer;
 const listeners=new Set();
 const emit=next=>{snapshot={...snapshot,...next};listeners.forEach(listener=>listener());};
 const persist=events=>saveMemoryLocal(owner,events,storage);
 const queue=()=>{clearTimer(timer);if(remote && !disposed)timer=setTimer(()=>{void sync(false);},750);};
 async function sync(pull=true) {
  if(disposed)return;
  if(!remote || !owner){emit({ready:true,status:'device'});return;}
  if(busy){again=true;return busy;}
  busy=(async()=>{
   emit({status:'saving'});
   try {
    if(pull || !loaded){const cloud=await remote.read(owner);if(disposed)return;known=new Set(cloud.map(event=>event.id));loaded=true;const events=mergeMemoryEvents(snapshot.events,cloud);const saved=persist(events);emit({events,ready:true,status:saved?'saving':'unsaved'});}
    const pending=snapshot.events.filter(event=>!known.has(event.id));
    if(pending.length)await remote.write(owner,pending);
    if(disposed)return;
    pending.forEach(event=>known.add(event.id));
    const saved=persist(snapshot.events);
    emit({ready:true,status:!saved?'unsaved':snapshot.events.some(event=>!known.has(event.id))?'saving':'synced'});
   } catch {if(!disposed)emit({ready:true,status:persist(snapshot.events)?'device':'unsaved'});}
  })().finally(()=>{busy=null;if(again && !disposed){again=false;queue();}});
  return busy;
 }
 return {
  getSnapshot:()=>snapshot,
  getEvents:()=>snapshot.events,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  record(event){if(!owner || disposed || !event)return false;const events=mergeMemoryEvents(snapshot.events,[event]);if(events.length===snapshot.events.length && events.every((value,index)=>JSON.stringify(value)===JSON.stringify(snapshot.events[index])))return false;const saved=persist(events);emit({events,status:!saved?'unsaved':remote?'saving':'device'});queue();return true;},
  retry:()=>sync(true),
  start(){disposed=false;void sync(true);},
  dispose(){disposed=true;clearTimer(timer);},
 };
}
