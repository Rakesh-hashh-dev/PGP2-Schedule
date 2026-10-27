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

// Views a `?view=` URL may open. The address bar mirrors the current view, so
// a refresh, a shared link or a new tab lands on the same page.
export const URL_VIEWS = new Set([
  "today", "tomorrow", "week", "attendance", "exams", "assignments", "pet",
  "notifications", "friends", "leave", "glance", "board", "split", "planner", "courseHub", "fullSchedule",
]);

// Params that belong to one view's page (Course Hub's open course), dropped
// whenever the URL moves to a different page.
const VIEW_PARAMS = ["course", "post"];

// The current URL with `view` (and that page's own params) set — every other
// param, and the hash, kept.
export function urlWithView(view, params = {}) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  VIEW_PARAMS.forEach(key => url.searchParams.delete(key));
  Object.entries(params).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
  return `${url.pathname}${url.search}${url.hash}`;
}

// Re-tapping the active nav item scrolls its page back to the top.
export function scrollViewToTop() {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

// Campus Board post from a launch URL (?view=board&post=<id>, e.g. an
// "I'm interested" push). Captured at load because App normalises the URL on
// mount, before the lazy board page exists to read it. Handed out once.
let initialBoardPost = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("view") === "board" ? params.get("post") : null;
  } catch { return null; }
})();

export function takeInitialBoardPost() {
  const id = initialBoardPost;
  initialBoardPost = null;
  return id;
}
