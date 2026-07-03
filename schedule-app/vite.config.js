import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync } from 'node:fs'

const BUILD_VERSION = Date.now();

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
    __APP_VERSION__: BUILD_VERSION,
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
            urlPattern: /^https:\/\/.*\.clerk\.accounts\.dev\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Supabase — network-first, short cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 20, maxAgeSeconds: 5 * 60 },
              cacheableResponse: { statuses: [0, 200] },
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
            name: 'Attendance',
            short_name: 'Attendance',
            url: '/?view=attendance',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
  build: {
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
