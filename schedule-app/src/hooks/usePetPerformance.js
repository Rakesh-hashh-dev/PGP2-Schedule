import { useEffect, useRef, useState } from 'react';
import { createPetDirector, RIGGED_PETS } from '../lib/petDirector.js';
import { usePetBeat } from './usePetBeat.js';

export function usePetPerformance(mood, enabled, petKey, reaction, signatures = true, reactionId = 0) {
  const rigged = RIGGED_PETS.has(petKey);
  const beat = usePetBeat(mood, enabled && signatures && !rigged, petKey, reaction);
  const [pose, setPose] = useState({ action: '', source: 'idle', petKey });
  const director = useRef(null);
  const sequence = useRef(0);
  const inputs = useRef({ mood, reaction, reactionId, autonomous: signatures });
  useEffect(() => { inputs.current = { mood, reaction, reactionId, autonomous: signatures }; }, [mood, reaction, signatures, reactionId]);
  useEffect(() => {
    if (!rigged || !enabled) return undefined;
    const engine = createPetDirector({ petKey, onChange: next => setPose({ ...next, petKey, replay: sequence.current++ % 2 ? 'b' : 'a' }) });
    director.current = engine;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const sync = () => engine.update({ ...inputs.current, enabled: !document.hidden && !media?.matches });
    document.addEventListener('visibilitychange', sync);
    media?.addEventListener?.('change', sync);
    sync();
    return () => {
      director.current = null;
      engine.stop();
      document.removeEventListener('visibilitychange', sync);
      media?.removeEventListener?.('change', sync);
    };
  }, [rigged, enabled, petKey]);
  useEffect(() => { director.current?.update({ mood, reaction, reactionId, autonomous: signatures }); }, [mood, reaction, signatures, reactionId]);
  const action = rigged && enabled && pose.petKey === petKey ? pose.action : '';
  return {
    beat,
    action: action || undefined,
    source: action ? pose.source : undefined,
    replay: action ? pose.replay : undefined,
    touch(event) {
      if (!rigged || !enabled || event.button > 0) return;
      const part = event.target?.closest?.('[data-pet-part], [data-part]')?.dataset.petPart || event.target?.closest?.('[data-pet-part], [data-part]')?.dataset.part || 'head';
      director.current?.touch(part);
    },
    gesture(action) { return director.current?.gesture(action) || false; },
    greet() { if (rigged && enabled) director.current?.touch('head'); },
  };
}
