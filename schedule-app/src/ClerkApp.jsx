import { useEffect } from "react";
import { ClerkProvider, useUser } from "@clerk/clerk-react";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import SsoCallback from "./components/SsoCallback.jsx";
import { setSentryUser } from "./lib/sentry.js";

function SentryUserSync() {
  const { isLoaded, user } = useUser();
  useEffect(() => {
    if (isLoaded) setSentryUser(user);
  }, [isLoaded, user]);
  return null;
}

const pk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!pk) console.error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env.local");

const isCallback = window.location.pathname === "/sso-callback";

export default function ClerkApp() {
  return (
    // clerkJSVariant="headless" loads the UI-less build of clerk-js — this app
    // renders its own login UI (custom <Login/> + authenticateWithRedirect) and
    // uses no Clerk prebuilt components (<SignIn/>, <UserButton/>, …), so the
    // ~430 KB prebuilt-UI bundle is dropped from the critical path.
    <ClerkProvider publishableKey={pk} afterSignOutUrl="/" clerkJSVariant="headless">
      {isCallback ? <SsoCallback /> : <App />}
      <SentryUserSync />
      <Analytics />
    </ClerkProvider>
  );
}
