import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
import { normalizeBuddyPreferences, matchBuddy, hydrateBuddyPreferenceSession, saveDiscoveryOptOut } from "./buddyPreferences.js";
beforeEach(() => vi.clearAllMocks());
describe("Study preferences", () => {
  it("does not restore stale consent when initial hydration resolves after a later save", async () => {
    let resolveHydration;
    const deferred = new Promise(resolve => { resolveHydration = resolve; });
    const session = { userId: "me", revision: 0 };
    let displayed;
    const hydration = hydrateBuddyPreferenceSession(session, { load: () => deferred, isCurrent: () => true, onHydrated: value => { displayed = value; } });
    // This is the successful onSaved mutation contract used by FriendsPanel.
    ++session.revision;
    displayed = normalizeBuddyPreferences({ discoverable: false, purposes: ["Revision"] });
    resolveHydration({ discoverable: true, purposes: ["Interview practice"] });
    expect(await hydration).toBe(false);
    expect(displayed.discoverable).toBe(false);
    expect(displayed.purposes).toEqual(["Revision"]);
  });
  it("suppresses hydration from a previous account and stale failed hydration after saving", async () => {
    let resolveHydration; let rejectHydration;
    const session = { userId: "old", revision: 0 };
    const onHydrated = vi.fn(); let current = true;
    const hydration = hydrateBuddyPreferenceSession(session, { load: () => new Promise(resolve => { resolveHydration = resolve; }), isCurrent: () => current, onHydrated });
    current = false; resolveHydration({ discoverable: true });
    expect(await hydration).toBe(false); expect(onHydrated).not.toHaveBeenCalled();
    const failed = hydrateBuddyPreferenceSession(session, { load: () => new Promise((_, reject) => { rejectHydration = reject; }), isCurrent: () => true, onHydrated });
    ++session.revision; rejectHydration(new Error("old request failed"));
    expect(await failed).toBe(false);
  });
  it("hydrates current untouched preferences normally", async () => {
    const onHydrated = vi.fn();
    expect(await hydrateBuddyPreferenceSession({ userId: "me", revision: 0 }, { load: async () => ({ discoverable: true }), isCurrent: () => true, onHydrated })).toBe(true);
    expect(onHydrated).toHaveBeenCalledWith(normalizeBuddyPreferences({ discoverable: true }));
  });
  it("updates only the hidden key through its atomic RPC and requires the exact acknowledgement", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { saved: true, hidden: true }, error: null });
    expect(await saveDiscoveryOptOut(true)).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("social_set_discovery_opt_out", { p_hidden: true });
    expect(mocks.from).not.toHaveBeenCalled();
    for (const result of [{ data: { saved: false, hidden: true } }, { data: { saved: true, hidden: false } }, { data: null }, { data: { saved: true, hidden: true }, error: { message: "denied" } }]) {
      mocks.rpc.mockResolvedValueOnce(result);
      await expect(saveDiscoveryOptOut(true)).rejects.toThrow("confirm");
    }
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not update a newly selected account after the async adapter loads", async () => {
    expect(await saveDiscoveryOptOut(true, { isCurrent: () => false })).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("normalizes bounded inputs and ignores unsupported purposes", () => {
    expect(normalizeBuddyPreferences({ subjects: [" PM ", "PM", 2], interests: [" Finance ", "Finance"], purposes: ["Revision", "Other"], discoverable: "yes" })).toEqual({ subjects: ["PM"], interests: ["Finance"], purposes: ["Revision"], discoverable: false });
  });
  it("explains course and optional preference matches separately", () => {
    const mine = { purposes: ["Interview practice"], interests: ["Product Management"], discoverable: true };
    const theirs = { purposes: ["Interview practice"], interests: ["product management"], discoverable: true };
    const match = matchBuddy({ PM: "A" }, { FIN: "B" }, mine, theirs);
    expect(match.score).toBe(0); expect(match.eligible).toBe(true); expect(match.reasons.join(" ")).toContain("Interview practice"); expect(match.reasons.join(" ")).toContain("Product Management");
  });
  it("does not use preferences when either student has opted out", () => {
    const pref = { purposes: ["Revision"], discoverable: true };
    expect(matchBuddy({ PM: "A" }, { FIN: "B" }, pref, { ...pref, discoverable: false }).eligible).toBe(false);
    expect(matchBuddy({ PM: "A", _name: "Me" }, { PM: "B", _status: {} }, null, null).score).toBe(100);
  });
});
