import { useCallback, useRef, useState } from "react";

/**
 * Eyes that follow the pointer.
 *
 * The cheapest perceived-intelligence win in the whole feature: two custom
 * properties, and the animal stops being a looping sprite and starts looking
 * like it noticed you. On touch there is no hover, so a tap counts — the pet
 * glances at wherever you last touched it before the tray opens.
 *
 * Returns props to spread onto the `.dg-pet` element. The offsets are in SVG
 * user units (the viewBox is 32 wide), not pixels, so one hook serves the
 * 40px greeting and the 116px hero without scaling anything.
 */
const REACH = 0.85;

export function usePetGaze(enabled = true) {
  const [look, setLook] = useState(null);
  const frame = useRef(0);

  const track = useCallback(event => {
    if (!enabled) return;
    // Pointer events fire far faster than paint; coalesce to one per frame.
    if (frame.current) return;
    const { clientX, clientY, currentTarget } = event;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const box = currentTarget?.getBoundingClientRect?.();
      if (!box || !box.width) return;
      // -1..1 from the centre, clamped so a pointer way off to the side does
      // not push the pupils clean out of the head.
      const dx = Math.max(-1, Math.min(1, (clientX - (box.left + box.width / 2)) / (box.width / 2)));
      const dy = Math.max(-1, Math.min(1, (clientY - (box.top + box.height / 2)) / (box.height / 2)));
      setLook({ x: dx * REACH, y: dy * REACH * 0.7 });
    });
  }, [enabled]);

  const release = useCallback(() => {
    if (frame.current) { cancelAnimationFrame(frame.current); frame.current = 0; }
    setLook(null);
  }, []);

  if (!enabled) return {};
  return {
    onPointerMove: track,
    onPointerDown: track,
    onPointerLeave: release,
    onPointerCancel: release,
    style: look ? { "--pet-look-x": `${look.x}px`, "--pet-look-y": `${look.y}px` } : undefined,
  };
}
