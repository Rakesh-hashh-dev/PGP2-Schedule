import { afterEach, describe, it, expect, vi } from 'vitest';
import { PET_PROFILES } from './petProfiles.js';
import { habitatResponse, createHabitatDirector, HABITAT_TARGETS, HABITAT_ACTION_MS, HABITAT_TRAITS } from './petHabitatInteraction.js';
import { createPetDirector } from './petDirector.js';
afterEach(()=>vi.useRealTimers());
function setup({primary='fox',buddy='nimbus',...initial}={}) {
 vi.useFakeTimers();const onCue=vi.fn();
 const director=createHabitatDirector({primary,buddy,onCue,random:()=>0});
 director.update({enabled:true,habitat:{scene:'garden',light:'auto',decor:['plant','books','lantern','cushion']},...initial});
 return {director,onCue};
}
describe('whole-roster habitat responses',()=>{
 it('provides anatomically supported responses for every pet, target and context',()=>{
  expect(Object.keys(PET_PROFILES)).toHaveLength(32);
  expect(Object.keys(HABITAT_TRAITS).sort()).toEqual(Object.keys(PET_PROFILES).sort());
  for(const [key,profile] of Object.entries(PET_PROFILES)) for(const target of HABITAT_TARGETS) for(const mood of ['content','focused','sleepy','rooting']) {
   const response=habitatResponse(key,target,mood);
   expect(response.target).toBe(target);
   expect([...profile.idles,'listen','doze']).toContain(response.action);
   if(['focused','sleepy','rooting'].includes(mood) && target!=='cushion') expect(response.behavior).toBe('watch');
  }
 });
 it('gives Nimbus, Leafy and Byte distinct object interactions',()=>{
  expect(habitatResponse('nimbus','lantern').behavior).toBe('orbit');
  expect(habitatResponse('leafy','plant').behavior).toBe('tend');
  expect(habitatResponse('byte','books').action).toBe('scan');
  expect(habitatResponse('unknown','books')).toBeNull();
  expect(habitatResponse('fox','unknown')).toBeNull();
 });
});
describe('habitat choreography',()=>{
 it('shares a discovery, then starts a fresh autonomous gap',()=>{
  const {director,onCue}=setup();director.interact('plant');
  expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({target:'plant',source:'touch'}));
  vi.advanceTimersByTime(550);
  expect(onCue).toHaveBeenLastCalledWith('buddy',expect.objectContaining({action:'buddy-look',target:'plant'}));
  vi.advanceTimersByTime(HABITAT_ACTION_MS+100);
  expect(onCue).toHaveBeenLastCalledWith('buddy',null);
  expect(vi.getTimerCount()).toBe(1);
 });
 it('settles both pets and avoids spontaneous exploration during focused moments',()=>{
  const {director,onCue}=setup({mood:'sleepy'});vi.advanceTimersByTime(4500);
  expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({target:'cushion',behavior:'rest',source:'habitat'}));
  vi.advanceTimersByTime(550);expect(onCue).toHaveBeenLastCalledWith('buddy',expect.objectContaining({behavior:'rest'}));
  director.update({mood:'focused'});expect(vi.getTimerCount()).toBe(0);
  director.interact('lantern');expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({behavior:'watch'}));
 });
 it('cancels buddy replies and all future visits as soon as care starts',()=>{
  const {director,onCue}=setup();director.interact('books');director.update({reaction:'pet'});onCue.mockClear();
  vi.advanceTimersByTime(120000);expect(onCue).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  expect(director.interact('books')).toBe(false);
  director.update({reaction:null});expect(vi.getTimerCount()).toBe(1);
 });
 it('respects removed decorations, switches and reduced-motion suspension',()=>{
  const {director,onCue}=setup();director.interact('lantern');
  director.update({habitat:{scene:'study',light:'night',decor:[]}});
  expect(onCue).toHaveBeenLastCalledWith('buddy',null);expect(director.interact('lantern')).toBe(false);
  director.update({enabled:false});expect(vi.getTimerCount()).toBe(0);expect(director.interact('sky')).toBe(false);
  director.update({enabled:true});expect(vi.getTimerCount()).toBe(1);director.stop();expect(vi.getTimerCount()).toBe(0);
 });
 it('turns off automatic visits but permits deliberate decoration taps',()=>{
  const {director,onCue}=setup({autonomous:false});expect(vi.getTimerCount()).toBe(0);
  expect(director.interact('books')).toBe(true);
  expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({source:'touch'}));
  vi.advanceTimersByTime(10000);expect(vi.getTimerCount()).toBe(0);
 });
});
describe('shared action priority',()=>{
 it('care cancels habitat movement, and lower-priority cues cannot replace it',()=>{
  vi.useFakeTimers();const onChange=vi.fn();const director=createPetDirector({petKey:'nimbus',onChange});
  director.update({enabled:true});
  const cue={...habitatResponse('nimbus','lantern'),source:'touch'};
  expect(director.habitat(cue)).toBe(true);
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({behavior:'orbit'}));
  director.update({reaction:'treat'});
  expect(onChange).toHaveBeenLastCalledWith({action:'treat',source:'care'});
  expect(director.habitat(cue)).toBe(false);
 });
 it('clears metadata on direct pet touch, environment changes and spontaneous-off',()=>{
  vi.useFakeTimers();const onChange=vi.fn();const director=createPetDirector({petKey:'byte',onChange});director.update({enabled:true});
  const cue={...habitatResponse('byte','books'),source:'habitat'};
  director.habitat(cue);director.touch();expect(onChange.mock.lastCall[0].target).toBeUndefined();
  vi.advanceTimersByTime(1800);director.habitat(cue);director.cancelHabitat();expect(onChange).toHaveBeenLastCalledWith({action:'',source:'idle'});
  director.habitat(cue);director.update({autonomous:false});expect(onChange.mock.lastCall[0].target).toBeUndefined();
 });
 it('can switch between objects with the same local action',()=>{
  vi.useFakeTimers();const onChange=vi.fn();const director=createPetDirector({petKey:'byte',onChange});director.update({enabled:true});
  expect(director.habitat({...habitatResponse('byte','books'),source:'touch'})).toBe(true);
  expect(director.habitat({...habitatResponse('byte','plant'),source:'touch'})).toBe(true);
  expect(onChange.mock.lastCall[0].target).toBe('plant');
 });
});
