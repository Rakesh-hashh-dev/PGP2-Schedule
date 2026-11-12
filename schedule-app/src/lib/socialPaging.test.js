import { describe, expect, it, vi } from "vitest";
import { fetchAllSocialRows } from "./socialPaging.js";

describe("complete social reads", () => {
  it("refuses a partial success when a later page fails", async () => {
    const range = vi.fn().mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }] }).mockResolvedValueOnce({ data: null, error: { message: "Offline" } });
    await expect(fetchAllSocialRows(() => ({ range }), "Could not verify plans.", 2)).rejects.toThrow("Could not verify plans");
    expect(range.mock.calls).toEqual([[0, 1], [2, 3]]);
  });
  it("reports safety-cap exhaustion explicitly instead of returning truncated commitments", async () => {
    const range = vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });
    await expect(fetchAllSocialRows(() => ({ range }), "Could not verify plans.", 2, 4)).rejects.toThrow("Too many records to verify completely");
  });
});
