/* Atlas — Service Worker cleanup
 * v32 起不再使用 PWA 强缓存。这个文件只负责注销旧 service worker
 * 并清掉历史 Atlas 缓存，让普通刷新直接拿线上最新版本。
 *
 * ATLAS_VERSION 每次推送前必须 +1，并和 app.js 里的同名常量保持一致。
 * 原因：浏览器靠 service-worker.js 的字节变化检测「有新 SW 待安装」，
 * 字节不变 → 老用户的旧 SW 不会被替换 → 这段 unregister 逻辑跑不到他们身上。 */

const ATLAS_VERSION = 'atlas-v39';

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
