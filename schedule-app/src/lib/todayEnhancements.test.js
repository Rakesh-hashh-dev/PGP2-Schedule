import { describe, expect, it } from "vitest";
import { buildTodayCommandState, findRoomTransition, flattenPendingAssignments, readTodayGoals, writeTodayGoals } from "./todayEnhancements.js";

const session = (start, end, room = "A", code = "CRM") => ({ date: "2026-09-30", start, end, room, code, name: code, section: "Single", type: "class" });

describe("Today command centre", () => {
  it("builds progress, unmarked attendance and next-class state", () => {
    const first = session("09:00", "10:00");
    const second = session("11:00", "12:00", "B", "ECOM");
    const state = buildTodayCommandState({ todayList: [first, second], attendance: {}, now: new Date(2026, 8, 30, 10, 30), assignments: { ECOM: [{ id: "1", title: "Case", dueDate: "2026-10-01", completed: false }] } });
    expect(state.unmarked).toHaveLength(1);
    expect(state.next.code).toBe("ECOM");
    expect(state.minutesToNext).toBe(30);
    expect(state.nextTask.title).toBe("Case");
    expect(state.progress).toBe(50);
  });

  it("detects a tight room transition", () => {
    const transition = findRoomTransition([session("09:00", "10:00", "A"), session("10:10", "11:10", "B", "MKT")], new Date(2026, 8, 30, 9, 50));
    expect(transition).toMatchObject({ gap: 10, minutesToNext: 20 });
  });

  it("sorts only pending assignments", () => {
    expect(flattenPendingAssignments({ CRM: [{ id: "1", dueDate: "2026-10-03" }, { id: "2", dueDate: "2026-10-01", completed: true }], MKT: [{ id: "3", dueDate: "2026-10-02" }] }).map(item => item.id)).toEqual(["3", "1"]);
  });

  it("stores at most three goals for one date", () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
    writeTodayGoals("2026-09-30", [1, 2, 3, 4], storage);
    expect(readTodayGoals("2026-09-30", storage)).toEqual([1, 2, 3]);
  });
});
