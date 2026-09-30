import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appFile = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const publicFile = path => appFile(`public/${path}`);

describe("public discovery boundaries", () => {
  it("keeps only canonical public pages in the sitemap", () => {
    const sitemap = publicFile("sitemap.xml");
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
    expect(urls).toEqual([
      "https://pgp2.termflow.tech/",
      "https://pgp2.termflow.tech/about.html",
      "https://pgp2.termflow.tech/features.html",
      "https://pgp2.termflow.tech/privacy.html",
    ]);
    expect(urls.some(url => /\/api\/|\/sso-callback|\?/.test(url))).toBe(false);
  });

  it("blocks crawler access to APIs and the authentication callback", () => {
    const robots = publicFile("robots.txt");
    expect(robots).toContain("User-agent: OAI-SearchBot");
    expect(robots).toMatch(/User-agent: GPTBot\r?\nDisallow: \//);
    expect(robots.match(/Disallow: \/api\//g)?.length).toBeGreaterThanOrEqual(3);
    expect(robots.match(/Disallow: \/sso-callback/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("uses a narrow SPA rewrite and no-index response headers", () => {
    const config = JSON.parse(appFile("vercel.json"));
    expect(config.rewrites).toEqual([{ source: "/sso-callback", destination: "/index.html" }]);
    for (const source of ["/sso-callback", "/api/(.*)"]) {
      const rule = config.headers.find(item => item.source === source);
      expect(rule?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
    }
  });

  it("gives each public information page one canonical and valid JSON-LD", () => {
    for (const page of ["about.html", "features.html", "privacy.html"]) {
      const html = publicFile(page);
      expect(html.match(/rel="canonical"/g)).toHaveLength(1);
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      expect(blocks).toHaveLength(1);
      expect(() => JSON.parse(blocks[0][1])).not.toThrow();
    }
    expect(publicFile("404.html")).toContain('name="robots" content="noindex, nofollow"');
  });
});
