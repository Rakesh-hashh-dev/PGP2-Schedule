// Store for the collapsed sidebar's floating label (rendered by
// components/SbFloatTip.jsx). Kept outside App state: hovering down the icon
// rail used to re-render the whole app on every enter and leave.
import { useSyncExternalStore } from "react";

let tip = null;
const listeners = new Set();
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => tip;

export function setSbFloatTip(next) {
  if (next === tip) return;
  tip = next;
  listeners.forEach(l => l());
}

export function useSbFloatTip() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
