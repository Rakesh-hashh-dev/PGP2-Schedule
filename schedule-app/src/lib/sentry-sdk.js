// Named-import shim for the lazily loaded Sentry SDK. sentry.js dynamic-imports
// this module instead of "@sentry/react" directly: a namespace import of the
// package defeats tree-shaking and bundles tracing/replay (~470 KB); named
// imports here keep the chunk to the errors-only core.
import {
  init,
  captureException,
  setUser,
  browserApiErrorsIntegration,
  globalHandlersIntegration,
  dedupeIntegration,
  breadcrumbsIntegration,
  linkedErrorsIntegration,
  functionToStringIntegration,
  inboundFiltersIntegration,
  httpContextIntegration,
} from "@sentry/react";

export function initSdk(options) {
  init({
    ...options,
    defaultIntegrations: false,
    // Disable profiling — prevents the `Document-Policy: js-profiling` violation
    // that @sentry/react v10+ attempts even without the profiling integration,
    // which Lighthouse records as a console error (-4 pts Best Practices).
    profilesSampleRate: 0,
    integrations: [
      inboundFiltersIntegration(),
      functionToStringIntegration(),
      browserApiErrorsIntegration(),
      breadcrumbsIntegration(),
      globalHandlersIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      httpContextIntegration(),
    ],
  });
}

export { captureException, setUser };
