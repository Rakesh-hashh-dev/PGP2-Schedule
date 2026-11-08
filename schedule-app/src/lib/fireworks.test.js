import { expect, it } from 'vitest';
import { advanceFireworks, fireworkBurst, MAX_FIREWORK_PARTICLES } from './fireworks.js';
it('uses smaller bursts on phones and keeps their origin outside the reading column', () => {
  for (const compact of [true, false]) {
    const burst = fireworkBurst(390, 800, compact, () => .25);
    expect(burst).toHaveLength(compact ? 16 : 26);
    expect(burst.every(p => p.x < 390 * .18 && p.y < 800 * .45)).toBe(true);
  }
});
it('bounds particles, clamps elapsed time after pauses, and removes expired particles', () => {
  const burst = fireworkBurst(1200, 900, false, () => .5);
  const particles = advanceFireworks([...burst, ...burst, ...burst], 500);
  expect(particles.length).toBeLessThanOrEqual(MAX_FIREWORK_PARTICLES);
  expect(particles.every(p => p.age <= .08)).toBe(true);
  expect(advanceFireworks([{ ...burst[0], age: 2 }], .05)).toEqual([]);
});
