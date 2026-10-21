import { afterEach,describe,it,expect,vi } from 'vitest';
import { routineFor,routinePlan } from './petRoutine.js';
import { PET_PROFILES } from './petProfiles.js';
import { normalizeHabitat,validHabitat } from './petHabitat.js';
import { adopt,emptyPet,setCosmetic,xpOf } from './pet.js';
import { fromRow,toRow } from './petStorage.js';
import { createHabitatDirector } from './petHabitatInteraction.js';
import { createPetDirector } from './petDirector.js';
const habitat={scene:'garden',light:'auto',decor:['plant','books','lantern','cushion']};
const at=hour=>new Date(2026,9,21,hour);
const choose=(hour,extra={})=>routineFor({now:at(hour),habitat,...extra});
afterEach(()=>vi.useRealTimers());
describe('daily rhythm selection',()=>{
 it.each([[0,'sleep'],[5,'sleep'],[6,'break'],[17,'break'],[18,'evening'],[21,'evening'],[22,'sleep'],[23,'sleep']])('uses local hour %s for %s',(hour,key)=>expect(choose(hour).key).toBe(key));
 it('keeps late classes quiet and prepares when class is close',()=>{
  expect(choose(23,{inClass:true})).toMatchObject({key:'study',target:'books'});
  expect(choose(12,{minsToClass:10}).key).toBe('study');expect(choose(12,{minsToClass:11}).key).toBe('break');
  expect(choose(12,{minsToClass:-5}).key).toBe('break');
 });
 it('distinguishes an actual gap today from free time after the last class',()=>{
  expect(choose(12,{classesToday:2,minsToClass:60}).label).toBe('Between classes');
  expect(choose(12,{classesToday:2,minsToClass:null}).label).toBe('Free time');
  expect(choose(12,{classesToday:2,minsToClass:1440}).label).toBe('Free time');
 });
 it('respects settings and important celebrations',()=>{
  expect(choose(12,{habitat:{...habitat,routines:false}})).toBeNull();
  expect(choose(12,{mood:'celebrating'})).toBeNull();
  expect(routineFor({now:new Date('bad')})).toBeNull();
 });
 it('uses only present decorations and gracefully rests without a cushion',()=>{
  for(const hour of [0,12,18,23])expect(choose(hour,{habitat:{...habitat,decor:[]}}).target || 'sky').toBe('sky');
  expect(choose(18,{habitat:{...habitat,decor:['plant']},favorite:'plant'}).target).toBe('plant');
  expect(routinePlan('fox','nimbus',choose(23,{habitat:{...habitat,decor:[]}}))[0]).toMatchObject({target:'sky',action:'listen'});
 });
 it('round-trips the opt-out through existing cosmetic storage without touching XP',()=>{
  const pet=setCosmetic(adopt(emptyPet(),'cat','Mochi'),'habitat',{...habitat,routines:false});
  expect(fromRow(toRow('owner',pet)).cosmetics.habitat.routines).toBe(false);expect(xpOf(pet)).toBe(0);
  expect(validHabitat(habitat)).toBe(true);expect(validHabitat({...habitat,routines:'bad'})).toBe(false);
  expect(normalizeHabitat({...habitat,routines:'bad'}).routines).toBe(true);
 });
 it('covers all 32 pets with shared quiet routines and anatomy-aware familiar greetings',()=>{
  for(const primary of Object.keys(PET_PROFILES))for(const buddy of Object.keys(PET_PROFILES)){
   for(const hour of [12,18,23]){
    const routine=hour===12?choose(hour,{inClass:true}):choose(hour);
    const plan=routinePlan(primary,buddy,routine,{familiarity:7});
    expect(plan).toHaveLength(2);expect(plan[0].action).toBe(hour===23?'doze':'listen');
   }
   expect(routinePlan(primary,buddy,choose(12),{greet:true,familiarity:7})).toHaveLength(4);
  }
 });
});
function setup(routine=choose(18)) {
 vi.useFakeTimers();vi.setSystemTime(at(18));const onCue=vi.fn(),onStatus=vi.fn();
 const director=createHabitatDirector({primary:'fox',buddy:'nimbus',onCue,onStatus,random:()=>.5});
 director.update({enabled:true,habitat,routine,mood:routine?.mood || 'content',familiarity:7});return {director,onCue,onStatus};
}
describe('coordinated routine controller',()=>{
 it('gathers both pets quietly and uses a fresh gap after each visit',()=>{
  const {director,onCue}=setup();vi.advanceTimersByTime(4500);
  expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({target:'lantern',action:'listen',routine:'evening'}));
  vi.advanceTimersByTime(250);expect(onCue).toHaveBeenLastCalledWith('buddy',expect.objectContaining({routine:'evening'}));
  vi.advanceTimersByTime(4600);expect(vi.getTimerCount()).toBe(1);director.stop();expect(vi.getTimerCount()).toBe(0);
 });
 it('allows a manual choice to finish across a class transition, then holds routines for 90s',()=>{
  const {director,onCue}=setup();director.interact('plant');director.update({routine:choose(12,{inClass:true}),mood:'focused'});
  expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({target:'plant',source:'touch'}));
  vi.advanceTimersByTime(89999);expect(onCue.mock.calls.filter(([,cue])=>cue?.routine)).toHaveLength(0);
  vi.advanceTimersByTime(1);expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({routine:'study',target:'books'}));director.stop();
 });
 it('pauses for ten minutes and resumes without replaying a pending buddy reply',()=>{
  const {director,onCue,onStatus}=setup();vi.advanceTimersByTime(4500);director.pause();onCue.mockClear();
  vi.advanceTimersByTime(10000);expect(onCue).not.toHaveBeenCalled();expect(onStatus).toHaveBeenLastCalledWith({pausedUntil:at(18).getTime()+4500+600000});
  director.resume();vi.advanceTimersByTime(4499);expect(onCue.mock.calls.filter(([,cue])=>cue?.routine)).toHaveLength(0);
  vi.advanceTimersByTime(1);expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({routine:'evening'}));director.stop();
 });
 it('cancels routine poses and delayed buddy replies for care, hidden tabs and opt-out',()=>{
  const {director,onCue}=setup();vi.advanceTimersByTime(4500);director.update({reaction:'pet'});onCue.mockClear();vi.advanceTimersByTime(10000);expect(onCue).not.toHaveBeenCalled();
  director.update({reaction:null});director.update({enabled:false});expect(vi.getTimerCount()).toBe(0);
  director.update({enabled:true,routine:null,mood:'content',autonomous:false});expect(vi.getTimerCount()).toBe(0);expect(director.interact('books')).toBe(true);director.stop();
 });
 it('removes visits to deleted decorations and keeps spontaneous-off manual taps available',()=>{
  const {director,onCue}=setup();director.interact('lantern');director.update({habitat:{...habitat,decor:['books']},routine:choose(18,{habitat:{...habitat,decor:['books']}})});
  expect(onCue).toHaveBeenLastCalledWith('buddy',null);expect(director.interact('lantern')).toBe(false);
  director.update({autonomous:false});expect(director.interact('books')).toBe(true);director.stop();
 });
 it('keeps routine choreography below care priority in the shared actor controller',()=>{
  vi.useFakeTimers();const onChange=vi.fn(),actor=createPetDirector({petKey:'fox',onChange});actor.update({enabled:true});
  const step=routinePlan('fox','nimbus',choose(18))[0];expect(actor.habitat({...step,source:'habitat'})).toBe(true);
  actor.update({reaction:'treat'});expect(actor.habitat({...step,source:'habitat'})).toBe(false);expect(onChange).toHaveBeenLastCalledWith({action:'treat',source:'care'});actor.stop();
 });
});
