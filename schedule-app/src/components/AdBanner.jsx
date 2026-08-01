import { useEffect, useRef, useState } from "react";

// ─── AdSense config ──────────────────────────────────────────────────────────
// Replace these with your real values once your AdSense account is approved.
// Publisher ID format:  ca-pub-XXXXXXXXXXXXXXXXX
// Ad Slot ID format:    XXXXXXXXXX  (10 digits, found inside AdSense > Ad Units)
const PUBLISHER_ID = "ca-pub-4569974855881178";
const AD_SLOT_ID   = "XXXXXXXXXX";

// Set to true to show a labelled placeholder instead of a live AdSense unit.
// Flip to false once you have real Publisher + Slot IDs and the site is approved.
const MOCK_MODE = true;
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AdBanner — lazy-loaded, CLS-safe Google AdSense display unit.
 *
 * Performance design:
 *  • IntersectionObserver: the ad is only initialised when scrolled into view,
 *    so it never costs anything on pages that don't show it.
 *  • Fixed min-height container: space is reserved before the ad loads, which
 *    prevents Cumulative Layout Shift (CLS).
 *  • async adsbygoogle push: happens inside the observer callback, not on mount.
 *
 * To remove ads entirely: delete this component and its import in BoardPage.jsx.
 */
export default function AdBanner({ className = "" }) {
  const ref       = useRef(null);
  const pushed    = useRef(false);
  const [visible, setVisible] = useState(false);

  // Trigger ad init when the placeholder scrolls into view
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" } // start loading 200px before it enters viewport
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Push the AdSense unit once it becomes visible (live mode only)
  useEffect(() => {
    if (!visible || MOCK_MODE || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn("[AdBanner] adsbygoogle push failed:", e);
    }
  }, [visible]);

  return (
    <div
      ref={ref}
      className={`ad-banner-wrap ${className}`}
      aria-label="Sponsored content"
    >
      <span className="ad-banner-label">Sponsored</span>

      {MOCK_MODE ? (
        /* ── MOCK PLACEHOLDER ────────────────────────────────────────────── */
        <div className="ad-banner-mock">
          <div className="ad-banner-mock-inner">
            <div className="ad-banner-mock-icon">📢</div>
            <div className="ad-banner-mock-text">
              <p className="ad-banner-mock-headline">Your ad could be here</p>
              <p className="ad-banner-mock-sub">
                Google AdSense · Responsive display ad
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ── LIVE ADSENSE UNIT ───────────────────────────────────────────── */
        visible && (
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client={PUBLISHER_ID}
            data-ad-slot={AD_SLOT_ID}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        )
      )}
    </div>
  );
}
