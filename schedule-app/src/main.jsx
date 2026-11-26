import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import "./styles/pet-personality.css";
import "./styles/luna.css";
import "./styles/pet-art.css";
import "./styles/pet-rig.css";
import "./styles/pet-finish.css";
import "./styles/pet-sleep.css";
import "./styles/freeday.css";
import "./styles/motion-details.css";
import "./styles/premium-polish.css";
import "./styles/modal-layout.css";
import { registerSW } from "virtual:pwa-register";
import StartupGreeting from "./components/StartupGreeting.jsx";
import PetFinishDefs from "./components/PetFinishDefs.jsx";
import RootErrorBoundary from "./components/RootErrorBoundary.jsx";
import { initSentry } from "./lib/sentry.js";

initSentry();

// Retry helper for dynamic imports to survive momentary network glitches or chunk transitions
function loadWithRetry(importFn, retries = 2, delay = 800) {
  return new Promise((resolve, reject) => {
    importFn()
      .then(resolve)
      .catch((error) => {
        if (retries > 0) {
          setTimeout(() => {
            loadWithRetry(importFn, retries - 1, delay * 1.5).then(resolve, reject);
          }, delay);
        } else {
          reject(error);
        }
      });
  });
}

// Start fetching ClerkApp immediately so LCP isn't delayed by the lazy boundary
const clerkAppPromise = loadWithRetry(() => import("./ClerkApp.jsx"));
const ClerkApp = lazy(() => clerkAppPromise);

// registerSW returns the update fn — onNeedRefresh receives no arguments
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.__swPendingUpdate = updateSW;
    window.dispatchEvent(new CustomEvent("sw-update-available", { detail: { updateSW } }));

    // Fallback: If React hasn't mounted within 4 seconds (e.g. bundle crash or stuck import),
    // automatically apply the waiting Service Worker to recover rather than staying blank.
    setTimeout(() => {
      if (!window.__reactDidMount) {
        console.warn("[SW] App unmounted during update detection; applying waiting SW.");
        updateSW(true);
      }
    }, 4000);
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    // update() fetches sw.js and REJECTS on any network hiccup (offline,
    // flaky Wi-Fi, tab waking) — swallow it, the next check retries anyway.
    const checkForUpdate = () => registration.update().catch(() => {});
    // Force an immediate check for a new SW, then recheck every 60 s
    checkForUpdate();
    setInterval(checkForUpdate, 60_000);
    // Also recheck when the user switches back to this tab
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });
  },
});

// Chrome/Edge/Android suppress their native install UI by default once we
// call preventDefault — we stash the event and let App.jsx trigger it later
// from a custom banner instead.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__pwaInstallPrompt = e;
  window.dispatchEvent(new CustomEvent("pwa-install-available"));
});

window.addEventListener("appinstalled", () => {
  window.__pwaInstallPrompt = null;
  window.dispatchEvent(new CustomEvent("pwa-installed"));
});

const root = ReactDOM.createRoot(document.getElementById("root"));

// Dev-only pet mood contact sheet (`?moodsheet`). The whole component is
// behind `import.meta.env.DEV`, so it is tree-shaken out of a real build —
// and it renders instead of the app, with no Clerk and no service worker in
// the way, because all it needs is styles.css.
const showMoodSheet = import.meta.env.DEV && new URLSearchParams(location.search).has("moodsheet");
const PetMoodSheet = lazy(() => import("./components/PetMoodSheet.jsx"));

root.render(
  showMoodSheet
    ? <Suspense fallback={null}><PetFinishDefs /><PetMoodSheet /></Suspense>
    : (
      <React.StrictMode>
        <RootErrorBoundary>
          <PetFinishDefs />
          <Suspense fallback={<StartupGreeting />}>
            <ClerkApp />
          </Suspense>
        </RootErrorBoundary>
      </React.StrictMode>
    )
);

window.__reactDidMount = true;
