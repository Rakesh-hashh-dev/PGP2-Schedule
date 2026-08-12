// The Supabase client (src/lib/supabase.js) reads `window.Clerk` in its
// accessToken callback, which fires once at construction to seed the realtime
// auth token. In the node test env there is no `window`, so that throws and
// Supabase logs a noisy (harmless) warning. A minimal stub keeps test output
// clean without pulling in a full DOM. No test relies on this value.
globalThis.window = globalThis.window || {};
