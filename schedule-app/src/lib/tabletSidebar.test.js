import { describe, expect, it } from "vitest";
import { TABLET_SIDEBAR_KEY, readTabletSidebar, saveTabletSidebar, effectiveSidebarCollapsed } from "./tabletSidebar.js";

describe("independent V2 tablet sidebar", () => {
  it("defaults to collapsed and tolerates unavailable storage", () => {
    expect(readTabletSidebar({ getItem: () => null })).toBe(false);
    const denied = { getItem: () => { throw Error("denied"); }, setItem: () => { throw Error("denied"); } };
    expect(readTabletSidebar(denied)).toBe(false);
    expect(() => saveTabletSidebar(true, denied)).not.toThrow();
  });
  it("remembers tablet expansion without overwriting the desktop preference", () => {
    const values = new Map([["pgp2.sidebar", "collapsed"]]);
    const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    saveTabletSidebar(true, storage); expect(readTabletSidebar(storage)).toBe(true);
    expect(values.get("pgp2.sidebar")).toBe("collapsed");
    saveTabletSidebar(false, storage); expect(values.get(TABLET_SIDEBAR_KEY)).toBe("collapsed");
  });
  it("changes only V2 landscape tablet state", () => {
    const base = { isTablet: true, v2Active: true, tabletExpanded: true, sidebarCollapsed: true };
    expect(effectiveSidebarCollapsed(base)).toBe(false);
    expect(effectiveSidebarCollapsed({ ...base, tabletExpanded: false })).toBe(true);
    expect(effectiveSidebarCollapsed({ ...base, v2Active: false })).toBe(true);
    expect(effectiveSidebarCollapsed({ ...base, isTablet: false })).toBe(true);
    expect(effectiveSidebarCollapsed({ ...base, isTablet: false, sidebarCollapsed: false })).toBe(false);
  });
});
