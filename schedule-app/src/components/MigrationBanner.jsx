/**
 * MigrationBanner
 *
 * A fixed overlay shown during the one-time dev→prod data migration.
 * Displayed only to users whose account existed in the dev instance.
 *
 * States:
 *   "restoring" — migration in progress (spinner)
 *   "done"      — migration succeeded (brief confirmation, then auto-dismiss)
 *   "failed"    — all 3 retry attempts exhausted (will retry next login)
 */

import { useEffect, useState } from "react";

export default function MigrationBanner({ state }) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss "done" banner after 2.5 seconds
  useEffect(() => {
    if (state === "done") {
      const t = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(t);
    }
    setVisible(true);
  }, [state]);

  if (!visible) return null;

  const config = {
    restoring: {
      icon: (
        <span className="migration-spinner" aria-hidden="true" />
      ),
      text: "Restoring your data…",
      sub: "Hang tight, this only takes a moment.",
      cls: "migration-banner--restoring",
    },
    done: {
      icon: <span className="migration-icon-done" aria-hidden="true">✓</span>,
      text: "Data restored!",
      sub: "Your profile, attendance, and friends are back.",
      cls: "migration-banner--done",
    },
    failed: {
      icon: <span className="migration-icon-warn" aria-hidden="true">⚠</span>,
      text: "Couldn't restore data",
      sub: "We'll try again next time you open the app.",
      cls: "migration-banner--failed",
    },
  }[state];

  if (!config) return null;

  return (
    <div className={`migration-banner ${config.cls}`} role="status" aria-live="polite">
      <div className="migration-banner-inner">
        {config.icon}
        <div className="migration-banner-text">
          <span className="migration-banner-title">{config.text}</span>
          <span className="migration-banner-sub">{config.sub}</span>
        </div>
      </div>
    </div>
  );
}
