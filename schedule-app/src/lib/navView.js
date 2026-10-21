// The view the navigation should highlight, kept outside React state.
//
// App renders a new view inside startTransition so a heavy page (Full
// timetable, Today) never freezes the screen. That also means App's `view`
// only updates once the new page has finished rendering. Nav buttons read
// this store instead, so the highlight moves on the click itself — and only
// the subscribed buttons re-render, not the whole App tree.
import { useSyncExternalStore } from "react";

let current = null;
const listeners = new Set();

export function setNavView(view) {
  if (view === current) return;
  current = view;
  listeners.forEach(l => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => current;

export function useNavView() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
