import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { blendPetPose, capturePetPose } from '../lib/petTransitions.js';
export function usePetTransitions(action, replay, enabled) {
  const ref = useRef(null);
  const pending = useRef([]);
  const blends = useRef([]);
  const cancel = useCallback(() => {
    for (const animation of blends.current) animation.cancel();
    blends.current = [];
  }, []);
  const canMove = useCallback(() => enabled && !document.hidden && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches && ref.current?.dataset.motion !== 'off', [enabled]);
  const prepare = useCallback(() => {
    pending.current = canMove() ? capturePetPose(ref.current) : [];
  }, [canMove]);
  useLayoutEffect(() => {
    cancel();
    if (canMove()) blends.current = blendPetPose(ref.current, pending.current);
    pending.current = [];
  }, [action, replay, enabled, canMove, cancel]);
  useEffect(() => cancel, [cancel]);
  const attach = useCallback(node => { ref.current = node; }, []);
  return { attach, prepare };
}
