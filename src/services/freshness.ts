/**
 * Recover from a stale service worker.
 *
 * A worker that is serving an old precached shell cannot be fixed from inside
 * that shell by reloading: a reload — even a hard one — still goes through the
 * worker, and clearing the browser's HTTP cache does not touch the worker's
 * own Cache Storage. The app therefore looks permanently out of date while
 * every deploy succeeds.
 *
 * version.json is excluded from the precache, so fetching it with no-store
 * reaches the network and reveals the build the server is actually on. If that
 * differs from the build compiled into this bundle, the worker is stale: drop
 * it and its caches and reload once. localStorage is untouched, so no programs
 * or workout logs are lost.
 */
const RELOAD_FLAG = 'll_freshness_reload';

export async function ensureFresh(): Promise<void> {
  try {
    const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = await res.json() as { build?: string };
    if (!build || build === __BUILD__) {
      sessionStorage.removeItem(RELOAD_FLAG);
      return;
    }

    // Only ever reload once per session, so a bad deploy cannot trap the app
    // in a refresh loop.
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, '1');

    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    location.reload();
  } catch (_) {
    // Offline, or version.json unreachable — keep running what we have.
  }
}
