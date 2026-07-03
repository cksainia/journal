import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// Version gate (the tracker's stale-tab defense, automated): the SAME build
// stamp is compiled into the bundle AND emitted as version.json. A running
// tab compares the two — a stale tab pauses shared writes and asks for a
// refresh instead of clobbering newer data. No manual bumping: every build
// stamps itself.
const BUILD_STAMP = Date.now()
function buildStamp(): Plugin {
  return {
    name: 'build-stamp',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD_STAMP }),
      })
    },
  }
}

// Served from GitHub Pages at https://cksainia.github.io/journal/ — same origin as the
// Summer Tracker, so the Firebase Auth session is shared across both apps.
export default defineConfig({
  base: '/journal/',
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_STAMP),
  },
  plugins: [
    react(),
    tailwindcss(),
    buildStamp(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: "Aria's Journal",
        short_name: 'Journal',
        description: "Aria's daily journal — write, draw, remember.",
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FDF6EC',
        theme_color: '#F4634A',
        icons: [
          { src: 'icon-192.png', type: 'image/png', sizes: '192x192' },
          { src: 'icon-512.png', type: 'image/png', sizes: '512x512' },
          { src: 'icon-512.png', type: 'image/png', sizes: '512x512', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + static assets only. Firestore traffic is NEVER intercepted —
        // offline data is the Firestore SDK's job (persistentLocalCache), and the
        // tracker's history shows how a greedy service worker causes grief.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/journal/index.html',
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
