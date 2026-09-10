import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import TomorrowSummary from "./TomorrowSummary.jsx";

describe("TomorrowSummary", () => {
  it("does not render rail segments with negative left or overflow when breaks precede the first class", () => {
    const list = [
      // Morning break before the student's classes start
      { type: "break", name: "Lunch", start: "12:00", end: "13:00" },
      // First class in afternoon
      { type: "class", name: "Corporate Finance", code: "FIN601", start: "14:30", end: "16:00", room: "A01" },
      // Afternoon break between classes
      { type: "break", name: "Tea Break", start: "16:00", end: "17:00" },
      // Second class
      { type: "class", name: "Operations Strategy", code: "OPS602", start: "17:00", end: "20:00", room: "CR2" },
      // Evening break after classes end
      { type: "break", name: "Dinner", start: "20:30", end: "21:30" },
    ];

    const html = renderToStaticMarkup(
      <TomorrowSummary list={list} weather={null} changeCount={0} onViewChanges={() => {}} />
    );

    // Only the break between classes should be counted (1 break)
    expect(html).toContain('<span class="tmrw-stat-value">1</span><span class="tmrw-stat-label">break</span>');

    // Extract all style="left: ...%; width: ...%"
    const matches = [...html.matchAll(/style="left:([0-9.]+)%;width:([0-9.]+)%/g)];
    expect(matches.length).toBe(3); // Class 1, Break, Class 2 (morning & dinner breaks excluded)

    matches.forEach(([, leftStr, widthStr]) => {
      const left = parseFloat(leftStr);
      const width = parseFloat(widthStr);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(100.01);
    });
  });
});
