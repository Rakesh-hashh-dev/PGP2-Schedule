import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = resolve(appDir, "public");
const today = new Date().toISOString().slice(0, 10);

const pages = [
  { url: "https://pgp2.termflow.tech/", source: "index.html" },
  { url: "https://pgp2.termflow.tech/about.html", source: "public/about.html" },
  { url: "https://pgp2.termflow.tech/features.html", source: "public/features.html" },
  { url: "https://pgp2.termflow.tech/privacy.html", source: "public/privacy.html" },
];

function git(args) {
  try {
    return execFileSync("git", args, { cwd: appDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function modifiedDate(source) {
  if (git(["status", "--porcelain", "--", source])) return today;
  return git(["log", "-1", "--format=%cs", "--", source]) || today;
}

const rows = pages.map(page => [
  "  <url>",
  `    <loc>${page.url}</loc>`,
  `    <lastmod>${modifiedDate(page.source)}</lastmod>`,
  "  </url>",
].join("\n"));

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...rows,
  "</urlset>",
  "",
].join("\n");

writeFileSync(resolve(publicDir, "sitemap.xml"), xml, "utf8");
console.log(`[sitemap] Wrote ${pages.length} canonical public URLs.`);
