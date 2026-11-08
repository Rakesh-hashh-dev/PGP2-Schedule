import { describe, expect, it, vi, afterEach } from "vitest";
import { reminderHistory, reminderNotes, reminderStage } from "./classNoteReminder.js";

const session = { type: "class", date: "2026-11-04", start: "10:00", code: "DSC", section: "A" };
const note = (id, key, extra = {}) => ({ id, kind: "note", term: "5", code: "DSC", sessionKey: key, ...extra });
afterEach(() => vi.unstubAllGlobals());

describe("class note reminders", () => {
  it("prefers this session and excludes deleted notes, other courses and other terms", () => {
    const exact = note("exact", "2026-11-04_10:00_DSC_A");
    const items = [exact, note("old", "2026-11-03_10:00_DSC_A"), { ...exact, id: "deleted", deleted: true }, { ...exact, id: "term", term: "4" }, { ...exact, id: "other", code: "SOM" }];
    expect(reminderNotes(session, items, 5)).toEqual({ notes: [exact], previous: false });
  });
  it("uses only the most recent earlier class in the same section", () => {
    const latest = note("latest", "2026-11-03_10:00_DSC_A");
    expect(reminderNotes(session, [latest, note("old", "2026-11-01_10:00_DSC_A"), note("future", "2026-11-05_10:00_DSC_A"), note("other-section", "2026-11-04_09:00_DSC_B"), note("same-time", "2026-11-04_10:00_DSC_Single")], 5)).toEqual({ notes: [latest], previous: true });
  });
  it("shows once on entry and once within 20 minutes, stopping after opening or class start", () => {
    expect(reminderStage(session, new Date("2026-11-04T09:00:00"))).toBe("entry");
    expect(reminderStage(session, new Date("2026-11-04T09:01:00"), { entry: true })).toBeNull();
    expect(reminderStage(session, new Date("2026-11-04T09:40:00"), { entry: true })).toBe("soon");
    expect(reminderStage(session, new Date("2026-11-04T09:41:00"), { entry: true, soon: true })).toBeNull();
    expect(reminderStage(session, new Date("2026-11-04T09:45:00"), { opened: true })).toBeNull();
    expect(reminderStage(session, new Date("2026-11-04T10:00:00"))).toBeNull();
    expect(reminderStage({ ...session, type: "cancelled" }, new Date("2026-11-04T09:45:00"))).toBeNull();
    expect(reminderStage({ ...session, session: "Quiz" }, new Date("2026-11-04T09:45:00"))).toBeNull();
  });
  it("retains suppression across remounts, isolates users and terms, and expires each day", () => {
    const storage = new Map();
    vi.stubGlobal("localStorage", { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) });
    reminderHistory("alice:5", session.date, { key: "class1", record: { entry: true } });
    reminderHistory("alice:5", session.date, { key: "class1", record: { opened: true } });
    expect(reminderHistory("alice:5", session.date).class1).toEqual({ entry: true, opened: true });
    expect(reminderHistory("bob:5", session.date)).toEqual({});
    expect(reminderHistory("alice:6", session.date)).toEqual({});
    expect(reminderHistory("alice:5", "2026-11-05")).toEqual({});
  });
  it("still suppresses repeats if device storage is blocked", () => {
    vi.stubGlobal("localStorage", { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } });
    reminderHistory("blocked:5", session.date, { key: "class1", record: { soon: true } });
    expect(reminderHistory("blocked:5", session.date).class1.soon).toBe(true);
  });
});
