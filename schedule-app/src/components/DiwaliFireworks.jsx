import { useEffect, useRef } from 'react';
import { advanceFireworks, fireworkBurst, MAX_FIREWORK_PARTICLES } from '../lib/fireworks.js';
export default function DiwaliFireworks({ enabled, motion = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!enabled || !motion || !ref.current) return;
    const canvas = ref.current;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let particles = [], frame = 0, timer = 0, previous = 0, width = 0, height = 0;
    const resize = () => {
      width = window.innerWidth; height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = stamp => {
      frame = 0;
      if (document.hidden || reduced.matches) return;
      const interval = width < 600 ? 1000 / 18 : 1000 / 24;
      if (previous && stamp - previous < interval) { frame = requestAnimationFrame(draw); return; }
      const elapsed = previous ? (stamp - previous) / 1000 : 1 / 24; previous = stamp;
      particles = advanceFireworks(particles, elapsed);
      context.clearRect(0, 0, width, height);
      for (const p of particles) {
        context.strokeStyle = `rgba(${p.color},${.48 * (1 - p.age / p.life)})`;
        context.lineWidth = 1.3; context.beginPath(); context.moveTo(p.x, p.y);
        context.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); context.stroke();
      }
      if (particles.length) frame = requestAnimationFrame(draw);
      else previous = 0; // No animation loop while the sky is empty.
    };
    const burst = () => {
      if (document.hidden || reduced.matches) return;
      particles = [...particles, ...fireworkBurst(width, height, width < 600)].slice(-MAX_FIREWORK_PARTICLES);
      if (!frame) frame = requestAnimationFrame(draw);
      timer = window.setTimeout(burst, width < 600 ? 6500 : 4800);
    };
    const stop = () => { clearTimeout(timer); cancelAnimationFrame(frame); timer = 0; frame = 0; particles = []; previous = 0; context.clearRect(0, 0, width, height); canvas.hidden = true; };
    const sync = () => { stop(); if (!document.hidden && !reduced.matches) { resize(); canvas.hidden = false; timer = window.setTimeout(burst, 1000); } };
    document.addEventListener('visibilitychange', sync); reduced.addEventListener('change', sync); window.addEventListener('resize', resize); sync();
    return () => { stop(); document.removeEventListener('visibilitychange', sync); reduced.removeEventListener('change', sync); window.removeEventListener('resize', resize); };
  }, [enabled, motion]);
  return enabled && motion ? <canvas ref={ref} className="diwali-fireworks" aria-hidden="true" /> : null;
}
