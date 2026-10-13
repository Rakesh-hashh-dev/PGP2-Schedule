// Export the current logo for system notifications. Run after changing the logo.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const out = fileURLToPath(new URL("../public/", import.meta.url));
await sharp(path.join(out, "termflow-icon.svg")).resize(192, 192).png().toFile(path.join(out, "icon-notification.png"));
// Transparent monochrome compass silhouette for Android's status bar.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <circle cx="48" cy="48" r="34" fill="none" stroke="white" stroke-width="6"/>
  <path fill="white" d="M48 3l5 12H43z M93 48l-12 5V43z M48 93l-5-12h10z M3 48l12-5v10z"/>
  <path fill="white" d="M67 24L56 61l-9-12-13-7z M47 53c8 9 8 17-1 22-9-5-9-13 1-22z"/>
</svg>`;
await sharp(Buffer.from(badge)).resize(96, 96).png().toFile(path.join(out, "badge-notification.png"));
console.log("Exported TermFlow notification logo and monochrome badge.");
