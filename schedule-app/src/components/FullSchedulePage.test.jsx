import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import FullSchedulePage from "./FullSchedulePage.jsx";

const cancelled = { date: "2026-10-13", code: "SOM", section: "A", name: "Service Operations Management", session: "8", start: "14:30", end: "16:00", type: "cancelled", room: "A02" };
const active = { ...cancelled, code: "DM", name: "Digital Marketing", type: "class", start: "16:30", end: "18:00" };
const render = (rows, extraProps = {}) =>
  renderToStaticMarkup(
    <FullSchedulePage
      allClasses={rows}
      enrolled={{ SOM: "A", DM: "A", ECOM: "Single" }}
      legend={{ SOM: { name: cancelled.name }, DM: { name: active.name }, ECOM: { name: "E-commerce" } }}
      termLabel="Term V"
      onOpenCourse={() => {}}
      {...extraProps}
    />
  );

describe("full schedule cancellation display", () => {
  it("keeps a shown cancellation alongside active classes and disables its course action", () => {
    const html = render([cancelled, active]);
    expect(html).toContain("fs-card fs-card-cancelled");
    expect(html).toContain(cancelled.name);
    expect(html).toContain("Course hub unavailable: class cancelled");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Course hub unavailable: class cancelled"/);
    expect(html).toContain("Open course hub for DM");
    expect(html).toContain("1 sessions");
  });

  it("keeps a day whose only class is cancelled", () => {
    const html = render([cancelled]);
    expect(html).toContain("day-2026-10-13");
    expect(html).toContain("fs-card fs-card-cancelled");
    expect(html).toContain("0 sessions");
  });

  it("includes classes with section 'All', provisional sections, and placement entries matching Today view", () => {
    const allSectionClass = {
      date: "2026-11-27", code: "DM", section: "All", name: "Digital Marketing Extra",
      session: "Extra", start: "10:00", end: "11:30", type: "class", room: "A01",
    };
    const provisionalClass = {
      date: "2026-11-27", code: "ECOM", section: "B", name: "E-commerce",
      session: "5", start: "12:00", end: "13:30", type: "class", room: "A02",
    };
    const placementEntry = {
      date: "2026-11-27", code: "", section: "Single", name: "Pre-Placement Talk",
      start: "18:00", end: "19:00", type: "placement", room: "Auditorium",
    };
    const otherSectionQuiz = {
      date: "2026-11-27", code: "SOM", section: "B", name: "Service Operations Management",
      session: "Quiz 2", start: "20:00", end: "21:00", type: "class", room: "A02",
    };

    const html = render([allSectionClass, provisionalClass, placementEntry, otherSectionQuiz], {
      provisionalSections: new Set(["ECOM"]),
      todayISO: "2026-11-27",
    });

    expect(html).toContain("Digital Marketing Extra");
    expect(html).toContain("E-commerce");
    expect(html).toContain("Pre-Placement Talk");
    expect(html).not.toContain("Quiz 2");
  });
});
