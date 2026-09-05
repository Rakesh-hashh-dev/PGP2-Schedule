// Guards every href that comes from stored config rather than from our own code.
//
// Quick links and social-toast actions are free text an admin types into
// system_config.flags. React 19 warns about a `javascript:` href in dev but
// still renders it, so a planted link would run script in every user's page on
// click. Validating on the admin form isn't enough — rows already in the table
// bypass it — so the guard belongs at the render site.

const ALLOWED = ["http:", "https:", "mailto:"];

/**
 * Returns the URL if it uses a safe scheme, else null.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function safeUrl(raw) {
  if (!raw) return null;
  try {
    // globalThis.location is absent under vitest's node env — fall back to a
    // dummy base so a relative path still parses instead of throwing.
    const base = globalThis.location?.origin || "http://localhost";
    const parsed = new URL(String(raw).trim(), base);
    return ALLOWED.includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}
