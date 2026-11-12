import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ availability: null, hook: vi.fn() }));
vi.mock("../hooks/useSocialAvailability.js", () => ({ useSocialAvailability: (...args) => { state.hook(...args); return state.availability; } }));
vi.mock("../lib/supabase.js", () => ({ supabase: {} }));
import SocialOverviewExtras from "./SocialOverviewExtras.jsx";
const props = { userId: "me", enrolled: { PM: "A" }, friends: [{ id: "one", cloudId: "one", name: "Meera", courses: { PM: "A" } }], groups: [], allClasses: [{ type: "class", code: "PM", section: "A", date: "2026-11-11", start: "09:00", end: "10:00" }], now: new Date("2026-11-11T10:00:00"), presence: {}, onPlan: vi.fn() };
const render = overrides => renderToStaticMarkup(createElement(SocialOverviewExtras, { ...props, ...overrides }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", { getItem: () => null });
  state.availability = { blocks: [], commitments: [], loaded: true, error: "", refresh: vi.fn() };
});
describe("planning states", () => {
  it("uses one availability subscription for the integrated module and private controls", () => {
    const html = render();
    expect(state.hook).toHaveBeenCalledTimes(1);
    expect(html).toContain("Plan this time"); expect(html).toContain("You + Meera");
    expect(html).toContain("Private busy time"); expect(html).toContain("0 blocks");
    expect(html).toContain("No private blocks yet");
    expect(html).not.toContain('class="fr-private-availability fr-planning-private" open');
  });
  it("keeps filters available while loading and suppresses misleading slot/empty claims", () => {
    state.availability.loaded = false;
    const html = render();
    expect(html).toContain("Checking your timetable"); expect(html).toContain("Plan with");
    expect(html).not.toContain("Plan this time"); expect(html).not.toContain("No matching time");
    expect(html).not.toContain("Your accepted plans and private blocks are checked.");
  });
  it("shows failed checks and retry rather than offering unverified slots", () => {
    state.availability = { ...state.availability, loaded: false, error: "Private blocks could not load" };
    const html = render();
    expect(html).toContain("Retry availability"); expect(html).toContain("Unavailable");
    expect(html).not.toContain("Plan this time"); expect(html).not.toContain("0 blocks");
  });
  it("explains unknown schedules instead of treating them as free time", () => {
    const html = render({ enrolled: { UNKNOWN: "A" } });
    expect(html).toContain("Your timetable is unavailable"); expect(html).not.toContain("Plan this time");
  });
  it("preserves access to private controls when suggestions are hidden", () => {
    vi.stubGlobal("localStorage", { getItem: () => "true" });
    const html = render();
    expect(html).toContain("Show times"); expect(html).toContain("Private busy time");
    expect(html).not.toContain("Plan this time");
  });
});
