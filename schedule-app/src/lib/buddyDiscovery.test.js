import { beforeEach, describe, expect, it, vi } from "vitest";
const requestMocks = vi.hoisted(() => ({ code: vi.fn(), pending: vi.fn(), send: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: {} }));
vi.mock("./friends.js", async importOriginal => ({ ...await importOriginal(), getOrCreateShareCode: requestMocks.code, hasPendingFriendRequest: requestMocks.pending, sendFriendPing: requestMocks.send }));
import { loadStudyIntents, updateStudyIntent, readyStudyIntents, filterBuddyMatches, buddySharedSlot, loadDiscoveryOptOut, requestBuddyConnection } from "./buddyDiscovery.js";
import { matchBuddy } from "./buddyPreferences.js";
const now = new Date("2026-11-11T10:00:00");
beforeEach(() => {
  vi.clearAllMocks();
  const storage = new Map();
  vi.stubGlobal("localStorage", { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
});
describe("buddy discovery consent and follow-up", () => {
  it("requires a strict saved acknowledgement before offering a study follow-up", async () => {
    requestMocks.pending.mockResolvedValue(false); requestMocks.code.mockResolvedValue("share-code"); requestMocks.send.mockRejectedValueOnce(new Error("offline"));
    const request = { userId: "me", userName: "Me", candidate: { user_id: "candidate", name: "Meera" } };
    await expect(requestBuddyConnection(request)).rejects.toThrow("offline");
    expect(loadStudyIntents("me", now)).toEqual([]);
    requestMocks.send.mockResolvedValueOnce(undefined);
    await expect(requestBuddyConnection(request)).rejects.toThrow("confirm");
    requestMocks.send.mockResolvedValueOnce(true);
    expect(await requestBuddyConnection(request)).toEqual({ saved: true, alreadySent: false });
    expect(requestMocks.send).toHaveBeenLastCalledWith("candidate", "me", "Me", { type: "friend_request", fromCode: "share-code" }, { strict: true, legacyAlreadySaved: false });
    expect(loadStudyIntents("me", now)).toEqual([]);
  });
  it("repairs an existing legacy request through the strict notification path and aborts account changes", async () => {
    requestMocks.pending.mockResolvedValue(true); requestMocks.code.mockResolvedValue("code"); requestMocks.send.mockResolvedValue(true);
    const request = { userId: "me", candidate: { user_id: "candidate" } };
    expect(await requestBuddyConnection({ ...request, isCurrent: () => false })).toBeNull();
    expect(requestMocks.send).not.toHaveBeenCalled();
    expect((await requestBuddyConnection(request)).alreadySent).toBe(true);
    expect(requestMocks.send).toHaveBeenLastCalledWith("candidate", "me", undefined, expect.any(Object), { strict: true, legacyAlreadySaved: true });
  });
  it("filters only shared courses and mutually consented purposes", () => {
    const prefs = { discoverable: true, purposes: ["Revision"] };
    const visible = { user_id: "one", ...matchBuddy({ PM: "A" }, { PM: "B" }, prefs, prefs) };
    const privateMatch = { user_id: "two", ...matchBuddy({ PM: "A" }, { PM: "B" }, prefs, { ...prefs, discoverable: false }) };
    expect(filterBuddyMatches([visible, privateMatch], { course: "PM", purpose: "Revision" })).toEqual([visible]);
    expect(privateMatch.sharedPurposes).toEqual([]);
    expect(filterBuddyMatches([visible], { course: "FIN" })).toEqual([]);
  });
  it("stores an expiring account/candidate intent without treating requests as friendships", () => {
    const rows = updateStudyIntent("me", { user_id: "candidate", name: "Meera" }, now);
    expect(loadStudyIntents("other", now)).toEqual([]);
    expect(readyStudyIntents(rows, [], "me", now)).toEqual([]);
    expect(readyStudyIntents(rows, [{ cloudId: "candidate", name: "Meera" }], "me", now)).toHaveLength(1);
    expect(readyStudyIntents(rows, [{ cloudId: "candidate" }], "other", now)).toEqual([]);
    expect(loadStudyIntents("me", new Date(now.getTime() + 8 * 86400000))).toEqual([]);
    updateStudyIntent("me", { user_id: "candidate", name: "Meera" }, now, true);
    expect(loadStudyIntents("me", now)).toEqual([]);
  });
  it("deduplicates candidate intents and separates cached visibility by account", () => {
    updateStudyIntent("me", { user_id: "one", name: "A" }, now);
    updateStudyIntent("me", { user_id: "one", name: "A" }, now);
    expect(loadStudyIntents("me", now)).toHaveLength(1);
    localStorage.setItem("pgp2.opt-out-matchmaker:me", "true");
    expect(loadDiscoveryOptOut("me")).toBe(true); expect(loadDiscoveryOptOut("other")).toBe(false);
  });
  it("uses fresh timetable gaps and the current user's accepted/private commitments", () => {
    const candidate = { user_id: "one", name: "Meera", courses: { PM: "A" } };
    const allClasses = [{ type: "class", code: "PM", section: "A", date: "2026-11-11", start: "09:00", end: "10:00" }];
    const args = { candidate, enrolled: { PM: "A" }, allClasses, now, userId: "me" };
    expect(buddySharedSlot(args).start).toBe("10:00");
    const blocked = buddySharedSlot({ ...args, commitments: [{ startsAt: "2026-11-11T10:00:00", endsAt: "2026-11-11T13:00:00" }] });
    expect(blocked.start).toBe("13:00");
    expect(buddySharedSlot({ ...args, candidate: { ...candidate, courses: {} } })).toBeNull();
  });
});
