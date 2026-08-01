import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { registerSW } from "virtual:pwa-register";
import TermFlowLoader from "./components/TermFlowLoader.jsx";
import { initSentry } from "./lib/sentry.js";
import { IS_LITE } from "./lib/edition.js";

initSentry();

// Both editions share index.html; brand the tab title for lite at runtime.
if (IS_LITE) document.title = "TermFlow Lite | IIM Sambalpur PGP2";

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

root.render(
  <React.StrictMode>
    <Suspense fallback={
      <main className="loading-screen">
        <TermFlowLoader variant="splash" size={96} />
        <p className="loading-label">Starting up…</p>
      </main>
    }>
      <ClerkApp />
    </Suspense>
  </React.StrictMode>
);
