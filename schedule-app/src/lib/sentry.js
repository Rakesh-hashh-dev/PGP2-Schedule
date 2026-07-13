// Lazy Sentry bootstrap. The SDK (~90 KB gzip) stays out of the critical
// bundle: lightweight window handlers queue anything that throws before the
// SDK is loaded on idle, then the queue is flushed into Sentry.
const DSN = import.meta.env.VITE_SENTRY_DSN;

let sentryPromise = null;
const preInitQueue = [];

function loadSentry() {
  if (!sentryPromise) {
    sentryPromise = import("./sentry-sdk.js").then((Sentry) => {
      Sentry.initSdk({
        dsn: DSN,
        release: String(__APP_VERSION__),
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        ignoreErrors: [
          // Benign browser/PWA noise
          "ResizeObserver loop",
          "Failed to fetch dynamically imported module",
        ],
      });
      for (const err of preInitQueue) Sentry.captureException(err);
      preInitQueue.length = 0;
      return Sentry;
    });
  }
  return sentryPromise;
}

export function initSentry() {
  if (!DSN) return;

  const onError = (event) => {
    preInitQueue.push(event.error ?? new Error(event.message));
    loadSentry();
  };
  const onRejection = (event) => {
    preInitQueue.push(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    );
    loadSentry();
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const start = () => {
    // Sentry's own global handlers take over from here
    loadSentry().then(() => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    });
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(start, { timeout: 5000 });
  } else {
    setTimeout(start, 3000);
  }
}

// For manual reporting from catch blocks: captureException(err, { extra: {...} })
export function captureException(error, context) {
  if (!DSN) return;
  loadSentry().then((Sentry) => Sentry.captureException(error, context));
}

// Attach the signed-in user so errors are attributable (call from ClerkApp)
export function setSentryUser(user) {
  if (!DSN) return;
  loadSentry().then((Sentry) =>
    Sentry.setUser(user ? { id: user.id, username: user.username ?? undefined } : null)
  );
}
