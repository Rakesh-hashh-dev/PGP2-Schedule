import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createMemoryStore } from '../lib/companionMemoryStorage.js';
export function useCompanionMemory(userId,{offline=false}={}) {
 const store=useMemo(()=>createMemoryStore({owner:userId, ...(offline ? {remote:null}:{})}),[userId,offline]);
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
 useEffect(()=>{
  store.start();
  const resume=()=>{if(!document.hidden)void store.retry();};
  window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  return()=>{store.dispose();window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
 },[store]);
 return useMemo(()=>({...snapshot,owner:userId,record:store.record,retry:store.retry,getEvents:store.getEvents}),[snapshot,store,userId]);
}
