import { describe, it, expect, vi, afterEach } from "vitest";
import { toMin, fmtTime12, fmtWait, ymd, clsDate, prettyDate, timeAgo } from "./datetime.js";

describe("toMin", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(toMin("00:00")).toBe(0);
    expect(toMin("09:30")).toBe(570);
    expect(toMin("23:59")).toBe(1439);
  });
});

describe("fmtTime12", () => {
  it("renders schedule times with a zero-padded hour and uppercase meridiem", () => {
    expect(fmtTime12("00:00")).toBe("12:00AM");
    expect(fmtTime12("09:30")).toBe("09:30AM");
    expect(fmtTime12("12:00")).toBe("12:00PM");
    expect(fmtTime12("14:00")).toBe("02:00PM");
    expect(fmtTime12("23:59")).toBe("11:59PM");
  });

  it("leaves malformed values unchanged", () => {
    expect(fmtTime12("")).toBe("");
    expect(fmtTime12("All Day")).toBe("All Day");
    expect(fmtTime12("25:00")).toBe("25:00");
  });
});

describe("fmtWait", () => {
  it("renders sub-hour, hour, and multi-day gaps", () => {
    expect(fmtWait(5 * 60000)).toBe("in 5m");
    expect(fmtWait(90 * 60000)).toBe("in 1h 30m");
    expect(fmtWait(120 * 60000)).toBe("in 2h");
    expect(fmtWait(3 * 24 * 60 * 60000)).toBe("in 3d");
  });
  it("never goes negative", () => {
    expect(fmtWait(-100000)).toBe("in 0m");
  });
});

describe("ymd", () => {
  it("formats a local date as YYYY-MM-DD with zero padding", () => {
    expect(ymd(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(ymd(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("clsDate", () => {
  it("builds a local Date from a class row + field", () => {
    const c = { date: "2026-08-06", start: "09:15", end: "10:45" };
    const start = clsDate(c, "start");
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7); // August (0-indexed)
    expect(start.getDate()).toBe(6);
    expect(start.getHours()).toBe(9);
    expect(start.getMinutes()).toBe(15);
    expect(clsDate(c, "end").getHours()).toBe(10);
  });
});

describe("prettyDate", () => {
  it("does not drift the day across time zones (parses as local)", () => {
    // Guards the reason clsDate/prettyDate build dates component-wise instead of
    // new Date(iso): the latter parses YYYY-MM-DD as UTC midnight and can render
    // the previous day in +HH zones.
    expect(prettyDate("2026-08-06")).toContain("6");
    expect(prettyDate("2026-08-06")).toMatch(/Aug/);
  });
});

describe("timeAgo", () => {
  afterEach(() => vi.useRealTimers());
  it("bins into just now / minutes / hours / days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00Z"));
    const ago = (ms) => new Date(Date.now() - ms).toISOString();
    expect(timeAgo(ago(30 * 1000))).toBe("just now");
    expect(timeAgo(ago(5 * 60000))).toBe("5m ago");
    expect(timeAgo(ago(3 * 3600000))).toBe("3h ago");
    expect(timeAgo(ago(2 * 24 * 3600000))).toBe("2d ago");
  });
});
