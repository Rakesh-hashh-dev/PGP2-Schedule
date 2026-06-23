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
