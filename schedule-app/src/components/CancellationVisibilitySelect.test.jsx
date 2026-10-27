import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CancellationVisibilitySelect from "./CancellationVisibilitySelect.jsx";

describe("cancellation display selector", () => {
  it.each(["show", "hide"])("renders both choices and selects %s", value => {
    const html = renderToStaticMarkup(<CancellationVisibilitySelect value={value} onChange={() => {}} />);
    expect(html).toContain("After cancellation");
    expect(html).toContain("Show as cancelled");
    expect(html).toContain("Hide from schedule");
    expect(html).toContain(`<option value="${value}" selected="">`);
  });
});
