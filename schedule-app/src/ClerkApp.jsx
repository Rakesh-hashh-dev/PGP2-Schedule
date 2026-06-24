import { ClerkProvider, AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App.jsx";

const pk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!pk) console.error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env.local");

const isCallback = window.location.pathname === "/sso-callback";

export default function ClerkApp() {
  return (
    <ClerkProvider publishableKey={pk} afterSignOutUrl="/">
      {isCallback ? <AuthenticateWithRedirectCallback /> : <App />}
      <Analytics />
      <SpeedInsights />
    </ClerkProvider>
  );
}
