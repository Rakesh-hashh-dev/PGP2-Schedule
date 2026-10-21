import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACTION_MS, contextAction, createPetDirector, idlePool } from './petDirector.js';
afterEach(() => vi.useRealTimers());
function setup(petKey = 'fox', mood = 'content') {
  vi.useFakeTimers();
  const onChange = vi.fn();
  const director = createPetDirector({ petKey, onChange, random: () => 0 });
  director.update({ enabled: true, mood });
  return { director, onChange };
}
describe('companion animation director', () => {
  it('care interrupts celebration; touch and context cannot replace care', () => {
    const { director, onChange } = setup('ember', 'celebrating');
    expect(onChange).toHaveBeenLastCalledWith({ action: 'celebrate', source: 'celebration' });
    expect(director.touch('wing')).toBe(false);
    director.update({ reaction: 'treat' });
    expect(director.touch('head')).toBe(false);
    director.update({ mood: 'focused' });
    expect(onChange).toHaveBeenLastCalledWith({ action: 'treat', source: 'care' });
    vi.advanceTimersByTime(ACTION_MS);
    expect(onChange).toHaveBeenLastCalledWith({ action: '', source: 'idle' });
    expect(vi.getTimerCount()).toBe(0); // care is latched; no competing idle
  });
  it('completes recovery even when the greeting clears feedback early', () => {
    const { director, onChange } = setup();
    director.update({ reaction: 'pet' });
    vi.advanceTimersByTime(1150);
    director.update({ reaction: null });
    expect(onChange).toHaveBeenLastCalledWith({ action: 'pet', source: 'care' });
    vi.advanceTimersByTime(ACTION_MS - 1150);
    expect(onChange).toHaveBeenLastCalledWith({ action: '', source: 'idle' });
    expect(vi.getTimerCount()).toBe(1);
  });
  it('restarts repeated care from the latest interaction token', () => {
    const { director, onChange } = setup();
    director.update({ reaction: 'play', reactionId: 1 });
    vi.advanceTimersByTime(900);
    director.update({ reaction: 'play', reactionId: 2 });
    vi.advanceTimersByTime(1000);
    expect(onChange).toHaveBeenLastCalledWith({ action: 'play', source: 'care' });
    vi.advanceTimersByTime(800);
    expect(onChange).toHaveBeenLastCalledWith({ action: '', source: 'idle' });
  });
  it('uses a fresh idle gap, avoids repeats and cancels all timers on suspension', () => {
    const { director, onChange } = setup();
    vi.advanceTimersByTime(18000);
    expect(onChange).toHaveBeenLastCalledWith({ action: 'listen', source: 'idle' });
    vi.advanceTimersByTime(ACTION_MS + 18000);
    expect(onChange).toHaveBeenLastCalledWith({ action: 'tail-swish', source: 'idle' });
    director.stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(120000);
    expect(onChange).toHaveBeenLastCalledWith({ action: '', source: 'idle' });
    director.update({ enabled: true });
    expect(vi.getTimerCount()).toBe(1);
  });
  it('touch interrupts idle and targets the body part without queuing the old action', () => {
    const { director, onChange } = setup('ember');
    vi.advanceTimersByTime(18000);
    expect(director.touch('wing')).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith({ action: 'wing-stretch', source: 'touch' });
    vi.advanceTimersByTime(ACTION_MS);
    expect(vi.getTimerCount()).toBe(1);
    expect(director.touch('tail')).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith({ action: 'tail-swish', source: 'touch' });
  });
  it('keeps care and touch responsive with spontaneous actions switched off', () => {
    const { director, onChange } = setup();
    director.update({ autonomous: false, mood: 'celebrating' });
    expect(vi.getTimerCount()).toBe(0);
    expect(director.touch()).toBe(true);
    director.update({ reaction: 'pet' });
    expect(onChange).toHaveBeenLastCalledWith({ action: 'pet', source: 'care' });
    director.update({ enabled: false });
    expect(director.touch()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('uses species-specific quiet-safe actions for class, rest and exam context', () => {
    for (const key of ['fox', 'mochi', 'ember', 'nimbus']) {
      for (const mood of ['focused', 'rooting', 'sleepy', 'tired']) {
        expect(idlePool(key, mood).length).toBeGreaterThan(0);
        expect(idlePool(key, mood)).not.toContain('wing-stretch');
        expect(idlePool(key, mood)).not.toContain('tail-swish');
      }
    }
    expect(contextAction('focused')).toEqual({ action: 'listen', source: 'context' });
    expect(contextAction('celebrating')).toEqual({ action: 'celebrate', source: 'celebration' });
  });
});
