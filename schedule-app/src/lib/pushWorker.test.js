import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { buildPushPayload } from "../../supabase/functions/_shared/pushPresentation.ts";

const source = readFileSync(new URL("../../public/push-sw.js", import.meta.url), "utf8");
function worker(maxActions = 2) {
  const handlers = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const matchAll = vi.fn().mockResolvedValue([]);
  const navigator = { setAppBadge: vi.fn().mockResolvedValue(), clearAppBadge: vi.fn().mockResolvedValue() };
  const self = { location: { origin: "https://pgp2.termflow.tech" }, Notification: { maxActions }, registration: { showNotification, getNotifications: vi.fn().mockResolvedValue([]) }, clients: { openWindow, matchAll }, addEventListener: (type, handler) => { handlers[type] = handler; } };
  vm.runInNewContext(source, { self, navigator, URL, Date });
  async function fire(type, event) { let pending; handlers[type]({ ...event, waitUntil: p => { pending = p; } }); await pending; }
  async function push(payload) { await fire("push", { data: { json: () => payload } }); return showNotification.mock.calls.at(-1)[1]; }
  async function click(data, action = "") { const close = vi.fn(); await fire("notificationclick", { action, notification: { data, close } }); expect(close).toHaveBeenCalledOnce(); }
  return { push, click, fire, showNotification, openWindow, matchAll, navigator };
}

describe("push service worker", () => {
  it("renders the current logo, preserves grouping and retains different action destinations", async () => {
    const w = worker();
    const options = await w.push(buildPushPayload({ type: "daily_summary", title: "Today", dedup_key: "summary:1" }));
    expect(options.icon).toBe("/icon-notification.png");
    expect(options.badge).toBe("/badge-notification.png");
    expect(options.tag).toBe("summary:1");
    expect(options.renotify).toBe(false);
    await w.click(options.data, "week");
    expect(w.openWindow).toHaveBeenCalledWith("https://pgp2.termflow.tech/?view=week");
  });
  it("dismisses without opening or navigating the app and resyncs the badge", async () => {
    const w = worker();
    await w.click({ url: "/?view=notifications" }, "dismiss");
    expect(w.openWindow).not.toHaveBeenCalled();
    expect(w.matchAll).not.toHaveBeenCalled();
    expect(w.navigator.clearAppBadge).toHaveBeenCalled();
  });
  it.each([0, 1])("honours a browser action limit of %s while retaining body-tap navigation", async limit => {
    const w = worker(limit);
    const options = await w.push(buildPushPayload({ type: "daily_summary", title: "Today" }));
    expect(options.actions).toHaveLength(limit);
    await w.click(options.data);
    expect(w.openWindow).toHaveBeenCalledWith("https://pgp2.termflow.tech/?view=today");
  });
  it("waits for existing-app navigation before focusing it", async () => {
    const w = worker();
    const order = [];
    const client = { url: "https://pgp2.termflow.tech/", navigate: vi.fn(async () => { order.push("navigate"); return client; }), focus: vi.fn(async () => { order.push("focus"); }) };
    w.matchAll.mockResolvedValue([client]);
    await w.click({ url: "/?view=today" });
    expect(order).toEqual(["navigate", "focus"]);
    expect(w.openWindow).not.toHaveBeenCalled();
  });
  it("falls back to a new window if an existing tab closes during navigation", async () => {
    const w = worker();
    w.matchAll.mockResolvedValue([{ url: "https://pgp2.termflow.tech/", focus: vi.fn(), navigate: vi.fn().mockRejectedValue(new Error("closed")) }]);
    await w.click({ url: "/?view=today" });
    expect(w.openWindow).toHaveBeenCalledOnce();
  });
  it("opens external links separately and rejects executable destinations", async () => {
    const w = worker();
    await w.click({ url: "https://example.com/event" });
    expect(w.matchAll).not.toHaveBeenCalled();
    expect(w.openWindow).toHaveBeenLastCalledWith("https://example.com/event");
    await w.click({ url: "javascript:alert(1)" });
    expect(w.openWindow).toHaveBeenLastCalledWith("https://pgp2.termflow.tech/");
  });
  it("keeps legacy payloads functional without allowing an icon override", async () => {
    const w = worker();
    const options = await w.push({ title: "Reminder", body: "Room 4", url: "/?view=today", cta: "View classes", icon: "/icon-push-clock.png" });
    expect(options.actions[0].title).toBe("View classes");
    expect(options.icon).toBe("/icon-notification.png");
    await w.click(options.data, "open");
    expect(w.openWindow).toHaveBeenCalledWith("https://pgp2.termflow.tech/?view=today");
  });
  it("handles plain text and null payloads without failing display", async () => {
    const w = worker();
    await w.fire("push", { data: { json: () => { throw new Error("text"); }, text: () => "Plain message" } });
    expect(w.showNotification.mock.calls.at(-1)[1].body).toBe("Plain message");
    await w.push(null);
    expect(w.showNotification).toHaveBeenLastCalledWith("TermFlow", expect.anything());
  });
});
