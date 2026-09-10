import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MobileUiVersionMenu from "./MobileUiVersionMenu.jsx";

describe("MobileUiVersionMenu", () => {
  it("always exposes both interface versions", () => {
    const html = renderToStaticMarkup(
      <MobileUiVersionMenu version="v1" onVersionChange={() => {}} theme="dark" onThemeChange={() => {}} />
    );
    expect(html).toContain("V1");
    expect(html).toContain("Classic");
    expect(html).toContain("V2");
    expect(html).toContain("Modern");
    expect(html).not.toContain("Appearance");
  });

  it("keeps appearance independent in the V2 quick menu", () => {
    const html = renderToStaticMarkup(
      <MobileUiVersionMenu version="v2" onVersionChange={() => {}} theme="dark" onThemeChange={() => {}} showAppearance />
    );
    expect(html).toContain("Appearance");
    for (const mode of ["Light", "Dark", "System"]) expect(html).toContain(mode);
    expect(html).toContain('aria-checked="true"');
  });
});
