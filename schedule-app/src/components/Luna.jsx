import { useEffect, useState } from "react";
import assets from "../lib/lunaAssets.json";

// CSS selects the sprite state using the existing mood/beat/reaction attributes.
// Sprite strips are pausable; no self-playing GIF survives motion-off settings.
export default function Luna() {
  const [paused, setPaused] = useState(() => typeof document !== "undefined" && document.hidden);
  useEffect(() => {
    const sync = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return <svg className="luna-art" viewBox="0 0 32 32" aria-hidden="true" data-paused={paused || undefined}>
    <svg className="luna-viewport" viewBox={`0 0 ${assets.width} ${assets.height}`} width="32" height="32">
      <image className="luna-still" href="/pets/luna/still.webp" width={assets.width} height={assets.height} />
      {Object.entries(assets.states).map(([key, state]) => <g className={`luna-state luna-state-${key}`} key={key}>
        <image className="luna-strip" href={state.file} width={assets.width * state.frames} height={assets.height}
          style={{ "--luna-duration": `${state.durationMs}ms`, "--luna-steps": state.frames, "--luna-distance": `${-assets.width * state.frames}px` }} />
      </g>)}
    </svg>
  </svg>;
}
