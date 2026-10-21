import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import MobileV2Breadcrumbs from "./MobileV2Breadcrumbs.jsx";
import { v2BreadcrumbItems } from "../../lib/v2Breadcrumbs.js";

describe("V2 hierarchy navigation", () => {
  it("omits root destinations and the More landing", () => {
    for (const view of ["today", "tomorrow", "week", "fullSchedule", "attendance", "assignments", "exams", "more"]) {
      expect(v2BreadcrumbItems({ view, onOpenMore: vi.fn() })).toEqual([]);
    }
  });
  it("uses the actual course parent even when entered through a shortcut", () => {
    const onBack = vi.fn(), onOpenMore = vi.fn();
    const items = v2BreadcrumbItems({ view: "courseHub", detail: "Product Strategy", onBack, onOpenMore });
    expect(items.map(i => i.label)).toEqual(["More", "Courses", "Product Strategy"]);
    items[1].onSelect(); expect(onBack).toHaveBeenCalledOnce();
    items[0].onSelect(); expect(onOpenMore).toHaveBeenCalledOnce();
    expect(items[2].onSelect).toBeUndefined();
  });
  it("never exposes a hidden More destination on landscape tablets", () => {
    const items = v2BreadcrumbItems({ view: "split", isTablet: true, detail: "Study group", onBack: vi.fn(), onOpenMore: vi.fn() });
    expect(items.map(i => i.label)).toEqual(["Split expenses", "Study group"]);
    expect(v2BreadcrumbItems({ view: "leave", isTablet: true, onOpenMore: vi.fn() })).toEqual([]);
  });
  it("preserves full accessible names and marks only the current crumb", () => {
    const name = "A very long course name covering product strategy and business transformation";
    const html = renderToStaticMarkup(<MobileV2Breadcrumbs view="courseHub" detail={name} onBack={() => {}} onOpenMore={() => {}} />);
    expect(html).toContain('aria-label="Back to Courses"');
    expect(html).toContain(name);
    expect((html.match(/aria-current="page"/g) || []).length).toBe(1);
    expect(html).toContain('aria-label="Breadcrumb"');
  });
});
