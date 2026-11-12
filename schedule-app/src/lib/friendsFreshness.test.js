import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: { from: mocks.from } }));
import { refreshFriendCoursesFromCloud } from "./friends.js";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("friend source freshness", () => {
 it("records successful checks even when enrollment is unchanged, retaining authoritative source timestamp", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-11T10:00:00Z"));
  vi.stubGlobal("localStorage", { setItem: vi.fn() });
  const select = vi.fn(() => ({ in: async () => ({ data: [{ user_id: "friend", courses: { PM: "A", _name: "Friend" }, updated_at: "2026-10-01T10:00:00Z" }], error: null }) }));
  mocks.from.mockReturnValue({ select });
  const updated = await refreshFriendCoursesFromCloud([{ id: "1", cloudId: "friend", name: "Friend", courses: { PM: "A" }, updatedAt: "not-a-source-time" }]);
  expect(updated[0].profileUpdatedAt).toBe("2026-10-01T10:00:00Z"); expect(updated[0].lastCheckedAt).toBe("2026-11-11T10:00:00.000Z"); expect(updated[0].updatedAt).toBe("not-a-source-time");
  expect(select).toHaveBeenCalledWith("user_id, courses, updated_at");
 });
});
