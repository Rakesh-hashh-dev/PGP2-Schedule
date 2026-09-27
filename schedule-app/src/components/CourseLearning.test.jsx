import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CourseLearning from "./CourseLearning.jsx";

describe("Course learning panels", () => {
  it("renders saved course data and a due revision without requiring a browser session", () => {
    const html = renderToStaticMarkup(<CourseLearning
      course={{ sessions: [{ code: "AAIM", section: "A01", date: "2026-09-24", start: "09:00", end: "10:30", faculty: "Professor A", room: "B12" }], nextClass: null }}
      items={[
        { id: "e", kind: "essentials", title: "Course essentials", details: { grading: "Project 40%", syllabusUrl: "https://example.edu/syllabus" } },
        { id: "t", kind: "topic", title: "Pricing strategy", done: true, details: { flagged: true, question: "Which approach?", answer: "Value based", reviewAt: "2026-09-25" } },
        { id: "n", kind: "note", title: "Class · 24 Sep 09:00", details: { sessionDate: "2026-09-24", takeaway: "Compare options" } },
      ]}
      now={new Date(2026, 8, 25, 10)} isArchived onSave={() => {}} onChange={() => {}}
    />);
    expect(html).toContain("Project 40%");
    expect(html).toContain("Pricing strategy");
    expect(html).toContain("Ready now");
    expect(html).toContain("Compare options");
  });
});
