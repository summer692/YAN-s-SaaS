/* Atlas — Service Worker cleanup
 * v32 起不再使用 PWA 强缓存。这个文件只负责注销旧 service worker
 * 并清掉历史 Atlas 缓存，让普通刷新直接拿线上最新版本。 */

const CACHE_VERSION = 'atlas-v32';

async function clearAtlasCaches() {
  if (!self.caches) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith('atlas-')).map((key) => caches.delete(key)));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(clearAtlasCaches());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    clearAtlasCaches()
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});

self.addEventListener('fetch', () => {
  // Intentionally empty: let the browser/network handle every request.
});
