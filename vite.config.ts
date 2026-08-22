import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,ico,json}'],
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
