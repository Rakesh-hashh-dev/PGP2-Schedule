import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { registerSW } from "virtual:pwa-register";
import TermFlowLoader from "./components/TermFlowLoader.jsx";

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
    // Force an immediate check for a new SW, then recheck every 60 s
    registration.update();
    setInterval(() => registration.update(), 60_000);
    // Also recheck when the user switches back to this tab
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update();
    });
  },
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
