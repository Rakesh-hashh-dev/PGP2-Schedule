# Task: turn on real Clerk login + add the Supabase client (Part C)

Switch the app from the auth-bypassed `DevApp` to real Clerk login, handle the Google OAuth
redirect, and add the Supabase client. All paths are inside `schedule-app/`.

## Current state (so you reconcile, not duplicate)
- `src/main.jsx` renders `<DevApp />` and has **no `ClerkProvider`**.
- `src/App.jsx` exports `default App()` (uses `useUser`/`useClerk`) and a named `DevApp()`.
- `src/components/Login.jsx` signs in with `authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: origin + "/sso-callback", ... })`, so a `/sso-callback` handler is required.
- No `.env` files are committed.

## Prerequisites done by the human (cannot be done in code)
- Clerk ↔ Supabase already connected: Supabase integration **activated** in Clerk (this adds the `role: "authenticated"` claim), and the **Clerk domain** added under Supabase → Authentication → Third-Party Auth.
- Google enabled as a Clerk social connection.
- These three values are on hand to paste into `.env.local`: Clerk publishable key (`pk_test_…`/`pk_live_…`), Supabase project URL, Supabase publishable key (`sb_publishable_…`).

> You (Claude Code) can't fetch those secret values — create `.env.local` with the placeholders below and tell the user to paste the real ones, then restart the dev server.

---

## 1. Replace `src/main.jsx`

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import App from "./App.jsx";
import "./styles.css";

const pk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!pk) console.error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env.local");

// Handle the Google OAuth return without adding a router (Vite SPA).
const isCallback = window.location.pathname === "/sso-callback";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={pk} afterSignOutUrl="/">
      {isCallback ? <AuthenticateWithRedirectCallback /> : <App />}
    </ClerkProvider>
  </React.StrictMode>
);
```

Leave `DevApp` exported in `App.jsx` — it's just no longer rendered, and stays handy for local dev.

## 2. Add the Supabase client

```bash
npm i @supabase/supabase-js
```

Create `src/lib/supabase.js`:

```js
import { createClient } from "@supabase/supabase-js";

// Clerk's session token rides on every request (native third-party auth),
// so Supabase RLS sees the Clerk user id as auth.jwt()->>'sub'.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { accessToken: async () => (window.Clerk?.session ? window.Clerk.session.getToken() : null) }
);
```

## 3. Make deep links resolve to the SPA (so `/sso-callback` loads)

Create `schedule-app/vercel.json` (merge if it already exists):

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

(Local `vite dev` already serves `index.html` for unknown paths, so nothing extra is needed for dev.)

## 4. Environment variables

Create `schedule-app/.env.local` with placeholders for the human to fill in:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME
VITE_SUPABASE_URL=https://REPLACE-REF.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_REPLACE_ME
```

Ensure `.env.local` is ignored by git — add `.env.local` to `schedule-app/.gitignore` if it's not there. (The same three variables also need to be added in the Vercel project settings before deploying.)

---

## Verify

1. `npm run dev`, open the app → you should land on the **Login / welcome** page, not the timetable (auth is no longer bypassed).
2. Sign in with a Google `@iimsambalpur.ac.in` account → after the redirect you return signed in.
3. In the browser console:
   ```js
   const { supabase } = await import("/src/lib/supabase.js");
   console.log(await supabase.from("attendance").select("*"));
   ```
   Expect `{ data: [], error: null }` — empty is correct (no rows yet), and *no error* proves Supabase accepts your Clerk token and RLS is live.

## Common snags
- **Blank page after Google sign-in** → the `/sso-callback` handler (step 1) plus the SPA rewrite (step 3) are the fix; confirm both are present.
- **"Missing publishable key" / Clerk crash** → `.env.local` wasn't loaded; Vite only reads env at startup, so restart `npm run dev` after editing it.
- **401 / JWT error from Supabase** → the Clerk↔Supabase link is incomplete: re-check the Clerk domain under Supabase Third-Party Auth and that the Supabase integration is activated in Clerk (it's what injects the `role: "authenticated"` claim).
- **Redirect not allowed** → in production, add your deployed origin to Clerk's allowed origins/domains (dev `localhost` is allowed automatically by the `pk_test_…` instance).
