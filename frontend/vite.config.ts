/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { BRAND } from './src/lib/brand'

export default defineConfig({
  plugins: [
    react(),
    {
      // Fills %BRAND_*% placeholders in index.html from src/lib/brand.ts.
      name: 'brand-html',
      transformIndexHtml: (html: string) =>
        html.replace(/%BRAND_NAME%/g, BRAND.name).replace(/%BRAND_TAGLINE%/g, BRAND.tagline).replace(/%BRAND_DESCRIPTION%/g, BRAND.description),
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png'],
      manifest: {
        name: `${BRAND.name} · Focus timer`,
        short_name: BRAND.name,
        description: BRAND.description,
        theme_color: '#07080c',
        background_color: '#07080c',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        importScripts: ['push-sw.js'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // The production API lives on another origin, so match on pathname.
            // Never cache auth, the calendar feed, exports, or anything non-GET.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/') && !/^\/api\/(auth|calendar|export|health)\b/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-get',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 60, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 30 * 86400 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
