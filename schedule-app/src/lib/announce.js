// One persistent, visually hidden live region for screen-reader announcements.
// Toasts that mount together with their own role="status" are often missed
// (the region has to exist before its text changes), so transient UI calls
// announce(text) instead and this region — created once, never removed —
// speaks it.

let region = null;
let clearTimer = null;

function ensureRegion() {
  if (region?.isConnected) return region;
  if (typeof document === "undefined") return null;
  region = document.createElement("div");
  region.className = "sr-only";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  document.body.appendChild(region);
  return region;
}

export function announce(text) {
  const el = ensureRegion();
  if (!el || !text) return;
  // Clear first so repeating the same message is still announced.
  el.textContent = "";
  clearTimeout(clearTimer);
  setTimeout(() => { el.textContent = text; }, 60);
  clearTimer = setTimeout(() => { el.textContent = ""; }, 7000);
}

// Create the region early so it is already in the a11y tree when the first
// message arrives.
if (typeof document !== "undefined") {
  if (document.body) ensureRegion();
  else document.addEventListener("DOMContentLoaded", ensureRegion, { once: true });
}
