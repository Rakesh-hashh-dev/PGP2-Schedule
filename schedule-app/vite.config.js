import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { writeFileSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { visualizer } from 'rollup-plugin-visualizer'

// Absolute path to this file's dir (schedule-app/), used to resolve dist/,
// public/, and the stats/report outputs regardless of the cwd Vite runs from.
const APP_DIR = fileURLToPath(new URL('.', import.meta.url));

// Semver from package.json (bump with `npm version patch|minor|major`),
// plus the git short hash so each deploy is uniquely identifiable and the
// meta.json update check still fires on every new deploy.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const gitSha =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'local'; } })();
const BUILD_VERSION = `${pkg.version}+${gitSha}`;
// Source maps are only generated + uploaded when a token is set (Vercel env),
// and the .map files are deleted after upload so they never deploy.
const SENTRY_UPLOAD = Boolean(process.env.SENTRY_AUTH_TOKEN);

function generateMeta(outDir) {
  return {
    name: 'generate-meta',
    writeBundle() {
      writeFileSync(resolve(outDir, 'meta.json'), JSON.stringify({ version: BUILD_VERSION }));
    },
  };
}

// Inline a tiny critical-CSS subset so the boot splash paints immediately,
// then convert the blocking global stylesheet link to a non-blocking preload.
// This eliminates the only render-blocking resource and saves ~300 ms of FCP.
function asyncCssPlugin() {
  return {
    name: 'async-css',
    enforce: 'post',   // run AFTER Vite has injected its own <link> tags
    transformIndexHtml(html) {
      // 1. Read the critical CSS (vars + body bg + loading screen only)
      let criticalCss = '';
      try {
        criticalCss = readFileSync(
          new URL('./src/styles-critical.css', import.meta.url),
          'utf8'
        );
      } catch (e) {
        console.warn('[async-css] Could not read styles-critical.css:', e.message);
      }

      // 2. Convert the auto-injected blocking <link rel="stylesheet"> for the
      //    global index-*.css chunk into a non-blocking preload + onload swap.
      //    Only targets assets/index-*.css (the global chunk); component-level
      //    CSS chunks that are dynamically loaded are already non-blocking.
      const asyncHtml = html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/index-[^"]+\.css)">/g,
        [
          '<link rel="preload" as="style" crossorigin href="$1"',
          '     onload="this.rel=\'stylesheet\'">',
          '<noscript><link rel="stylesheet" crossorigin href="$1"></noscript>',
        ].join('\n    ')
      );

      // 3. Inline the critical CSS just before </head>
      if (!criticalCss) return asyncHtml;
      return asyncHtml.replace(
        '</head>',
        `<style>/* critical */\n${criticalCss}\n</style>\n</head>`
      );
    },
  };
}

// Shared app icons.
const FULL_ICONS = [
  { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: 'termflow-icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
  { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
];

const FULL_MANIFEST = {
  name: 'TermFlow',
  short_name: 'TermFlow',
  description: 'PGP2 timetable & attendance tracker — IIM Sambalpur',
  theme_color: '#15182B',
  // Android paints the launch splash with this — dark matches the icon
  // tile and avoids a bright flash for dark-mode users at night
  background_color: '#15182B',
  display: 'standalone',
  start_url: '/',
  scope: '/',
  orientation: 'portrait',
  icons: FULL_ICONS,
  // Android surfaces at most 4 shortcuts in the long-press menu, in
  // order — Glance / Today / Announcements / Attendance made the cut
  // (Glance replaced This Week: it IS the quick-look use case shortcuts
  // exist for); Assignments is kept 5th for launchers that show more.
  // Icons are full-bleed maskable tiles (glyph in the 60% safe zone).
  shortcuts: [
    {
      name: 'Glance',
      short_name: 'Glance',
      url: '/?view=glance',
      icons: [{ src: 'shortcut-glance.png', sizes: '192x192', purpose: 'any maskable' }],
    },
    {
      name: 'Today',
      short_name: 'Today',
      url: '/?view=today',
      icons: [{ src: 'shortcut-today.png', sizes: '192x192', purpose: 'any maskable' }],
    },
    {
      name: 'Announcements',
      short_name: 'Announcements',
      url: '/?view=notifications',
      icons: [{ src: 'shortcut-announcements.png', sizes: '192x192', purpose: 'any maskable' }],
    },
    {
      name: 'Attendance',
      short_name: 'Attendance',
      url: '/?view=attendance',
      icons: [{ src: 'shortcut-attendance.png', sizes: '192x192', purpose: 'any maskable' }],
    },
    {
      name: 'Assignments',
      short_name: 'Assignments',
      url: '/?view=assignments',
      icons: [{ src: 'shortcut-assignments.png', sizes: '192x192', purpose: 'any maskable' }],
    },
  ],
};

const root = APP_DIR;
const outDir = resolve(APP_DIR, 'dist');
const publicDir = resolve(APP_DIR, 'public');
const manifest = FULL_MANIFEST;

export default defineConfig({
  root,
  publicDir,
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  server: {
    port: 3000,
  },
  plugins: [
    react(),
    generateMeta(outDir),
    asyncCssPlugin(),
    VitePWA({
      registerType: 'prompt',
      devOptions: { enabled: true },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp,jpg}'],
        globIgnores: [
          '**/*.unused.*',
          '**/push-sw.js',
          '**/shortcut-*.png',
          '**/AdminDashboard-*.*',
          '**/SplitPage-*.*',
          '**/CompareView-*.*',
          '**/WrappedView-*.*',
          '**/CalendarExportModal-*.*',
          '**/TermFlow-og.jpg',
          '**/*.xlsx',
        ],
        // Web Push handlers live in public/push-sw.js (imported, not precached)
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // Cache on-demand lazy chunks (Admin, Split, Compare, Wrapped, etc.) when actually visited
            urlPattern: /\/assets\/(AdminDashboard|SplitPage|CompareView|WrappedView|CalendarExportModal)-.*\.(js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'lazy-views-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Google Sheets feed — network-first, 1h cache, 5s timeout before stale
            urlPattern: /^https:\/\/script\.google\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'schedule-feed',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Clerk auth / API calls — network-only (never cache auth)
            // Covers both dev (*.clerk.accounts.dev) and prod (*.clerk.com)
            urlPattern: /^https:\/\/(.*\.clerk\.accounts\.(dev|com)|clerk\.pgp2\.termflow\.tech)\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Supabase — network-first, short cache.
            // cacheName bumped to -v2 so any empty ([]) responses cached during
            // the dev→prod auth-cutover window are discarded when this SW activates.
            // Shorter maxAge limits how long a stale/empty response can be served
            // if the network is momentarily unreachable right after cutover.
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-v2',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Google Fonts — stale-while-revalidate
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
          {
            // Weather API — network-first, 30min cache
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 1, maxAgeSeconds: 30 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest,
    }),
    SENTRY_UPLOAD && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: String(BUILD_VERSION) },
      sourcemaps: { filesToDeleteAfterUpload: [resolve(outDir, '**/*.map')] },
      telemetry: false,
    }),
    visualizer({ filename: resolve(APP_DIR, 'stats.html'), open: false }),
  ].filter(Boolean),
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: SENTRY_UPLOAD ? 'hidden' : false,
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true, passes: 2 },
      format: { comments: false },
    },
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'lucide';
            if (id.includes('@sentry')) return 'sentry';
            if (id.includes('@clerk')) return 'clerk';
            if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
            if (id.includes('@supabase')) return 'supabase';
            // Isolate heavy/optional libs so an eager import of a small lib
            // (e.g. @vercel/analytics) can never drag these onto first paint.
            if (id.includes('xlsx')) return 'xlsx';
            if (id.includes('@dnd-kit')) return 'dnd-kit';
            if (id.includes('cmdk')) return 'cmdk';
            if (id.includes('@vercel/analytics')) return 'analytics';
            return 'vendor';
          }
        }
      }
    }
  }
});
