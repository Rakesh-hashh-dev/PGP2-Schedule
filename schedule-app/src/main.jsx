import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import App, { DevApp } from "./App.jsx";
import "./styles.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const root = ReactDOM.createRoot(document.getElementById("root"));

if (!PUBLISHABLE_KEY) {
  root.render(<React.StrictMode><DevApp /></React.StrictMode>);
} else {
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        {window.location.pathname === "/sso-callback"
          ? <AuthenticateWithRedirectCallback />
          : <App />}
      </ClerkProvider>
    </React.StrictMode>
  );
}
