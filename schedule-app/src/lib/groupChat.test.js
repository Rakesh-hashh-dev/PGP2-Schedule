import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
import { editGroupChatMessage, fetchGroupChatMessages, fetchReadableGroupChatMessages, sendGroupChatMessage, sendFriendPing } from "./friends.js";
import { chatDraftKey, loadChatDraft, storeChatDraft, mergeChatMessages, reconcileChatMessages, messageBeforeCursor, messageCursor, visibleReadCursor, firstUnreadMessage } from "./groupChat.js";

beforeEach(() => vi.clearAllMocks());

describe("group chat persistence", () => {
  it("requires the notification acknowledgement in strict friend-request mode while preserving legacy best effort", async () => {
    mocks.from.mockReturnValue({ insert: async () => ({ error: { message: "offline" } }) });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendFriendPing("them", "me", "Me", { fromCode: "code" }, { strict: true, legacyAlreadySaved: true })).rejects.toThrow("confirm");
    await expect(sendFriendPing("them", "me", "Me", { fromCode: "code" })).resolves.toBe(true);
    mocks.from.mockReturnValue({ insert: async () => ({ error: null }) });
    await expect(sendFriendPing("them", "me", "Me", { fromCode: "code" }, { strict: true })).resolves.toBe(true);
    log.mockRestore();
  });
  it("rejects a failed insert so the composer can keep the draft", async () => {
    mocks.from.mockReturnValue({ insert: () => ({ select: () => ({ single: async () => ({ error: { message: "offline" } }) }) }) });
    await expect(sendGroupChatMessage("g", "me", "Me", "Hello")).rejects.toThrow("Could not send");
  });
  it("returns the persisted message without needing a realtime echo", async () => {
    const row = { id: "message", from_id: "me", from_name: "Me", text: "Hello", created_at: "2026-10-12T08:00:00Z" };
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: row, error: null }) }) }));
    mocks.from.mockReturnValue({ insert });
    expect(await sendGroupChatMessage("g", "me", "Me", " Hello ")).toEqual({ id: row.id, from_id: "me", name: "Me", text: "Hello", created_at: row.created_at, reply_to: null });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ text: "Hello" }));
  });
  it("distinguishes failed history loads from an empty chat and does not delete on read", async () => {
    const query = { eq: vi.fn(), order: vi.fn(), limit: vi.fn() };
    query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ error: { message: "unavailable" } });
    const remove = vi.fn();
    mocks.from.mockReturnValue({ select: () => query, delete: remove });
    await expect(fetchGroupChatMessages("g")).rejects.toThrow("Could not load group chat");
    expect(remove).not.toHaveBeenCalled();
    query.limit.mockResolvedValue({ data: [], error: null });
    expect(await fetchGroupChatMessages("g")).toEqual([]);
  });
  it("does not report an edit as saved when no row was updated", async () => {
    const query = { eq: vi.fn(), select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    query.eq.mockReturnValue(query);
    mocks.from.mockReturnValue({ update: () => query });
    expect(await editGroupChatMessage("missing", "me", "Hello")).toBe(false);
  });
});

describe("chat history and read boundaries", () => {
  const row = (id, created_at, extra = {}) => ({ id, created_at, from_id: "other", text: id, ...extra });
  const first = row("00000000-0000-4000-8000-000000000001", "2026-11-11T10:00:00.123456+00:00");
  const second = row("00000000-0000-4000-8000-000000000002", first.created_at);
  const third = row("00000000-0000-4000-8000-000000000003", "2026-11-11T11:00:00Z");
  it("reconciles deleted/hidden loaded rows, keeps older readable history and preserves arrivals during refresh", async () => {
    const arrival = row("new", "2026-11-11T12:00:00Z");
    const checked = [first.id, second.id, third.id];
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const query = { eq: vi.fn(), in: vi.fn().mockResolvedValue({ data: [first, { ...third, text: "Edited while offline" }], error: null }) };
    query.eq.mockReturnValue(query); mocks.from.mockReturnValue({ select: () => query });
    const readable = await fetchReadableGroupChatMessages("g", checked);
    const reconciled = reconcileChatMessages([first, second, third, arrival], checked, readable, [third]);
    expect(reconciled.map(message => message.id)).toEqual([first.id, third.id, arrival.id]);
    expect(query.eq).toHaveBeenCalledWith("moderation_hidden", false);
  });
  it("rejects denied membership and failed refresh reads instead of treating failures as deletions", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(fetchReadableGroupChatMessages("g", [first.id])).rejects.toThrow("access");
    expect(mocks.from).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const query = { eq: vi.fn(), in: vi.fn().mockResolvedValue({ error: { message: "offline" } }) };
    query.eq.mockReturnValue(query); mocks.from.mockReturnValue({ select: () => query });
    await expect(fetchReadableGroupChatMessages("g", [first.id])).rejects.toThrow("refresh loaded chat");
  });
  it("uses timestamp plus id for stable tied pages and preserves database precision", () => {
    expect(messageBeforeCursor(messageCursor(second))).toBe(`created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${second.id})`);
    expect(() => messageBeforeCursor({ id: "bad),id.gt.0", createdAt: first.created_at })).toThrow();
  });
  it("fetches the newest bounded page and reverses it for display, with an older cursor", async () => {
    const query = { eq: vi.fn(), order: vi.fn(), limit: vi.fn(), or: vi.fn() };
    Object.values(query).forEach(method => method.mockReturnValue(query));
    query.then = resolve => resolve({ data: [second, first], error: null });
    mocks.from.mockReturnValue({ select: () => query });
    expect((await fetchGroupChatMessages("g", { before: messageCursor(third) })).map(message => message.id)).toEqual([first.id, second.id]);
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(query.order).toHaveBeenCalledWith("id", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(40);
    expect(query.or).toHaveBeenCalledWith(messageBeforeCursor(messageCursor(third)));
  });
  it("merges realtime and refreshed pages without losing loaded older rows or duplicating echoes", () => {
    const merged = mergeChatMessages([third, second, first], [{ ...second, text: "edited" }, third]);
    expect(merged.map(message => message.id)).toEqual([first.id, second.id, third.id]);
    expect(merged[1].text).toBe("edited");
  });
  it("does not advance a timestamp cursor across unseen ties or unloaded unread history", () => {
    const visible = new Set([second.id, third.id]);
    expect(visibleReadCursor([first, second, third], visible, null, false)).toBeNull();
    visible.add(first.id);
    expect(visibleReadCursor([first, second, third], visible, null, true)).toBeNull();
    expect(visibleReadCursor([first, second, third], visible, null, false)).toBe(third.created_at);
    expect(visibleReadCursor([first, second, third], new Set([third.id]), first.created_at, true)).toBe(third.created_at);
  });
  it("places the unread divider at the first unread incoming row", () => {
    expect(firstUnreadMessage([{ ...first, from_id: "me" }, second, third], "me", null)).toBe(second.id);
    expect(firstUnreadMessage([first, second, third], "me", third.created_at)).toBeNull();
  });
  it("persists reply metadata through the insert and rejects failed replies", async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { ...third, reply_to: first.id }, error: null }) }) }));
    mocks.from.mockReturnValue({ insert });
    const result = await sendGroupChatMessage("g", "me", "Me", "Reply", first.id);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ reply_to: first.id }));
    expect(result.reply_to).toBe(first.id);
    mocks.from.mockReturnValue({ insert: () => ({ select: () => ({ single: async () => ({ error: { message: "foreign reply" } }) }) }) });
    await expect(sendGroupChatMessage("g", "me", "Me", "Keep this draft", first.id)).rejects.toThrow();
  });
  it("scopes saved drafts and reply targets to both account and group", () => {
    const storage = new Map();
    vi.stubGlobal("localStorage", { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) });
    storeChatDraft("me", "g", { text: "Unsent", replyTo: first.id });
    expect(loadChatDraft("me", "g")).toEqual({ text: "Unsent", replyTo: first.id });
    expect(loadChatDraft("other", "g").text).toBe("");
    expect(loadChatDraft("me", "other").text).toBe("");
    expect(chatDraftKey("a:b", "c")).not.toBe(chatDraftKey("a", "b:c"));
    storeChatDraft("me", "g", { text: "", replyTo: null });
    expect(loadChatDraft("me", "g").text).toBe("");
  });
});
