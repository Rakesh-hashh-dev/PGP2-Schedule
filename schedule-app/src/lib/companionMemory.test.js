import { describe,it,expect,vi,afterEach } from 'vitest';
import { PET_PROFILES } from './petProfiles.js';
import { memoryEvent,mergeMemoryEvents,normalizeMemoryEvent,favoriteTarget,buddyFamiliarity,returnGreeting,discoveryFor } from './companionMemory.js';
import { buddyPlan } from './petBuddy.js';
import { createHabitatDirector } from './petHabitatInteraction.js';
const context={petKey:'fox',petName:'Maple',buddyKey:'nimbus',buddyName:'Nimbus',scene:'garden',target:'plant'};
const day=n=>new Date(2026,9,n,12);
afterEach(()=>vi.useRealTimers());
describe('companion memory journal',()=>{
 it('merges concurrent devices without losing or double-counting a day',()=>{
  const a=memoryEvent('interaction',context,day(20)),b=memoryEvent('bond',context,day(20));
  expect(mergeMemoryEvents([a],[a,b])).toEqual(mergeMemoryEvents([b,a],[a]));
  expect(mergeMemoryEvents([a,b],[a,b])).toHaveLength(2);
 });
 it('caps repeated taps by day and tracks every roster identity independently',()=>{
  for(const petKey of Object.keys(PET_PROFILES)) {
   const events=mergeMemoryEvents([1,2,3].flatMap(n=>Array.from({length:10},()=>memoryEvent('interaction',{...context,petKey},day(n)))));
   expect(events).toHaveLength(3);expect(favoriteTarget(events,petKey)).toEqual({key:'plant',days:3});
   expect(favoriteTarget(events,petKey==='cat'?'fox':'cat')).toBeNull();
  }
 });
 it('has no bond decay, treats reversed pairs as the same pair, and prevents tap grinding',()=>{
  const events=mergeMemoryEvents(Array.from({length:7},(_,n)=>memoryEvent('bond',context,day(n+1))));
  expect(buddyFamiliarity(events,'nimbus','fox')).toEqual({days:7,label:'Old friends'});
  expect(buddyFamiliarity(mergeMemoryEvents([events[0],events[0]]),'fox','nimbus').days).toBe(1);
  expect(buddyFamiliarity(events,'fox','cat').days).toBe(0);
 });
 it('preserves the originating day when another device uses a different timezone',()=>{
  const event=memoryEvent('interaction',context,day(1));event.day='2026-09-30';
  expect(normalizeMemoryEvent(event).day).toBe('2026-09-30');
 });
 it('remembers the names, scene and caption of a selected moment',()=>{
  const album=memoryEvent('album',{...context,caption:'Found a fallen leaf together.',momentId:'one'},day(1));
  const renamed={...context,petName:'New name'};
  expect(mergeMemoryEvents([album],[memoryEvent('interaction',renamed,day(2))])[0]).toMatchObject({petName:'Maple',buddyName:'Nimbus',scene:'garden'});
  expect(mergeMemoryEvents([album],[album])).toHaveLength(1);
 });
 it('ignores corrupt, unknown and incomplete events',()=>{
  for(const value of [null,{},'bad',{...memoryEvent('bond',context,day(1)),petKey:'unknown'},{...memoryEvent('bond',context,day(1)),petKey:'__proto__'},{...memoryEvent('discovery',{...context,discovery:'leaf'},day(1)),discovery:'constructor'},{...memoryEvent('interaction',context,day(1)),target:'bad'},{...memoryEvent('album',{...context,caption:'x'},day(1)),caption:''}])expect(normalizeMemoryEvent(value)).toBeNull();
 });
 it('distinguishes a class return and a long break without negative wording',()=>{
  const visit=memoryEvent('visit',{...context,context:'class'},day(1));
  expect(returnGreeting([visit],'fox',new Date(day(1).getTime()+3600000)).kind).toBe('class');
  expect(returnGreeting([visit],'fox',day(10)).kind).toBe('return');
  expect(returnGreeting([visit],'fox',day(1),true)).toBeNull();
  expect(returnGreeting([],'fox',day(1))).toBeNull();
 });
 it('makes discoveries deterministic and limits them to one per pet per day',()=>{
  let selected;
  for(let n=1;n<=28;n++){const now=day(n);if(discoveryFor([],'fox','plant',now)){selected=now;break;}}
  expect(selected).toBeDefined();const discovery=discoveryFor([],'fox','plant',selected);
  expect(discoveryFor([],'fox','plant',selected)).toEqual(discovery);
  const event=memoryEvent('discovery',{...context,discovery:discovery.key},selected);
  for(const target of ['plant','books','lantern','cushion','sky'])expect(discoveryFor([event],'fox',target,selected)).toBeNull();
 });
});
describe('memory influences choreography',()=>{
 it('adds familiar routines for all pairings using supported social gestures',()=>{
  for(const a of Object.keys(PET_PROFILES))for(const b of Object.keys(PET_PROFILES)) {
   const familiar=buddyPlan(a,b,'greet',3),close=buddyPlan(a,b,'greet',7);
   expect(familiar).toHaveLength(4);expect(close).toHaveLength(4);expect(close).not.toEqual(buddyPlan(a,b,'greet'));
   expect(buddyPlan(a,b,'glance',7)).toEqual(buddyPlan(a,b,'glance'));
  }
 });
 it('weights a remembered favourite without repeating it immediately',()=>{
  vi.useFakeTimers();const onCue=vi.fn();
  const director=createHabitatDirector({primary:'fox',onCue,random:()=>.8});
  director.update({enabled:true,habitat:{scene:'garden',light:'day',decor:['plant','books']},favorite:'plant'});
  vi.advanceTimersByTime(77000);expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({target:'plant'}));
  vi.advanceTimersByTime(4850+77000);expect(onCue.mock.calls.filter(([role,cue])=>role==='primary' && cue).at(-1)[1].target).not.toBe('plant');
  director.stop();
 });
});
