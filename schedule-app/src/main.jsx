import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import "./styles/freeday.css";
import "./styles/motion-details.css";
import "./styles/premium-polish.css";
import { registerSW } from "virtual:pwa-register";
import StartupGreeting from "./components/StartupGreeting.jsx";
import { initSentry } from "./lib/sentry.js";

initSentry();

// Start fetching ClerkApp immediately so LCP isn't delayed by the lazy boundary
const clerkAppPromise = import("./ClerkApp.jsx");
const ClerkApp = lazy(() => clerkAppPromise);

// registerSW returns the update fn — onNeedRefresh receives no arguments
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.__swPendingUpdate = updateSW;
    window.dispatchEvent(new CustomEvent("sw-update-available", { detail: { updateSW } }));
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
    ? <Suspense fallback={null}><PetMoodSheet /></Suspense>
    : (
      <React.StrictMode>
        <Suspense fallback={<StartupGreeting />}>
          <ClerkApp />
        </Suspense>
      </React.StrictMode>
    )
);
