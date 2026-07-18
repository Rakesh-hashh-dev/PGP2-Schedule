// Haptic feedback — thin wrapper over the Web Vibration API.
//
// The device silent/ring switch is NOT readable from the web (no browser
// exposes it), and on Android navigator.vibrate() fires regardless of that
// switch. So instead of chasing silent-mode detection we gate on a local,
// user-controlled preference (toggle lives in Notification settings). iOS
// Safari has no Vibration API at all, so haptic() is simply a no-op there.

const KEY = "pgp2.haptics";

export function hapticsSupported() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

// Default ON — absence of the key means "not yet chosen", which we treat as on.
export function hapticsEnabled() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function setHapticsEnabled(on) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* ignore */ }
}

// Fire a vibration pattern (number | number[]) only when supported AND enabled.
export function haptic(pattern = 10) {
  if (!hapticsSupported() || !hapticsEnabled()) return;
  navigator.vibrate(pattern);
}
