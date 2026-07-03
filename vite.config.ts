import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// Served from GitHub Pages at https://cksainia.github.io/journal/ — same origin as the
// Summer Tracker, so the Firebase Auth session is shared across both apps.
export default defineConfig({
  base: '/journal/',
  plugins: [
    react(),
    tailwindcss(),
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
