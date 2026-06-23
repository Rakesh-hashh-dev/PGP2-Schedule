import { useState, useEffect } from "react";
import { Sun, Moon, Sparkles, Shield, Settings2, RefreshCw, X } from "lucide-react";
import { useSignIn } from "@clerk/clerk-react";

export default function Login() {
  const { signIn, isLoaded } = useSignIn();
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState("light"); // 'light', 'dark', 'premium'
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const themes = ["light", "dark", "premium"];
  const handleThemeToggle = () => {
    setTheme(t => themes[(themes.indexOf(t) + 1) % themes.length]);
  };

  async function handleSignIn() {
    if (!isLoaded) return;
    setLoading(true);
    await signIn.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: `${window.location.origin}/sso-callback`,
      redirectUrlComplete: window.location.origin,
    });
  }

  // Prevent scrolling on body when bottom sheet is open
  useEffect(() => {
    if (showHowItWorks) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => { document.body.style.overflow = "auto"; };
  }, [showHowItWorks]);

  return (
    <div className={`login-screen theme-${theme}`}>
      <div className="login-bg-mesh">
        <div className="login-blob blob-1"></div>
        <div className="login-blob blob-2"></div>
        <div className="login-blob blob-3"></div>
      </div>

      <button
        className="login-theme-toggle"
        onClick={handleThemeToggle}
        aria-label="Toggle Theme"
      >
        {theme === "light" && <Moon size={20} />}
        {theme === "dark" && <Sparkles size={20} />}
        {theme === "premium" && <Sun size={20} />}
      </button>

      <div className="login-card">
        <div className="login-logo"><img src="/termflow-icon.svg" alt="TermFlow Logo" /></div>
        <h1 className="login-title">TermFlow</h1>
        <p className="login-sub">IIM Sambalpur · Sign in with your institute account</p>

        <button className="login-btn" onClick={handleSignIn} disabled={!isLoaded || loading}>
          {loading ? <span className="login-spinner" /> : <GoogleIcon />}
          {loading ? "Redirecting…" : "Continue with Google"}
        </button>

        <button className="login-how-btn" onClick={() => setShowHowItWorks(true)}>
          How does this work?
        </button>

        <p className="login-note">Only @iimsambalpur.ac.in accounts are allowed.</p>
      </div>

      {showHowItWorks && (
        <>
          <div className="hiw-backdrop" onClick={() => setShowHowItWorks(false)}></div>
          <div className="hiw-bottom-sheet">
            <button className="hiw-close" onClick={() => setShowHowItWorks(false)}>
              <X size={20} />
            </button>
            <h2 className="hiw-title">How TermFlow Works</h2>
            <div className="hiw-steps">
              <div className="hiw-step">
                <div className="hiw-icon-wrap" style={{ background: "rgba(39, 174, 96, 0.15)", color: "#27ae60" }}>
                  <Shield size={22} />
                </div>
                <div className="hiw-text">
                  <h3>Secure Login</h3>
                  <p>Sign in exclusively using your verified <code>@iimsambalpur.ac.in</code> institute account.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-icon-wrap" style={{ background: "rgba(52, 152, 219, 0.15)", color: "#3498db" }}>
                  <Settings2 size={22} />
                </div>
                <div className="hiw-text">
                  <h3>Personalize</h3>
                  <p>Select your exact electives and sections to build a schedule tailored just for you.</p>
                </div>
              </div>
              <div className="hiw-step">
                <div className="hiw-icon-wrap" style={{ background: "rgba(155, 89, 182, 0.15)", color: "#9b59b6" }}>
                  <RefreshCw size={22} />
                </div>
                <div className="hiw-text">
                  <h3>Stay Synced</h3>
                  <p>Get a live, personalized daily timetable, track your attendance, and see live changes instantly.</p>
                </div>
              </div>
            </div>
            <button className="hiw-got-it" onClick={() => setShowHowItWorks(false)}>
              Got it, let's go!
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

