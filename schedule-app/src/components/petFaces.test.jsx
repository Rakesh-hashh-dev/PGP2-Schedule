import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PETS } from './greetingPets.jsx';
import { PET_FACES } from '../lib/petFaces.js';

describe('personality faces across the saved roster', () => {
  it('covers every companion without a generic fallback', () => {
    expect(Object.keys(PET_FACES).sort()).toEqual(PETS.map(pet => pet.key).sort());
    expect(new Set(Object.values(PET_FACES).map(face => face.shape)).size).toBeGreaterThan(4);
  });

  for (const pet of PETS) {
    it(`${pet.key} uses its personality for eyes and expressions, with isolated gaze masks`, () => {
      // Repeated instances share a page in greetings, collections and wardrobes.
      const markup = renderToStaticMarkup(<><pet.Svg /><pet.Svg /></>);
      expect(markup.match(new RegExp(`data-eye-personality="${pet.key}"`, 'g'))).toHaveLength(2);
      expect(markup.match(new RegExp(`data-face-personality="${pet.key}"`, 'g'))).toHaveLength(2);
      const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
      expect(new Set(ids).size).toBe(ids.length);
      const clips = [...markup.matchAll(/clip-path="url\(#([^)]*)\)"/g)].map(match => match[1]);
      expect(clips.filter(clip => clip.startsWith('eyes'))).toHaveLength(4);
      for (const clip of clips) expect(ids).toContain(clip);
      expect(markup).not.toMatch(/NaN|undefined|<image/);
    });
  }
});
