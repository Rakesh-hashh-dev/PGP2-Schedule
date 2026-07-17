import { useState, useEffect } from "react";
import { pushSupported, pushConfigured, pushBlockReason, getPushSubscription, subscribeToPush, unsubscribeFromPush } from "../lib/push.js";

// Shared push subscription state + toggle logic, reused by the announcements
// header pill (PushToggle) and the mobile overflow menu (PushMenuItem).
export function usePushStatus(userId, onStatusChange) {
  // 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'busy'
  const [status, setStatusRaw] = useState("busy");
  const setStatus = (s) => { setStatusRaw(s); onStatusChange?.(s); };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported() || !pushConfigured()) {
        // iOS Safari tab: push works once installed to the Home Screen, so
        // surface a guide instead of hiding the control entirely
        return setStatus(pushBlockReason() === "ios-install" ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setStatus("denied");
      const sub = await getPushSubscription().catch(() => null);
      if (!cancelled) setStatus(sub ? "on" : "off");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    if (status === "busy" || status === "denied") return;
    const prev = status;
    setStatus("busy");
    try {
      if (prev === "on") {
        await unsubscribeFromPush();
        setStatus("off");
      } else {
        await subscribeToPush(userId);
        setStatus("on");
      }
    } catch (e) {
      setStatus(Notification.permission === "denied" ? "denied" : prev);
      if (Notification.permission !== "denied") alert(e.message || "Could not update push notifications.");
    }
  }

  return { status, toggle };
}
