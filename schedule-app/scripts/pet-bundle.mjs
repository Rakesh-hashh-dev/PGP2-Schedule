// Load the editable JSX artwork with the same bundler used by Vite 8.
import { build } from "rolldown";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";

export async function bundlePets(root, outfile, contents) {
  const entry = resolve(root, ".local", `pet-qa-${basename(outfile)}.jsx`);
  mkdirSync(dirname(entry), { recursive: true });
  writeFileSync(entry, contents);
  try {
    await build({
      input: entry,
      platform: "node",
      transform: { jsx: { runtime: "automatic" }, define: { "import.meta.env": JSON.stringify({ VITE_SUPABASE_URL: "https://offline.invalid", VITE_SUPABASE_ANON_KEY: "offline-preview" }) } },
      external: ["react", "react-dom", "react/jsx-runtime"],
      // Preview service imports are inert: no credentials, auth or network.
      // The preview embeds the real stylesheets separately.
      plugins: [{ name: "preview-css", resolveId(id) { if (/(?:^|\/)supabase\.js$/.test(id)) return "virtual:pet-preview-service.js"; if (id.endsWith(".css")) return "virtual:pet-preview-css.js"; }, load(id) { if (id === "virtual:pet-preview-service.js") return "export const supabase = null;"; if (id === "virtual:pet-preview-css.js") return "export {};"; } }],
      output: { file: outfile, format: "cjs" },
    });
  } finally {
    rmSync(entry, { force: true });
  }
}
