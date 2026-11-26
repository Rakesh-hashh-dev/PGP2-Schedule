import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootErrorBoundary from "./RootErrorBoundary.jsx";

describe("RootErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    const html = renderToStaticMarkup(
      <RootErrorBoundary>
        <div id="test-content">App running normally</div>
      </RootErrorBoundary>
    );
    expect(html).toContain("App running normally");
  });

  it("identifies chunk errors in getDerivedStateFromError", () => {
    const chunkError = new TypeError("Failed to fetch dynamically imported module: /assets/ClerkApp-abc.js");
    const state = RootErrorBoundary.getDerivedStateFromError(chunkError);
    expect(state.hasError).toBe(true);
    expect(state.isChunkError).toBe(true);
  });

  it("identifies non-chunk runtime errors in getDerivedStateFromError", () => {
    const generalError = new Error("Cannot read properties of undefined");
    const state = RootErrorBoundary.getDerivedStateFromError(generalError);
    expect(state.hasError).toBe(true);
    expect(state.isChunkError).toBe(false);
  });

  it("renders update-needed recovery UI when chunk error is trapped", () => {
    const boundary = new RootErrorBoundary({});
    boundary.state = {
      hasError: true,
      error: new TypeError("Failed to fetch dynamically imported module"),
      isChunkError: true,
      autoReloading: false,
    };
    const html = renderToStaticMarkup(boundary.render());
    expect(html).toContain("App Update Needed");
    expect(html).toContain("Update &amp; Reload App");
    expect(html).toContain("Clear Cache &amp; Reset");
  });

  it("renders general fallback UI for generic runtime crashes", () => {
    const boundary = new RootErrorBoundary({});
    boundary.state = {
      hasError: true,
      error: new Error("SyntaxError: Unexpected token"),
      isChunkError: false,
      autoReloading: false,
    };
    const html = renderToStaticMarkup(boundary.render());
    expect(html).toContain("Something Went Wrong");
    expect(html).toContain("SyntaxError: Unexpected token");
  });
});
