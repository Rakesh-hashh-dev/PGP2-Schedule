export const STARTUP_NAME_KEY = "pgp2.startup-name";

export function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function cleanStartupName(value) {
  if (typeof value !== "string") return "";
  return value.trim().split(/\s+/)[0].slice(0, 40);
}

export function readStartupName() {
  try {
    return cleanStartupName(localStorage.getItem(STARTUP_NAME_KEY));
  } catch {
    return "";
  }
}

export function rememberStartupName(value) {
  const name = cleanStartupName(value);
  if (!name) return;
  try {
    localStorage.setItem(STARTUP_NAME_KEY, name);
  } catch { /* The greeting can safely fall back when storage is unavailable. */ }
}

export function forgetStartupName() {
  try {
    localStorage.removeItem(STARTUP_NAME_KEY);
  } catch { /* No action needed. */ }
}
