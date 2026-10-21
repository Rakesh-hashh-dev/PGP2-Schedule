import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PETS } from './greetingPets.jsx';
import PetHat from './PetHat.jsx';
import PetNeckwear from './PetNeckwear.jsx';
import { PET_PROFILES } from '../lib/petProfiles.js';
import { RIGGED_PETS, idlePool, createPetDirector, ACTION_MS } from '../lib/petDirector.js';
afterEach(() => vi.useRealTimers());
const TARGETS = { 'tail-swish': 'pet-rig-tail', 'wing-stretch': 'pet-rig-wing', 'paw-wave': /dg-pet-paw|pet-rig-wing/, groom: 'dg-pet-paw', scan: 'dg-pet-pupils', 'gill-ripple': 'dg-pet-ear', unfurl: 'dg-pet-vine-leaf' };
describe('full companion movement integration', () => {
  it('covers the complete persisted roster exactly, with no pilot-only fallback', () => {
    expect([...RIGGED_PETS].sort()).toEqual(PETS.map(p => p.key).sort());
    expect(Object.keys(PET_PROFILES)).toHaveLength(32);
  });
  for (const pet of PETS) {
    it(`${pet.key} has an attached head, frame, growth details and supported species actions`, () => {
      const html = renderToStaticMarkup(<pet.Svg />);
      expect(html).toMatch(/class="[^"]*pet-art\b[^"]*pet-rig\b/);
      expect(html).toContain('pet-rig-frame');
      expect(html).toContain('pet-rig-head');
      expect(html).toContain('pet-growth-detail');
      expect(html).toContain('dg-pet-pupils');
      expect(PET_PROFILES[pet.key].idles).toHaveLength(4);
      for (const action of PET_PROFILES[pet.key].idles) {
        const target = TARGETS[action];
        if (target instanceof RegExp) expect(html).toMatch(target);
        else if (target) expect(html).toContain(target);
      }
      for (const mood of ['focused', 'sleepy', 'tired', 'rooting']) {
        expect(idlePool(pet.key,mood).length).toBeGreaterThan(0);
        expect(idlePool(pet.key,mood)).not.toContain('hop');
        expect(idlePool(pet.key,mood)).not.toContain('howl');
      }
    });
    it(`${pet.key} gives care priority and cancels its engine cleanly`, () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      const director = createPetDirector({ petKey: pet.key, onChange, random: () => 0 });
      director.update({ enabled: true, mood: 'content' });
      vi.advanceTimersByTime(18000);
      expect(onChange).toHaveBeenLastCalledWith({ action: PET_PROFILES[pet.key].idles[0], source: 'idle' });
      director.update({ reaction: 'treat' });
      expect(director.touch('head')).toBe(false);
      vi.advanceTimersByTime(ACTION_MS);
      expect(onChange).toHaveBeenLastCalledWith({ action: '', source: 'idle' });
      director.stop();expect(vi.getTimerCount()).toBe(0);
    });
  }
  it('attaches hats to both the body frame and head; neckwear follows the body frame', () => {
    const hat=renderToStaticMarkup(<PetHat hat="crown" />);
    const neck=renderToStaticMarkup(<PetNeckwear neck="scarf" />);
    expect(hat).toContain('pet-rig-frame');expect(hat).toContain('pet-rig-head');expect(neck).toContain('pet-rig-frame');
  });
});
