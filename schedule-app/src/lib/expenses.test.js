import { describe, it, expect } from "vitest";
import {
  toPaise,
  toRupees,
  fmtMoney,
  resolveSplit,
  computeBalances,
  simplifyDebts,
  pairwiseDebts,
  pairwiseForMember,
  groupInsights,
} from "./expenses.js";

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

describe("money helpers", () => {
  it("converts rupees <-> paise", () => {
    expect(toPaise(123.45)).toBe(12345);
    expect(toPaise("10")).toBe(1000);
    expect(toRupees(12345)).toBe(123.45);
  });
  it("formats paise, trimming .00 and handling negatives", () => {
    expect(fmtMoney(12345)).toBe("₹123.45");
    expect(fmtMoney(10000)).toBe("₹100");
    expect(fmtMoney(-5000)).toBe("−₹50");
  });
});

describe("resolveSplit", () => {
  it("rejects an empty participant list", () => {
    expect(resolveSplit("equal", 1000, []).error).toBeTruthy();
  });

  it("splits equally and conserves every paise", () => {
    // 100.00 across 3 → 33.34 / 33.33 / 33.33 (leftover paise to first)
    const { shares, error } = resolveSplit("equal", 10000, ["a", "b", "c"]);
    expect(error).toBeUndefined();
    expect(sum(shares)).toBe(10000);
    expect(shares.a).toBe(3334);
    expect(shares.b).toBe(3333);
    expect(shares.c).toBe(3333);
  });

  it("accepts exact amounts that add to the total", () => {
    const { shares, error } = resolveSplit("exact", 10000, ["a", "b"], { a: 60, b: 40 });
    expect(error).toBeUndefined();
    expect(shares).toEqual({ a: 6000, b: 4000 });
  });
  it("errors when exact amounts do not add up", () => {
    const { error } = resolveSplit("exact", 10000, ["a", "b"], { a: 60, b: 30 });
    expect(error).toBeTruthy();
  });

  it("splits by percent and requires 100%", () => {
    const ok = resolveSplit("percent", 10000, ["a", "b"], { a: 50, b: 50 });
    expect(ok.error).toBeUndefined();
    expect(sum(ok.shares)).toBe(10000);
    expect(resolveSplit("percent", 10000, ["a", "b"], { a: 50, b: 40 }).error).toBeTruthy();
  });

  it("splits by shares proportionally and conserves the total", () => {
    const { shares, error } = resolveSplit("shares", 10000, ["a", "b"], { a: 3, b: 1 });
    expect(error).toBeUndefined();
    expect(sum(shares)).toBe(10000);
    expect(shares.a).toBe(7500);
    expect(shares.b).toBe(2500);
  });
  it("errors when no share weight is given", () => {
    expect(resolveSplit("shares", 10000, ["a", "b"], { a: 0, b: 0 }).error).toBeTruthy();
  });

  it("never loses or invents paise on awkward totals (property check)", () => {
    for (const total of [1, 7, 9999, 10001, 33333]) {
      for (const n of [1, 2, 3, 5, 7]) {
        const ids = Array.from({ length: n }, (_, i) => "u" + i);
        const { shares } = resolveSplit("equal", total, ids);
        expect(sum(shares)).toBe(total);
      }
    }
  });
});

describe("computeBalances", () => {
  it("nets what each member paid against what they owe", () => {
    // a pays 100, split equally between a and b → b owes a 50
    const expenses = [{ id: "e1", amount: 100, paid_by: "a" }];
    const shares = { e1: [{ user_id: "a", amount: 50 }, { user_id: "b", amount: 50 }] };
    const bal = computeBalances(expenses, shares, [], ["a", "b"]);
    expect(bal.a).toBe(5000);
    expect(bal.b).toBe(-5000);
    expect(sum(bal)).toBe(0);
  });

  it("applies settlements", () => {
    const expenses = [{ id: "e1", amount: 100, paid_by: "a" }];
    const shares = { e1: [{ user_id: "a", amount: 50 }, { user_id: "b", amount: 50 }] };
    const settlements = [{ from_user: "b", to_user: "a", amount: 50 }];
    const bal = computeBalances(expenses, shares, settlements, ["a", "b"]);
    expect(bal.a).toBe(0);
    expect(bal.b).toBe(0);
  });

  it("shows every member even at zero", () => {
    const bal = computeBalances([], {}, [], ["a", "b", "c"]);
    expect(Object.keys(bal).sort()).toEqual(["a", "b", "c"]);
    expect(sum(bal)).toBe(0);
  });
});

describe("simplifyDebts", () => {
  it("collapses a chain into the fewest transfers", () => {
    // a is owed 100, b owes 60, c owes 40
    const transfers = simplifyDebts({ a: 10000, b: -6000, c: -4000 });
    // everyone pays a, total 100
    expect(transfers.every(t => t.to === "a")).toBe(true);
    expect(transfers.reduce((s, t) => s + t.amount, 0)).toBe(10000);
    expect(transfers.length).toBe(2);
  });

  it("conserves money: transfers zero out the balances", () => {
    const balances = { a: 7000, b: -2500, c: -4500 };
    const transfers = simplifyDebts(balances);
    const applied = { ...balances };
    for (const t of transfers) {
      applied[t.from] += t.amount;
      applied[t.to] -= t.amount;
    }
    expect(Object.values(applied).every(v => v === 0)).toBe(true);
  });

  it("returns nothing when all settled", () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });
});

describe("pairwiseDebts", () => {
  it("nets a two-way debt into a single direction", () => {
    // a paid e1 (b owes a 50); b paid e2 (a owes b 20) → net b owes a 30
    const expenses = [
      { id: "e1", amount: 100, paid_by: "a" },
      { id: "e2", amount: 40, paid_by: "b" },
    ];
    const shares = {
      e1: [{ user_id: "a", amount: 50 }, { user_id: "b", amount: 50 }],
      e2: [{ user_id: "a", amount: 20 }, { user_id: "b", amount: 20 }],
    };
    const debts = pairwiseDebts(expenses, shares, []);
    expect(debts).toEqual([{ from: "b", to: "a", amount: 3000 }]);
  });
});

describe("pairwiseForMember", () => {
  it("separates what I owe from what I'm owed", () => {
    const transfers = [
      { from: "me", to: "a", amount: 3000 },
      { from: "b", to: "me", amount: 5000 },
    ];
    const r = pairwiseForMember(transfers, "me");
    expect(r.oweTotal).toBe(3000);
    expect(r.owedTotal).toBe(5000);
    expect(r.net).toBe(2000);
  });
});

describe("groupInsights", () => {
  it("totals spend by category and by payer", () => {
    const expenses = [
      { id: "e1", amount: 100, paid_by: "a", category: "food" },
      { id: "e2", amount: 50, paid_by: "b", category: "travel" },
      { id: "e3", amount: 25, paid_by: "a", category: "food" },
    ];
    const r = groupInsights(expenses, ["a", "b"]);
    expect(r.total).toBe(17500);
    expect(r.count).toBe(3);
    expect(r.paidByMember.a).toBe(12500);
    expect(r.paidByMember.b).toBe(5000);
    expect(r.categories[0]).toEqual({ id: "food", paise: 12500 });
  });
});
