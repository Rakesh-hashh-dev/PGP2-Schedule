import { Component, useEffect, useState } from "react";
import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import TermFlowLoader from "./TermFlowLoader.jsx";

// Clerk's own callback throws (or silently stalls) for cases like new
// sign-ups that hit "missing requirements" or a session/cookie mismatch.
// Without this, React 18 unmounts the whole tree on an uncaught render
// error and the user is left staring at a permanently blank page — with
// no way back except manually editing the URL.

function CallbackStuck({ detail }) {
  return (
    <main style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100dvh", gap: 16, padding: 32, textAlign: "center",
    }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Sign-in didn't finish</p>
      <p style={{ margin: 0, color: "var(--muted, #888)", fontSize: 14, maxWidth: 320, lineHeight: 1.6 }}>
        Something interrupted the sign-in. This usually clears up on a retry.
      </p>
      <button
        onClick={() => { window.location.href = "/"; }}
        style={{ marginTop: 8, padding: "9px 20px", borderRadius: 8, border: "1.5px solid var(--border, #ddd)", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
      >
        Back to sign-in
      </button>
      {/* Not stripped by drop_console — visible in a screenshot/report from
          the field, which is the only debugging signal we get here. */}
      {detail && <p style={{ margin: 0, fontSize: 11, color: "#bbb", maxWidth: 320, wordBreak: "break-word" }}>{detail}</p>}
    </main>
  );
}

class CallbackErrorBoundary extends Component {
  state = { errored: false, detail: null };
  static getDerivedStateFromError(error) { return { errored: true, detail: error?.message || String(error) }; }
  render() { return this.state.errored ? <CallbackStuck detail={this.state.detail} /> : this.props.children; }
}

export default function SsoCallback() {
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStalled(true), 10_000);
    return () => clearTimeout(t);
  }, []);

  if (stalled) return <CallbackStuck />;

  return (
    <CallbackErrorBoundary>
      <main className="loading-screen">
        <TermFlowLoader variant="splash" size={96} />
        <p className="loading-label">Signing in…</p>
      </main>
      <AuthenticateWithRedirectCallback />
    </CallbackErrorBoundary>
  );
}
