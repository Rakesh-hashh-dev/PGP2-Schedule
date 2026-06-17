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
