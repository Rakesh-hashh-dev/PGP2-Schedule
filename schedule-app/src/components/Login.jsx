import { useState, useEffect, useRef } from "react";
import { Sun, Moon, Sparkles, ArrowUpRight, CalendarDays, Check, SlidersHorizontal, X, ArrowRight, ShieldCheck, ChevronLeft, ChevronRight, ChevronDown, Pause, Play } from "lucide-react";
import { useSignIn } from "@clerk/clerk-react";
import "./Login.css";

const themes = [{ id: "light", label: "Light", Icon: Sun }, { id: "dark", label: "Dark", Icon: Moon }, { id: "premium", label: "Premium", Icon: Sparkles }];
const slideOrder = [7, 2, 6, 5, 1, 3, 4];
const loginSlides = slideOrder.map(number => `/Login%20Slide/${number}.webp`);
const slidePositions = ["50% 70%", "50% 78%", "50% 68%", "50% 50%", "50% 78%", "50% 76%", "50% 50%"];

export default function Login() {
  const { signIn, isLoaded } = useSignIn();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem("termflow-login-theme");
      return themes.some(({ id }) => id === savedTheme) ? savedTheme : "dark";
    } catch {
      return "dark";
    }
  });
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const dialogRef = useRef(null);
  const helpRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("termflow-login-theme", theme);
    } catch { /* Theme persistence is optional. */ }
  }, [theme]);

  useEffect(() => {
    if (!showHowItWorks) return;
    const dialog = dialogRef.current;
    const helpButton = helpRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      helpButton?.focus();
    };
  }, [showHowItWorks]);

  async function handleSignIn() {
    if (!isLoaded || loading) return;
    setError("");
    setLoading(true);
    let complete = window.location.origin;
    try {
      const pending = localStorage.getItem("pgp2.pending-invite");
      if (pending) complete = `${window.location.origin}/?f=${encodeURIComponent(pending)}`;
    } catch { /* Storage may be unavailable in embedded browsers. */ }
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: complete,
      });
    } catch {
      setError("We couldn’t open Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className={`tf-login tf-login--${theme}`}>
      <section className="tf-login-intro" aria-labelledby="tf-login-heading">
        <LoginSlideshow />
        <a className="tf-login-brand" href="/" aria-label="TermFlow home">
          <img src="/termflow-icon.svg" alt="" width="36" height="36" />
          <span>TermFlow<span className="tf-login-brand-sub">IIM SAMBALPUR</span></span>
        </a>
        <div className="tf-login-intro-content">
          <div className="tf-login-eyebrow"><span /> BUILT FOR IIM SAMBALPUR</div>
          <h1 id="tf-login-heading">Your campus day,<br /><em>finally in flow.</em></h1>
          <p className="tf-login-description">One calm place for your timetable, attendance, electives & deadlines - made around the way your term actually works.</p>
          <div className="tf-login-features">
            <span><CalendarDays size={16} /> Your timetable</span>
            <span><Check size={16} /> Attendance</span>
            <span><SlidersHorizontal size={16} /> Your electives</span>
          </div>
        </div>
      </section>

      <div className="tf-login-panel">
        <header className="tf-login-header">
          <div className="tf-login-themes" role="group" aria-label="Page theme">
            {themes.map(({ id, label, Icon }) => (
              <button key={id} type="button" aria-label={`${label} theme`} aria-pressed={theme === id} title={`${label} theme`} onClick={() => setTheme(id)}>
                <Icon size={16} /><span>{label}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="tf-login-panel-main">
          <section className="tf-login-card" aria-labelledby="tf-signin-heading">
            <div className="tf-login-card-icon"><img src="/termflow-icon.svg" alt="" width="44" height="44" /></div>
            <span className="tf-login-card-eyebrow">STUDENT PORTAL</span>
            <h2 id="tf-signin-heading">Welcome back</h2>
            <p id="tf-signin-description">Use your institute Google account to open your personal TermFlow.</p>
            <button className="tf-login-google" onClick={handleSignIn} disabled={!isLoaded || loading} aria-busy={loading} aria-describedby="tf-account-note tf-signin-description">
              {loading ? <span className="tf-login-spinner" /> : <GoogleIcon />}
              <span>{loading ? "Opening Google…" : !isLoaded ? "Preparing sign-in…" : error ? "Try Google again" : "Continue with Google"}</span>
              {!loading && isLoaded && <ArrowRight size={17} />}
            </button>
            <p className="tf-login-account" id="tf-account-note"><ShieldCheck size={15} aria-hidden="true" /><span>Only <strong>@iimsambalpur.ac.in</strong> accounts can sign in.</span></p>
            {error && <p className="tf-login-error" role="alert">{error}</p>}
            <div className="tf-login-card-divider" />
            <div className="tf-login-help"><span>New here? It’s simple.</span><button ref={helpRef} onClick={() => setShowHowItWorks(true)}>How it works <ArrowUpRight size={15} /></button></div>
            <div className="tf-login-card-bottom"><ShieldCheck size={16} aria-hidden="true" /> Institute-only access</div>
          </section>

          <details className="tf-login-sample">
            <summary><span><CalendarDays size={17} /> Preview a sample day</span><span className="tf-login-sample-pill">SAMPLE</span><ChevronDown className="tf-login-sample-chevron" size={18} /></summary>
            <div className="tf-login-sample-body">
              <p>Classes arranged around your selections</p>
              <div className="tf-login-class"><time dateTime="09:00">09:00AM<span>10:30AM</span></time><div><strong>Morning elective</strong><span>Academic Block · Your section</span></div><span className="tf-login-class-tag">NEXT</span></div>
              <div className="tf-login-class tf-login-class--second"><time dateTime="11:00">11:00AM<span>12:30PM</span></time><div><strong>Core course</strong><span>Academic Block · Your section</span></div></div>
              <p className="tf-login-sample-note"><Check size={14} /> Your electives shape your personal timetable.</p>
            </div>
          </details>
        </div>

        <footer className="tf-login-footer"><span>Made for the rhythm of campus life.</span><span><a href="/about.html">About &amp; FAQ</a> · TermFlow · IIM Sambalpur</span></footer>
      </div>

      <dialog ref={dialogRef} className="tf-login-dialog" aria-labelledby="tf-how-title" onCancel={() => setShowHowItWorks(false)} onClose={() => setShowHowItWorks(false)} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) setShowHowItWorks(false); } }}>
        <button className="tf-login-close" aria-label="Close how it works" onClick={() => setShowHowItWorks(false)} autoFocus><X size={20} /></button>
        <span className="tf-login-card-eyebrow">THREE SIMPLE STEPS</span>
        <h2 id="tf-how-title">Make it your term.</h2>
        <ol className="tf-login-steps">
          <li><span>01</span><div><h3>Sign in</h3><p>Use your @iimsambalpur.ac.in Google account.</p></div></li>
          <li><span>02</span><div><h3>Choose your electives</h3><p>Select your courses and sections to build your personal timetable.</p></div></li>
          <li><span>03</span><div><h3>Follow your schedule</h3><p>See your classes, track attendance, and keep up with schedule changes.</p></div></li>
        </ol>
        <button className="tf-login-done" onClick={() => setShowHowItWorks(false)}>Got it, let’s go <ArrowRight size={17} /></button>
      </dialog>
    </main>
  );
}

function LoginSlideshow() {
  const [shownIndex, setShownIndex] = useState(0);
  const [incomingIndex, setIncomingIndex] = useState(null);
  const [incomingReady, setIncomingReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [playing, setPlaying] = useState(() => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || !document.hidden);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setPlaying(false);
    };
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!playing || !pageVisible || incomingIndex !== null) return;
    const timer = window.setTimeout(() => setIncomingIndex((shownIndex + 1) % loginSlides.length), 8000);
    return () => window.clearTimeout(timer);
  }, [playing, pageVisible, shownIndex, incomingIndex]);

  useEffect(() => {
    if (incomingIndex === null || !incomingReady) return;
    const timer = window.setTimeout(() => {
      setShownIndex(incomingIndex);
      setIncomingIndex(null);
      setIncomingReady(false);
    }, reducedMotion ? 0 : 1100);
    return () => window.clearTimeout(timer);
  }, [incomingIndex, incomingReady, reducedMotion]);

  const showSlide = index => {
    if (incomingIndex !== null || index === shownIndex) return;
    setIncomingReady(false);
    setIncomingIndex((index + loginSlides.length) % loginSlides.length);
  };

  return (
    <div className="tf-login-slideshow" aria-label="Campus photo slideshow">
      <img className="tf-login-slide tf-login-slide--current" src={loginSlides[shownIndex]} alt="" decoding="async" fetchPriority="high" style={{ objectPosition: slidePositions[shownIndex] }} />
      {incomingIndex !== null && <img key={incomingIndex} className={`tf-login-slide tf-login-slide--incoming${incomingReady ? " is-visible" : ""}`} src={loginSlides[incomingIndex]} alt="" decoding="async" style={{ objectPosition: slidePositions[incomingIndex] }} onLoad={() => setIncomingReady(true)} onError={() => { setIncomingIndex(null); setIncomingReady(false); }} />}
      <div className="tf-login-slide-controls">
        <button type="button" onClick={() => showSlide(shownIndex - 1)} disabled={incomingIndex !== null} aria-label="Previous campus photo"><ChevronLeft size={17} /></button>
        <span aria-hidden="true">{shownIndex + 1} / {loginSlides.length}</span>
        <button type="button" onClick={() => showSlide(shownIndex + 1)} disabled={incomingIndex !== null} aria-label="Next campus photo"><ChevronRight size={17} /></button>
        <button type="button" onClick={() => setPlaying(value => !value)} aria-label={playing ? "Pause slideshow" : "Play slideshow"} aria-pressed={!playing}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}
