import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PETS } from './greetingPets.jsx';

describe('companion artwork integration', () => {
  it('preserves the persisted daily-selection order and identity keys', () => {
    expect(PETS.map(p => p.key)).toEqual(['cat', 'fox', 'dog', 'bunny', 'penguin', 'panda', 'chick', 'koala', 'otter', 'rover', 'raccoon', 'axolotl', 'spark', 'leafy', 'cinder', 'hoot', 'byte', 'pebble', 'prickle', 'luna', 'frost', 'unicorn', 'dragon', 'hamster', 'sloth', 'capy', 'maple', 'ember', 'mochi', 'nimbus', 'sable', 'inky']);
  });

  it('keeps repeated companions independent with resolvable paint and clip references', () => {
    const html = renderToStaticMarkup(<div>{PETS.flatMap(p => [<p.Svg key={p.key + '-greeting'} />, <p.Svg key={p.key + '-hero'} />])}</div>);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    expect(ids.length).toBeGreaterThan(30);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, reference] of html.matchAll(/url\(#([^)]*)\)/g)) expect(ids, reference).toContain(reference);
  });

  it('moves each vector face, eyes and expressions with its attached head', () => {
    for (const pet of PETS.filter(p => p.art !== 'sprite')) {
      const html = renderToStaticMarkup(<pet.Svg />);
      const parents = [];
      let eyes = false;
      let expression = false;
      for (const [token] of html.matchAll(/<g\b[^>]*>|<\/g>/g)) {
        if (token === '</g>') parents.pop();
        else {
          const cls = /class="([^"]+)"/.exec(token)?.[1]?.split(' ') || [];
          if (cls.includes('dg-pet-eyes')) {
            expect(parents.some(p => p.includes('dg-pet-head')), pet.key + ' eyes detached').toBe(true);
            eyes = true;
          }
          if (cls.includes('dg-pet-expression')) {
            expect(parents.some(p => p.includes('dg-pet-head')), pet.key + ' expression detached').toBe(true);
            expression = true;
          }
          if (cls.includes('dg-pet-antenna')) expect(parents.some(p => p.includes('dg-pet-head')), pet.key + ' antenna detached').toBe(true);
          parents.push(cls);
        }
      }
      expect(eyes && expression, pet.key + ' missing an expressive face').toBe(true);
    }
  });
});
