import { describe, expect, it } from "vitest";
import { MOBILE_UI_VERSION_KEY, readMobileUiVersion } from "./useMobileUiVersion.js";

function storageWith(value) {
  return { getItem: (key) => key === MOBILE_UI_VERSION_KEY ? value : null };
}

describe("readMobileUiVersion", () => {
  it("keeps the existing mobile UI as the safe default", () => {
    expect(readMobileUiVersion(storageWith(null))).toBe("v1");
  });

  it("restores V2 when explicitly selected", () => {
    expect(readMobileUiVersion(storageWith("v2"))).toBe("v2");
  });

  it("rejects unknown stored values", () => {
    expect(readMobileUiVersion(storageWith("future"))).toBe("v1");
  });

  it("falls back safely when storage is blocked", () => {
    expect(readMobileUiVersion({ getItem() { throw new Error("blocked"); } })).toBe("v1");
  });
});
