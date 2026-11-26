import { Component } from "react";

export class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isChunkError: false,
      autoReloading: false,
    };
  }

  static getDerivedStateFromError(error) {
    const msg = error?.message || String(error || "");
    const isChunk =
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module") ||
      msg.includes("Loading chunk") ||
      error?.name === "ChunkLoadError";

    return { hasError: true, error, isChunkError: isChunk };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[RootErrorBoundary] Caught unhandled error:", error, errorInfo);

    const msg = error?.message || String(error || "");
    const isChunk =
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module") ||
      msg.includes("Loading chunk") ||
      error?.name === "ChunkLoadError";

    if (isChunk) {
      const KEY = "pgp2.chunk-reload-ts";
      const last = parseInt(sessionStorage.getItem(KEY) || "0", 10);
      const now = Date.now();
      // If we haven't auto-reloaded in the last 15 seconds, attempt immediate auto-recovery
      if (now - last > 15000) {
        sessionStorage.setItem(KEY, String(now));
        this.setState({ autoReloading: true });
        this.handleHardPurgeAndReload();
      }
    }
  }

  handleHardPurgeAndReload = async () => {
    try {
      if (typeof window !== "undefined" && window.caches) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
    } catch (e) {
      console.warn("[RootErrorBoundary] Cache purge error:", e);
    }
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleFullResetAndReload = async () => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("pgp2-feed-cache");
        localStorage.removeItem("pgp2.sw-update-seen");
        localStorage.removeItem("pgp2.theme");
      }
      if (typeof window !== "undefined" && window.caches) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
    } catch (e) {
      console.warn("[RootErrorBoundary] Reset error:", e);
    }
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.state.autoReloading) {
      return (
        <main className="loading-screen" role="status" aria-live="polite">
          <p className="loading-label">Updating TermFlow…</p>
          <p className="loading-sub">Loading the latest version, one moment…</p>
        </main>
      );
    }

    const { error, isChunkError } = this.state;
    const title = isChunkError ? "App Update Needed" : "Something Went Wrong";
    const sub = isChunkError
      ? "A newer version of TermFlow is available. Your browser needs to refresh its cached files."
      : "TermFlow encountered an unexpected error while loading.";

    return (
      <main className="loading-screen" role="alert" style={{ padding: "32px 16px", textAlign: "center", minHeight: "100vh" }}>
        <div style={{ maxWidth: 360, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <img
            src="/icon-192.png"
            alt="TermFlow"
            style={{ width: 64, height: 64, borderRadius: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
          />
          <h1 className="loading-label" style={{ margin: 0, fontSize: 22 }}>
            {title}
          </h1>
          <p className="loading-sub" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            {sub}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 8 }}>
            <button
              type="button"
              onClick={this.handleHardPurgeAndReload}
              style={{
                width: "100%",
                padding: "12px 18px",
                borderRadius: 10,
                border: "none",
                background: "var(--violet, #8B3DF5)",
                color: "#ffffff",
                fontFamily: "var(--display, sans-serif)",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(139, 61, 245, 0.35)",
              }}
            >
              Update &amp; Reload App
            </button>

            <button
              type="button"
              onClick={this.handleFullResetAndReload}
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid var(--border, #ddd)",
                background: "none",
                color: "var(--muted, #666)",
                fontFamily: "var(--body, sans-serif)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Clear Cache &amp; Reset
            </button>
          </div>

          {error && (
            <details style={{ marginTop: 12, textAlign: "left", width: "100%", fontSize: 11, color: "var(--muted, #888)", overflowWrap: "anywhere" }}>
              <summary style={{ cursor: "pointer", marginBottom: 4 }}>Error details</summary>
              <pre style={{ margin: 0, padding: 8, background: "rgba(0,0,0,0.04)", borderRadius: 6, overflowX: "auto" }}>
                {error.stack || error.message || String(error)}
              </pre>
            </details>
          )}
        </div>
      </main>
    );
  }
}

export default RootErrorBoundary;
