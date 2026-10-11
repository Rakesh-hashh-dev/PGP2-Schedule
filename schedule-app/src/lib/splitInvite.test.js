import { describe, expect, it } from "vitest";
import { rememberSplitInvite, pendingSplitInvite, clearSplitInvite } from "./splitInvite.js";
function storage() { const values = new Map(); return { setItem: (k, v) => values.set(k, v), getItem: k => values.get(k), removeItem: k => values.delete(k) }; }
describe("Split invitation login handoff", () => {
  it("retains a secure invitation across the OAuth reload and clears it after consumption", () => { const s = storage(), token = "a".repeat(64); expect(rememberSplitInvite(token, s)).toBe(true); expect(pendingSplitInvite(s)).toBe(token); clearSplitInvite(s); expect(pendingSplitInvite(s)).toBe(null); });
  it("retains legacy group links before the migration", () => { const s = storage(), id = "00000000-0000-4000-8000-000000000001"; expect(rememberSplitInvite(id, s)).toBe(true); expect(pendingSplitInvite(s)).toBe(id); });
  it("rejects malformed tokens without replacing a valid invitation", () => { const s = storage(), token = "b".repeat(64); rememberSplitInvite(token, s); expect(rememberSplitInvite("https://other.example/", s)).toBe(false); expect(pendingSplitInvite(s)).toBe(token); });
  it("handles unavailable storage without blocking the current invitation", () => { const s = { setItem() { throw new Error("blocked"); }, getItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } }; expect(rememberSplitInvite("a".repeat(64), s)).toBe(true); expect(pendingSplitInvite(s)).toBe(null); expect(() => clearSplitInvite(s)).not.toThrow(); });
});
