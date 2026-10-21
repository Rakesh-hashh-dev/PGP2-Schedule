import { afterEach, describe, expect, it, vi } from 'vitest';
import { buddyGreeting, buddyPlan, createBuddyDirector } from './petBuddy.js';
import { PET_PROFILES } from './petProfiles.js';
import { createPetDirector } from './petDirector.js';
afterEach(()=>vi.useRealTimers());
const setup=(mood='content',autonomous=true)=>{
  vi.useFakeTimers();const onCue=vi.fn();const engine=createBuddyDirector({primary:'cat',buddy:'nimbus',onCue,random:()=>0});
  engine.update({enabled:true,mood,autonomous});return {engine,onCue};
};
describe('buddy coordination',()=>{
  it('supports all 1024 roster pairings with greetings each anatomy can render',()=>{
    for(const a of Object.keys(PET_PROFILES))for(const b of Object.keys(PET_PROFILES)){
      const plan=buddyPlan(a,b,'greet');expect(plan).toHaveLength(3);
      for(const step of plan){const key=step.role==='primary'?a:b;if(!['buddy-look','nuzzle'].includes(step.action))expect(PET_PROFILES[key].idles).toContain(step.action);}
    }
    expect(buddyGreeting('byte')).toBe('paw-wave');expect(buddyGreeting('nimbus')).toBe('wing-stretch');
    expect(buddyPlan('unknown','cat')).toEqual([]);
  });
  it('staggers a greeting and cancels pending replies when care begins',()=>{
    const {engine,onCue}=setup();engine.greet();expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({action:'buddy-look',source:'touch'}));
    vi.advanceTimersByTime(100);engine.update({reaction:'pet',reactionId:1});vi.advanceTimersByTime(700);
    expect(onCue.mock.calls.filter(([,c])=>c?.action==='wing-stretch')).toHaveLength(0);
    expect(onCue).toHaveBeenLastCalledWith('buddy',expect.objectContaining({action:'buddy-look',source:'buddy'}));
    expect(engine.greet()).toBe(false);engine.stop();expect(vi.getTimerCount()).toBe(0);
  });
  it('coordinates a shared celebration with a delayed response',()=>{
    const {onCue}=setup('celebrating');expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({action:'celebrate',source:'celebration'}));
    vi.advanceTimersByTime(219);expect(onCue).toHaveBeenCalledTimes(1);vi.advanceTimersByTime(1);
    expect(onCue).toHaveBeenLastCalledWith('buddy',expect.objectContaining({action:'celebrate',source:'celebration'}));
  });
  it('suppresses spontaneous social gestures in quiet contexts and with signatures off',()=>{
    for(const mood of ['focused','rooting','sleepy','tired','cozy']){
      const {engine,onCue}=setup(mood);expect(vi.getTimerCount()).toBe(0);engine.greet();vi.advanceTimersByTime(400);
      expect(onCue.mock.calls.every(([,c])=>!c || c.action==='buddy-look')).toBe(true);engine.stop();
    }
    const {engine,onCue}=setup('content',false);expect(vi.getTimerCount()).toBe(0);expect(engine.greet()).toBe(true);
    expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({source:'touch'}));
  });
  it('discards stale cues on suspension and resumes with a fresh gap',()=>{
    const {engine,onCue}=setup();engine.greet();engine.update({enabled:false});const calls=onCue.mock.calls.length;
    vi.advanceTimersByTime(120000);expect(onCue).toHaveBeenCalledTimes(calls);expect(vi.getTimerCount()).toBe(0);
    engine.update({enabled:true});vi.advanceTimersByTime(31999);expect(onCue).toHaveBeenCalledTimes(calls);
    vi.advanceTimersByTime(1);expect(onCue).toHaveBeenLastCalledWith('primary',expect.objectContaining({source:'buddy'}));
  });
  it('keeps care and class context above buddy cues inside each pet director',()=>{
    vi.useFakeTimers();const onChange=vi.fn();const pet=createPetDirector({petKey:'cat',onChange});
    pet.update({enabled:true,mood:'focused'});expect(pet.social({action:'buddy-look',source:'buddy'})).toBe(false);
    pet.update({reaction:'treat'});expect(pet.social({action:'celebrate',source:'celebration'})).toBe(false);
    pet.stop();expect(vi.getTimerCount()).toBe(0);
  });
  it('lets the pair coordinator own celebrations rather than starting both immediately',()=>{
    vi.useFakeTimers();const onChange=vi.fn();const pet=createPetDirector({petKey:'cat',onChange});
    pet.update({enabled:true,mood:'celebrating',paired:true});expect(onChange).not.toHaveBeenCalled();
    expect(pet.social({action:'celebrate',source:'celebration'})).toBe(true);pet.stop();
  });
});
