import { describe, it, expect } from "vitest";
import { itemizedSplit, convertSplit, validDate, nextOccurrence, parseReceipt, analytics, balancesByCurrency, exportCSV, reviewCSV } from "./splitCircle.js";
const group = { id: "g", currency: "₹", member_ids: ["a", "b"], member_names: { a: "Alice", b: "Bob" } };
const expense = (overrides = {}) => ({ id: "e", description: "Meal", amount: 100, paid_by: "a", created_at: "2026-10-10T05:00:00Z", expense_date: "2026-10-10", category: "food", group, shares: [{ user_id: "a", amount: 50 }, { user_id: "b", amount: 50 }], ...overrides });
describe("itemized splits", () => {
  it("assigns items to their participants and prorates tax", () => {
    const r = itemizedSplit([{ name: "Pizza", amount: 100, members: ["a", "b"] }, { name: "Coffee", amount: 50, members: ["a"] }], 15, ["a", "b"]);
    expect(r).toEqual({ total: 16500, shares: { a: 11000, b: 5500 } });
  });
  it("conserves tiny amounts and negative discounts", () => {
    expect(itemizedSplit([{ name: "Test", amount: 0.03, members: ["b", "a"] }], -0.01, ["b", "a"]).shares).toEqual({ a: 1, b: 1 });
  });
  it("rejects unknown members, empty assignments and excessive discounts", () => {
    expect(() => itemizedSplit([{ name: "Meal", amount: 10, members: ["eve"] }], 0, ["a"])).toThrow();
    expect(() => itemizedSplit([{ name: "Meal", amount: 10, members: [] }], 0, ["a"])).toThrow();
    expect(() => itemizedSplit([{ name: "Meal", amount: 10, members: ["a"] }], -11, ["a"])).toThrow();
  });
});
describe("foreign currency", () => {
  it("uses deterministic rounding matching the database", () => {
    expect(convertSplit({ b: 5000, a: 5000 }, 83.3333)).toEqual({ total: 833333, shares: { a: 416667, b: 416666 } });
  });
  it("rejects unsafe totals and excessive rate precision", () => {
    expect(() => convertSplit({ a: 999999999999 }, 1000000)).toThrow();
    expect(() => convertSplit({ a: 1000 }, 0.123456789)).toThrow();
    expect(() => convertSplit({ a: 1000 }, 0)).toThrow();
  });
  it("conserves every paise across 1000 currency conversions", () => {
    for (let i = 1; i <= 1000; i++) { const r = convertSplit({ a: i, b: i * 3, c: i * 2 }, 83.17234567); expect(Object.values(r.shares).reduce((a, b) => a + b, 0)).toBe(r.total); }
  });
});
describe("dates and recurrence", () => {
  it("validates actual calendar dates", () => { expect(validDate("2024-02-29")).toBe(true); expect(validDate("2026-02-29")).toBe(false); expect(validDate("2026-99-99")).toBe(false); });
  it("preserves the month-end anchor", () => { const next = nextOccurrence("2026-01-31", "monthly"); expect(next).toBe("2026-02-28"); expect(nextOccurrence(next, "monthly", "2026-01-31")).toBe("2026-03-31"); expect(nextOccurrence("2026-12-28", "weekly")).toBe("2027-01-04"); });
});
describe("receipt review", () => {
  it("separates items, tax, discount and printed total", () => { const r = parseReceipt("Pizza 100.00\nGST 5.00\nDiscount 10.00\nTotal 95.00", ["a", "b"]); expect(r.items).toHaveLength(1); expect(r.adjustment).toBe(-5); expect(r.printedTotal).toBe(95); });
});
describe("analytics", () => {
  it("uses personal shares and expense dates", () => { const r = analytics([expense({ created_at: "2026-09-01T00:00:00Z" })], "a", "2026-10"); expect(r.total).toBe(5000); expect(r.daily[9]).toBe(5000); });
  it("keeps currencies separate in spending and balances", () => {
    const usd = { ...group, id: "h", currency: "$" }, entries = [expense(), expense({ id: "x", group: usd, amount: 200, shares: [{ user_id: "a", amount: 100 }, { user_id: "b", amount: 100 }] })];
    expect(analytics(entries, "a", "2026-10").total).toBe(5000);
    const ledgers = { g: { expenses: [expense()], sharesByExpense: { e: entries[0].shares }, settlements: [] }, h: { expenses: [entries[1]], sharesByExpense: { x: entries[1].shares }, settlements: [] } };
    expect(balancesByCurrency([group, usd], ledgers, "a")).toEqual({ INR: { net: 5000, owed: 5000, owe: 0 }, USD: { net: 10000, owed: 10000, owe: 0 } });
  });
});
describe("CSV import/export", () => {
  it("round trips shares, dates, payer and quoted descriptions", () => { const e = expense({ description: 'Meal, with "friends"' }); const rows = reviewCSV(exportCSV([e]), group, "a"); expect(rows[0].description).toBe(e.description); expect(rows[0].shares).toEqual({ a: 5000, b: 5000 }); expect(rows[0].paidBy).toBe("a"); expect(rows[0].date).toBe("2026-10-10"); });
  it("skips previously exported records", () => { expect(reviewCSV(exportCSV([expense()]), group, "a", [expense()])[0].duplicate).toBe(true); });
  it("rejects invalid dates and outside participants", () => { expect(() => reviewCSV("description,amount,date\nMeal,10,2026-02-30", group, "a")).toThrow(); expect(() => reviewCSV("description,amount,date,paid_by\nMeal,10,2026-10-10,eve", group, "a")).toThrow(); });
  it("protects spreadsheet formula cells", () => { expect(exportCSV([expense({ description: "=HYPERLINK(1)" })])).toContain("'=HYPERLINK(1)"); });
});
