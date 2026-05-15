/* SaaS 指挥中心 — Service Worker
 * 策略：核心静态资源 cache-first，其余 network-first 兜底缓存。 */

const CACHE_VERSION = 'saas-command-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './themes.css',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // 后台静默刷新
        fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
