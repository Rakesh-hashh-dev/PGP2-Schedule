import { NAV_ITEMS } from "./navItems.js";

export const SIDEBAR_PINS_KEY = "pgp2.sidebar-pins";
export const SIDEBAR_COMPACT_KEY = "pgp2.sidebar-compact";
export const MAX_SIDEBAR_PINS = 3;

export function normalizeSidebarPins(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(NAV_ITEMS.filter(item => item.view).map(item => item.id));
  return [...new Set(value)].filter(id => allowed.has(id)).slice(0, MAX_SIDEBAR_PINS);
}

export function toggleSidebarPin(pins, id) {
  const clean = normalizeSidebarPins(pins);
  return clean.includes(id) ? clean.filter(pin => pin !== id) : normalizeSidebarPins([...clean, id]);
}
