// Pauses pet animations while the pet is scrolled out of view.
//
// Each pet runs a dozen endless loops, most of them on parts inside its SVG,
// which the browser can't hand to the compositor — so they keep costing style
// and paint work every frame even when nobody can see them. Pets are rendered
// from many places (greeting, cameo, pet page, admin previews), so instead of
// wiring each one this watches the DOM for `.dg-pet` and flags off-screen ones
// with `data-offscreen`; styles.css pauses everything under that attribute.
// React never sets that attribute, so it is never clobbered on re-render.

let started = false;

export function startPetMotionWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;

  const syncVisibility = () => document.documentElement.toggleAttribute("data-pets-paused", document.hidden);
  document.addEventListener("visibilitychange", syncVisibility);
  syncVisibility();
  if (!("IntersectionObserver" in window)) return;

  const watched = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      // A pet unmounted while visible reports once as not intersecting —
      // release it. (One unmounted while already off-screen stays observed;
      // a handful of 40px nodes, so not worth a sweep.)
      if (!e.target.isConnected) { io.unobserve(e.target); continue; }
      e.target.toggleAttribute("data-offscreen", !e.isIntersecting);
    }
  }, { rootMargin: "64px" });

  let scheduled = false;
  const scan = () => {
    scheduled = false;
    for (const el of document.querySelectorAll(".dg-pet")) {
      if (watched.has(el)) continue;
      watched.add(el);
      io.observe(el);
    }
  };
  // DOM mutations come in bursts during a render; batch the scan to one per
  // idle period.
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    if (window.requestIdleCallback) window.requestIdleCallback(scan, { timeout: 500 });
    else setTimeout(scan, 200);
  };
  new MutationObserver(records => {
    // Release detached subtrees as well as pets that leave the viewport.
    for (const record of records) for (const node of record.removedNodes) {
      if (node.nodeType !== 1 || node.isConnected) continue;
      const pets = [...node.querySelectorAll(".dg-pet")];
      if (node.matches(".dg-pet")) pets.push(node);
      for (const pet of pets) { io.unobserve(pet); watched.delete(pet); }
    }
    schedule();
  }).observe(document.body, { childList: true, subtree: true });
  scan();
}
