export const MAX_FIREWORK_PARTICLES = 48;
const COLORS = ['232,185,109', '205,128,165', '181,157,224'];
export function fireworkBurst(width, height, compact, random = Math.random) {
  const count = compact ? 16 : 26;
  // Keep bursts near the margins, away from the main reading column.
  const x = width * (random() < .5 ? .04 + random() * .13 : .83 + random() * .13);
  const y = height * (.12 + random() * .32);
  const color = COLORS[Math.floor(random() * COLORS.length) % COLORS.length];
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    const speed = 24 + random() * (compact ? 30 : 48);
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.2 + random() * .5, age: 0, color };
  });
}
export function advanceFireworks(particles, seconds) {
  const delta = Math.min(.08, Math.max(0, seconds));
  return particles.slice(0, MAX_FIREWORK_PARTICLES).map(p => ({ ...p, x: p.x + p.vx * delta, y: p.y + p.vy * delta, vy: p.vy + 12 * delta, age: p.age + delta })).filter(p => p.age < p.life);
}
