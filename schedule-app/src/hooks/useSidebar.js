// Sidebar/theme/mobile-nav UI state, extracted from App.jsx. Pure UI-shell
// concerns (collapse state, visual style, appearance, bottom-dock lens,
// overflow-menu accordion sections) with no coupling to schedule/enrollment/
// notification data. The bottom-dock lens lives in components/BnavLens.jsx so
// taps and view changes don't re-render App.
import { useState, useEffect, useRef } from "react";
import { setSbFloatTip } from "../lib/sbFloatTip.js";

export function useSidebar({ isTablet }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem("pgp2.sidebar");
      if (stored === "collapsed") return true;
      if (stored === "expanded") return false;
      return Boolean(isTablet);
    } catch {
      return Boolean(isTablet);
    }
  });
  // Tablet content needs the icon rail even when desktop expansion is saved.
  // Keep the preference intact so rotating/resizing back restores desktop.
  const sbCollapsed = isTablet || sidebarCollapsed;
  function toggleSidebar() {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("pgp2.sidebar", next ? "collapsed" : "expanded"); } catch { }
      return next;
    });
    setSbFloatTip(null);
  }

  useEffect(() => {
    try {
      if (!localStorage.getItem("pgp2.sidebar") && isTablet) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time tablet default when no saved preference
        setSidebarCollapsed(true);
      }
    } catch { }
  }, [isTablet]);

  // Sidebar visual style — "classic" (attached dark) or "aurora" (floating glass, animated)
  const [sbStyle, setSbStyle] = useState(() => {
    try { return localStorage.getItem("pgp2.sidebar-style") === "aurora" ? "aurora" : "classic"; } catch { return "classic"; }
  });
  function setSidebarStyle(s) {
    setSbStyle(s);
    try { localStorage.setItem("pgp2.sidebar-style", s); } catch { }
  }

  // Appearance — "light" | "dark" | "system". The pre-paint script in
  // index.html applies the saved value before React mounts; this keeps
  // <html data-theme> and the theme-color meta in sync from then on.
  const [theme, setTheme] = useState(() => {
    try {
      const v = localStorage.getItem("pgp2.theme");
      return v === "light" || v === "dark" || v === "system" ? v : "system";
    } catch { return "system"; }
  });
  function pickTheme(t) {
    setTheme(t);
    try { localStorage.setItem("pgp2.theme", t); } catch { }
  }
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      if (dark) document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#101216" : "#15182B");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  // Tooltip state lives in SbFloatTip's store, not here — see that file.
  function showSbTip(e, label, always = false) {
    if (!sbCollapsed && !always) return;
    const r = e.currentTarget.getBoundingClientRect();
    setSbFloatTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  }
  function hideSbTip() { setSbFloatTip(null); }

  // Mobile navigation preference: "bottom" (dock only), "top" (tab strip only), or "both"
  const [mobileNavMode, setMobileNavMode] = useState(() => {
    try {
      const v = localStorage.getItem("pgp2.mobile-nav");
      if (v === "bottom" || v === "top" || v === "both") return v;
      if (localStorage.getItem("pgp2.bottom-nav") === "hidden") return "top";
      return "top";
    } catch { return "top"; }
  });
  function pickNavMode(mode) {
    setMobileNavMode(mode);
    try { localStorage.setItem("pgp2.mobile-nav", mode); } catch { }
  }
  const showBottomNav = mobileNavMode !== "top";
  const showTopTabs = mobileNavMode !== "bottom";

  // ── Liquid-glass dock: scroll recede ──
  // The compact class is toggled on the element directly — as React state it
  // re-rendered the entire App mid-scroll every time the dock flipped.
  const bnavRef = useRef(null);
  useEffect(() => {
    if (!showBottomNav) return;
    let lastY = window.scrollY;
    let acc = 0;        // accumulated same-direction scroll (hysteresis)
    let compact = false;
    let raf = 0;
    let idleTimer = 0;
    const apply = (v) => {
      if (compact === v) return;
      compact = v;
      bnavRef.current?.classList.toggle("bnav-compact", v);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const dy = y - lastY;
        lastY = y;
        // Ignore micro-jitter from elastic scroll / address-bar resize
        if (Math.abs(dy) < 2) return;
        // Accumulate in one direction; a direction change resets the tally,
        // so only sustained movement flips the state — no mid-scroll bouncing
        acc = (dy > 0) === (acc > 0) ? acc + dy : dy;
        if (acc > 28 && y > 120) apply(true);
        else if (acc < -16 || y <= 120) apply(false);
        // Spring back after ~1s of no scrolling
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => { acc = 0; apply(false); }, 1000);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
    };
  }, [showBottomNav]);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  // Overflow-menu collapsible sections (mobile ⋯ menu)
  const [toolsSecOpen, setToolsSecOpen] = useState(false);
  // Desktop sidebar "More" group — collapsed by default so the long tail of
  // occasional-use pages doesn't flatten the whole nav's visual hierarchy.
  // (This read `true` for a while, silently contradicting the comment and
  // making the sidebar's "Recent" shortcut unreachable.)
  const [sbToolsOpen, setSbToolsOpen] = useState(false);
  const [prefsSecOpen, setPrefsSecOpen] = useState(false);
  const [aboutSecOpen, setAboutSecOpen] = useState(false);
  const [adminSecOpen, setAdminSecOpen] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);
  const [showLeftScroll, setShowLeftScroll] = useState(false);

  return {
    sidebarCollapsed, setSidebarCollapsed, sbCollapsed, toggleSidebar,
    sbStyle, setSbStyle, setSidebarStyle,
    theme, setTheme, pickTheme,
    showSbTip, hideSbTip,
    mobileNavMode, setMobileNavMode, pickNavMode, showBottomNav, showTopTabs,
    bnavRef,
    navMenuOpen, setNavMenuOpen,
    themeMenuOpen, setThemeMenuOpen,
    toolsSecOpen, setToolsSecOpen,
    sbToolsOpen, setSbToolsOpen,
    prefsSecOpen, setPrefsSecOpen,
    aboutSecOpen, setAboutSecOpen,
    adminSecOpen, setAdminSecOpen,
    showRightScroll, setShowRightScroll,
    showLeftScroll, setShowLeftScroll,
  };
}
