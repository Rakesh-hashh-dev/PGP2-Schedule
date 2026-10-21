import { useCallback, useEffect, useRef, useState } from 'react';
import { buddyFamiliarity, discoveryFor, favoriteTarget, memoryEvent, returnGreeting } from '../lib/companionMemory.js';
const EMPTY=[];
export function useCompanionStory({memory,petKey,petName,buddyKey,buddyName,scene,inClass,now}) {
 const events=memory?.events || EMPTY;
 const record=memory?.record, getEvents=memory?.getEvents, ready=memory?.ready, owner=memory?.owner;
 const favorite=favoriteTarget(events,petKey);
 const familiarity=buddyFamiliarity(events,petKey,buddyKey);
 const [moment,setMoment]=useState(null),[welcome,setWelcome]=useState(null);
 const seen=useRef('');
 const context=useCallback(()=>({owner,petKey,petName,buddyKey,buddyName,scene}),[owner,petKey,petName,buddyKey,buddyName,scene]);
 useEffect(()=>{
  if(!ready || !petKey || !record || !getEvents)return;
  // Schedule after the initial journal reconciliation; each context transition
  // is an arrival, while the app's clock ticks are not.
  const arrive=(at,resume=false)=>{
   const key=`${owner}:${petKey}:${Boolean(inClass)}`;
   if(!resume && seen.current===key)return;
   const latest=getEvents().filter(event=>event.kind==='visit' && event.petKey===petKey).at(-1);
   if(resume && latest && at.getTime()-latest.at<1800000)return;
   seen.current=key;
   const greeting=returnGreeting(getEvents(),petKey,at,inClass);
   record(memoryEvent('visit',{...context(),context:inClass?'class':'home'},at));
   if(greeting){const next={...context(),...greeting,momentId:globalThis.crypto?.randomUUID?.() || `${at.getTime()}`,target:null};setWelcome({...next,id:`welcome:${at.getTime()}`,source:'context'});setMoment(next);}
  };
  const timer=setTimeout(()=>arrive(new Date()),0);
  const resume=()=>{if(!document.hidden)arrive(new Date(),true);};
  document.addEventListener('visibilitychange',resume);
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',resume);};
 },[ready,petKey,inClass,owner,record,getEvents,now,context]);
 useEffect(()=>{if(!welcome)return;const timer=setTimeout(()=>setWelcome(null),2400);return()=>clearTimeout(timer);},[welcome]);
 const accepted=useCallback(activity=>{
  if(!activity.target || !record || !getEvents)return;
  const at=new Date();const details={...context(),target:activity.target};
  const discovery=activity.routine && activity.routine!=='break' ? null:discoveryFor(getEvents(),petKey,activity.target,at);
  if(activity.source==='touch'){
   record(memoryEvent('interaction',details,at));
   if(buddyKey)record(memoryEvent('bond',details,at));
  }
  if(discovery)record(memoryEvent('discovery',{...details,discovery:discovery.key},at));
  setMoment({...details,caption:discovery ? `Found ${discovery.label} together.`:`${petName} ${activity.label}`,discovery:discovery?.key || null,momentId:globalThis.crypto?.randomUUID?.() || `${at.getTime()}`});
 },[record,getEvents,context,petKey,petName,buddyKey]);
 const rememberBuddy=useCallback(()=>{if(record && buddyKey)record(memoryEvent('bond',context(),new Date()));},[record,buddyKey,context]);
 const current=moment?.owner===owner && moment?.petKey===petKey ? moment:null;
 const save=useCallback(()=>{if(current && record)record(memoryEvent('album',current,new Date()));},[current,record]);
 return {favorite,familiarity,accepted,rememberBuddy,moment:current,save,saved:Boolean(current && events.some(event=>event.id===`album:${current.momentId}`)),welcome:welcome?.owner===owner && welcome?.petKey===petKey ? welcome:null};
}
