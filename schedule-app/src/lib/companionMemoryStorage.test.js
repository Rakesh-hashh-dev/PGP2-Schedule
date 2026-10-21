import { describe,it,expect,vi,afterEach } from 'vitest';
import { createMemoryStore,loadMemoryLocal,saveMemoryLocal,writeMemoryCloud,readMemoryCloud } from './companionMemoryStorage.js';
import { memoryEvent,mergeMemoryEvents } from './companionMemory.js';
const event=(n=1)=>memoryEvent('interaction',{petKey:'fox',target:'plant'},new Date(2026,9,n,12));
function storage(){const map=new Map();return {getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};}
afterEach(()=>vi.useRealTimers());
describe('account-bound durable memory',()=>{
 it('separates accounts and survives a reload before upload',()=>{
  const disk=storage(),a=createMemoryStore({owner:'a',storage:disk,remote:null});a.record(event());
  expect(createMemoryStore({owner:'b',storage:disk,remote:null}).getEvents()).toEqual([]);
  expect(createMemoryStore({owner:'a',storage:disk,remote:null}).getEvents()).toHaveLength(1);
 });
 it('surfaces blocked persistence instead of claiming the moment was synced',()=>{
  const disk={getItem:()=>'{bad',setItem:()=>{throw Error('quota');}};
  expect(loadMemoryLocal('a',disk)).toEqual([]);expect(saveMemoryLocal('a',[],disk)).toBe(false);
  const store=createMemoryStore({owner:'a',storage:disk,remote:null});store.record(event());expect(store.getSnapshot().status).toBe('unsaved');
 });
 it('unions two devices and makes retries idempotent',async()=>{
  const cloud=new Map();const remote={read:async()=>[...cloud.values()],write:async(_owner,events)=>{events.forEach(e=>{if(!cloud.has(e.id))cloud.set(e.id,e);});}};
  const a=createMemoryStore({owner:'a',storage:storage(),remote}),b=createMemoryStore({owner:'a',storage:storage(),remote});
  a.record(event(1));b.record(event(2));await Promise.all([a.retry(),b.retry()]);await a.retry();await b.retry();
  expect(cloud.size).toBe(2);expect(a.getEvents()).toEqual(b.getEvents());expect(a.getSnapshot().status).toBe('synced');a.dispose();b.dispose();
 });
 it('keeps changes made while cloud reconciliation is in flight',async()=>{
  let resolve;const write=vi.fn(async()=>{});const store=createMemoryStore({owner:'a',storage:storage(),remote:{read:()=>new Promise(r=>{resolve=r;}),write}});
  const pending=store.retry();store.record(event(2));resolve([event(1)]);await pending;
  expect(store.getEvents()).toHaveLength(2);expect(write).toHaveBeenCalledWith('a',[event(2)]);store.dispose();
 });
 it('retries after a missing migration or offline error without losing local events',async()=>{
  let offline=true;const write=vi.fn(async()=>{});const disk=storage();const store=createMemoryStore({owner:'a',storage:disk,remote:{read:async()=>{if(offline)throw Error('missing table');return [];},write}});
  store.record(event());await store.retry();expect(store.getSnapshot().status).toBe('device');expect(loadMemoryLocal('a',disk)).toHaveLength(1);
  offline=false;await store.retry();expect(write).toHaveBeenCalledWith('a',[event()]);expect(store.getSnapshot().status).toBe('synced');store.dispose();
 });
 it('keeps events recorded during an in-flight upload pending for the next sync',async()=>{
  let finish;const cloud=new Map();let first=true;
  const remote={read:async()=>[...cloud.values()],write:async(_owner,events)=>{if(first){first=false;await new Promise(resolve=>{finish=resolve;});}events.forEach(event=>cloud.set(event.id,event));}};
  const store=createMemoryStore({owner:'a',storage:storage(),remote});store.record(event(1));const pending=store.retry();
  await Promise.resolve();await Promise.resolve();store.record(event(2));finish();await pending;
  expect(store.getSnapshot().status).toBe('saving');expect(store.getEvents()).toHaveLength(2);
  await store.retry();expect(cloud.size).toBe(2);expect(store.getSnapshot().status).toBe('synced');store.dispose();
 });
 it('does not leak an old account into a newly constructed store',async()=>{
  let resolve;const a=createMemoryStore({owner:'a',storage:storage(),remote:{read:()=>new Promise(r=>{resolve=r;}),write:vi.fn()}});const pending=a.retry();a.dispose();
  const b=createMemoryStore({owner:'b',storage:storage(),remote:null});resolve([event()]);await pending;expect(b.getEvents()).toEqual([]);
 });
});
describe('append-only cloud protocol',()=>{
 it('uploads in bounded batches with immutable conflict handling',async()=>{
  const upsert=vi.fn(async()=>({error:null})),client={from:vi.fn(()=>({upsert}))};
  const events=Array.from({length:205},(_,n)=>({...event(),id:`interaction:unique:${n}`}));
  await writeMemoryCloud('owner',events,client);expect(upsert).toHaveBeenCalledTimes(3);
  expect(upsert.mock.calls[0][1]).toEqual({onConflict:'user_id,event_id',ignoreDuplicates:true});expect(upsert.mock.calls[2][0]).toHaveLength(5);
 });
 it('reads all pages and filters malformed cloud payloads',async()=>{
  const rows=Array.from({length:1000},()=>({payload:event()}));let page=0;
  const range=vi.fn(async()=>({data:page++===0?rows:[{payload:null},{payload:event(2)}],error:null}));
  const query={select:()=>query,eq:vi.fn(()=>query),order:()=>query,range};const client={from:()=>query};
  expect(await readMemoryCloud('owner',client)).toEqual(mergeMemoryEvents([event(),event(2)]));expect(range).toHaveBeenCalledTimes(2);expect(query.eq).toHaveBeenCalledWith('user_id','owner');
 });
});
