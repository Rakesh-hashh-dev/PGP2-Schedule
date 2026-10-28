export const TABLET_SIDEBAR_KEY = "pgp2.v2-tablet-sidebar";

export function readTabletSidebar(storage = globalThis.localStorage) {
  try { return storage?.getItem(TABLET_SIDEBAR_KEY) === "expanded"; } catch { return false; }
}

export function saveTabletSidebar(expanded, storage = globalThis.localStorage) {
  try { storage?.setItem(TABLET_SIDEBAR_KEY, expanded ? "expanded" : "collapsed"); } catch { /* unavailable storage */ }
}

export function effectiveSidebarCollapsed({ isTablet, tabletExpanded, sidebarCollapsed }) {
  return isTablet ? !tabletExpanded : sidebarCollapsed;
}

