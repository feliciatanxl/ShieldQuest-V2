import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// 127.0.0.1, not localhost: on Windows localhost can resolve to ::1 while the API listens on IPv4 only.
const SERVER = process.env.SHIELDQUEST_SERVER ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ShieldQuest',
        short_name: 'ShieldQuest',
        description: 'Choose Right. Protect Together. A youth crime- and scam-prevention game by Project SHIELD.',
        theme_color: '#0b1026',
        background_color: '#0b1026',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,webmanifest}'],
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/api': SERVER,
      '/socket.io': { target: SERVER, ws: true },
    },
  },
  build: {
    target: 'es2022',
    // The 3D chunk (three + R3F) is ~930 KB raw / ~250 KB gzip by design (GDD §10.2 budget: 260 KB gzip).
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      // @shieldquest/shared is pure data and functions (its package.json just doesn't say so). Declaring it
      // side-effect free lets a page that only needs, say, GAME and HELP_CHANNELS skip the mission content.
      treeshake: {
        moduleSideEffects: (id) => (/[\\/]packages[\\/]shared[\\/]src[\\/]/.test(id) ? false : undefined),
      },
      output: {
        codeSplitting: {
          groups: [
            // Mission content and the Calibration item bank are large and only some routes need them. Without
            // these groups they land in the chunk every route shares, so the public site and the join flow
            // would download every mission (GDD §10.2 app-shell budget).
            { name: 'missions', test: /packages[\\/]shared[\\/]src[\\/]content[\\/]/ },
            { name: 'assessment-bank', test: /packages[\\/]shared[\\/]src[\\/]assessment\.ts$/ },
          ],
        },
      },
    },
  },
});
