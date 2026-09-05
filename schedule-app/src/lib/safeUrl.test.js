import { describe, it, expect } from "vitest";
import { safeUrl } from "./safeUrl.js";

describe("safeUrl", () => {
  it("keeps ordinary web links", () => {
    expect(safeUrl("https://iimsambalpur.ac.in/exam")).toBe("https://iimsambalpur.ac.in/exam");
    expect(safeUrl("http://example.com/a?b=1")).toBe("http://example.com/a?b=1");
    expect(safeUrl("mailto:office@iimsambalpur.ac.in")).toBe("mailto:office@iimsambalpur.ac.in");
  });

  it("rejects script-bearing schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeUrl("  javascript:alert(1)  ")).toBeNull();
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("rejects empty and unparseable input", () => {
    expect(safeUrl("")).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
  });

  it("resolves a relative path against our own origin", () => {
    const base = globalThis.location?.origin || "http://localhost";
    expect(safeUrl("/courses")).toBe(`${base}/courses`);
  });
});
