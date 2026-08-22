import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { writeFileSync, mkdirSync } from 'node:fs';

const BUILD = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  base: '/',
  // Surfaced in the sync sheet so the running build is always identifiable —
  // a stale service worker is otherwise invisible from inside the app.
  define: {
    __BUILD__: JSON.stringify(BUILD),
  },
  build: {
    outDir: 'dist',
  },
  plugins: [
    // Emit the build stamp as a tiny file the running app can check against
    // itself. A service worker serving a stale shell is otherwise undetectable
    // from inside that shell — the app has no way to know it is out of date.
    {
      name: 'emit-version',
      closeBundle() {
        mkdirSync('dist', { recursive: true });
        writeFileSync('dist/version.json', JSON.stringify({ build: BUILD }));
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,ico,json}'],
        // version.json must never be precached — it is the one file that has
        // to reflect the server, not the worker's cached copy of the server.
        globIgnores: ['version.json'],
        navigateFallback: 'index.html',
        // /__/ is Firebase Hosting's reserved namespace — it serves the Google
        // sign-in handler and iframe from /__/auth/*. Without this exclusion the
        // navigate-fallback swallows the OAuth redirect and returns the app
        // shell instead, so sign-in silently never completes.
        navigateFallbackDenylist: [/^\/api\//, /^\/__\//],
        // Firestore is deliberately NOT runtime-cached here. The SDK has its own
        // offline layer (persistentLocalCache in services/firebase.ts) and its
        // realtime channel must not be served from a service-worker cache.
        runtimeCaching: [],
      },
    }),
  ],
});
