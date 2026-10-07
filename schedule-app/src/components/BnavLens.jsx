import { useState, useLayoutEffect, useEffect, useRef } from "react";
import { useNavView } from "../lib/navView.js";
import { haptic } from "../lib/haptics.js";

function placeLens(btn, setLens) {
  // A hidden dock (desktop) measures 0 — keep the last position.
  if (!btn || !btn.offsetWidth) return;
  const x = btn.offsetLeft, w = btn.offsetWidth;
  setLens(prev => (prev && prev.x === x && prev.w === w ? prev : { x, w }));
}

const activeButton = (lensEl) => lensEl?.parentElement?.querySelector(".bnav-btn.on");

// Sliding lens under the active bottom-dock button. Owns its own state and
// listens to the dock's pointer events itself: as App state, every tap
// re-rendered the whole app before the click even landed.
export default function BnavLens() {
  const ref = useRef(null);
  const [lens, setLens] = useState(null); // { x, w } px, or null until measured
  const navView = useNavView();

  // View changed: glide to the new active button.
  useLayoutEffect(() => { placeLens(activeButton(ref.current), setLens); }, [navView]);

  useEffect(() => {
    const lensEl = ref.current;
    const nav = lensEl?.parentElement;
    if (!nav) return;
    const remeasure = () => placeLens(activeButton(lensEl), setLens);
    // Instagram-dock feel: start the glide on touch-down, before the click
    // renders the new view. The transform transition runs on the compositor.
    const onDown = (e) => {
      const btn = e.target.closest?.(".bnav-btn");
      if (btn) { placeLens(btn, setLens); haptic(10); }
    };
    // A press that never becomes a click (finger slid off) snaps back.
    const onUp = () => setTimeout(remeasure, 0);
    nav.addEventListener("pointerdown", onDown);
    nav.addEventListener("pointerup", onUp);
    nav.addEventListener("pointercancel", onUp);
    // Resizes, orientation changes and buttons appearing/disappearing (feature
    // flags) all move the active button. Observers fire after layout, so
    // unlike a measure-on-every-render they never force a synchronous reflow.
    const ro = new ResizeObserver(remeasure);
    ro.observe(nav);
    const mo = new MutationObserver(remeasure);
    mo.observe(nav, { childList: true });
    return () => {
      nav.removeEventListener("pointerdown", onDown);
      nav.removeEventListener("pointerup", onUp);
      nav.removeEventListener("pointercancel", onUp);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <span
      ref={ref}
      className="bnav-lens"
      aria-hidden="true"
      style={lens ? { transform: `translateX(${lens.x}px)`, width: lens.w } : { display: "none" }}
    />
  );
}
