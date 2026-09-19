import TermFlowLoader from "./TermFlowLoader.jsx";
import { cleanStartupName, getTimeGreeting, readStartupName } from "../lib/startupGreeting.js";

export default function StartupGreeting({ name, message = "Getting your day ready…", size = 96 }) {
  const firstName = cleanStartupName(name) || readStartupName();
  const heading = firstName ? `${getTimeGreeting()}, ${firstName}` : "Welcome to TermFlow";

  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <TermFlowLoader variant="splash" size={size} />
      <h1 className="loading-label">{heading}</h1>
      <p className="loading-sub">{message}</p>
    </main>
  );
}
