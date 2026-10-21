import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: { from: mocks.from } }));
import { editGroupChatMessage, fetchGroupChatMessages, sendGroupChatMessage } from "./friends.js";

beforeEach(() => vi.clearAllMocks());

describe("group chat persistence", () => {
  it("rejects a failed insert so the composer can keep the draft", async () => {
    mocks.from.mockReturnValue({ insert: () => ({ select: () => ({ single: async () => ({ error: { message: "offline" } }) }) }) });
    await expect(sendGroupChatMessage("g", "me", "Me", "Hello")).rejects.toThrow("Could not send");
  });
  it("returns the persisted message without needing a realtime echo", async () => {
    const row = { id: "message", from_id: "me", from_name: "Me", text: "Hello", created_at: "2026-10-12T08:00:00Z" };
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: row, error: null }) }) }));
    mocks.from.mockReturnValue({ insert });
    expect(await sendGroupChatMessage("g", "me", "Me", " Hello ")).toEqual({ id: row.id, from_id: "me", name: "Me", text: "Hello", created_at: row.created_at });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ text: "Hello" }));
  });
  it("distinguishes failed history loads from an empty chat and does not delete on read", async () => {
    const query = { eq: vi.fn(), gte: vi.fn(), order: vi.fn() };
    query.eq.mockReturnValue(query); query.gte.mockReturnValue(query);
    query.order.mockResolvedValue({ error: { message: "unavailable" } });
    const remove = vi.fn();
    mocks.from.mockReturnValue({ select: () => query, delete: remove });
    await expect(fetchGroupChatMessages("g")).rejects.toThrow("Could not load group chat");
    expect(remove).not.toHaveBeenCalled();
    query.order.mockResolvedValue({ data: [], error: null });
    expect(await fetchGroupChatMessages("g")).toEqual([]);
  });
  it("does not report an edit as saved when no row was updated", async () => {
    const query = { eq: vi.fn(), select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    query.eq.mockReturnValue(query);
    mocks.from.mockReturnValue({ update: () => query });
    expect(await editGroupChatMessage("missing", "me", "Hello")).toBe(false);
  });
});
