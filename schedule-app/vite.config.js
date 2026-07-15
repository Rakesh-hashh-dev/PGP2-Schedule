/* eslint-env node */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { writeFileSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { visualizer } from 'rollup-plugin-visualizer'

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

function generateMeta() {
  return {
    name: 'generate-meta',
    writeBundle() {
      writeFileSync('dist/meta.json', JSON.stringify({ version: BUILD_VERSION }));
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  plugins: [
    react(),
    generateMeta(),
    VitePWA({
      registerType: 'prompt',
      devOptions: { enabled: true },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp,jpg}'],
        globIgnores: ['**/*.unused.*', '**/push-sw.js'],
        // Web Push handlers live in public/push-sw.js (imported, not precached)
        importScripts: ['push-sw.js'],
        runtimeCaching: [
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
      manifest: {
        name: 'TermFlow',
        short_name: 'TermFlow',
        description: 'PGP2 timetable & attendance tracker — IIM Sambalpur',
        theme_color: '#15182B',
        background_color: '#F3F1EA',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'termflow-icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Today',
            short_name: 'Today',
            url: '/?view=today',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'This Week',
            short_name: 'Week',
            url: '/?view=week',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Attendance',
            short_name: 'Attendance',
            url: '/?view=attendance',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Assignments',
            short_name: 'Assignments',
            url: '/?view=assignments',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
        ],
      },
    }),
    SENTRY_UPLOAD && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: String(BUILD_VERSION) },
      sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
      telemetry: false,
    }),
    visualizer({ filename: 'stats.html', open: false }),
  ].filter(Boolean),
  build: {
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
            return 'vendor';
          }
        }
      }
    }
  }
})
