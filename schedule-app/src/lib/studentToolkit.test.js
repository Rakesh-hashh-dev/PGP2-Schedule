import { describe, expect, it } from "vitest";
import { calendarSubscriptionUrl, careerSummary, upcomingStudySessions } from "./studentToolkit.js";

describe("student toolkit", () => {
  it("summarises active placement applications", () => {
    const items = [{ stage: "applied", deadline: "2026-10-02" }, { stage: "offered", deadline: "2026-09-01" }];
    expect(careerSummary(items, new Date("2026-09-30T00:00:00"))).toMatchObject({ total: 2, active: 1, offered: 1 });
  });

  it("builds a scoped live calendar URL", () => {
    const url = calendarSubscriptionUrl("https://pgp2.termflow.tech", { CRM: "Single", ECOM: "A" }, { reminderMinutes: 30, includeClasses: true, includeExams: false });
    expect(url).toContain("courses=CRM%2CECOM");
    expect(url).toContain("sections=CRM%3ASingle%2CECOM%3AA");
    expect(url).toContain("exams=0");
  });

  it("orders open study sessions and marks past ones", () => {
    const rows = upcomingStudySessions([{ id: 2, date: "2026-10-02", status: "planned" }, { id: 1, date: "2026-09-29", status: "planned" }], new Date("2026-09-30T00:00:00"));
    expect(rows.map(row => row.id)).toEqual([1, 2]);
    expect(rows[0].past).toBe(true);
  });
});
