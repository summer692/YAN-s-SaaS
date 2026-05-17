/* Atlas — Service Worker
 * 缓存策略：核心静态资源 cache-first + 后台静默刷新。
 * 更新策略：新 SW 安装后进入 waiting 状态，由页面 postMessage SKIP_WAITING
 *           来激活，避免打断正在使用的用户。下次冷启动也会自动激活。
 *
 * 部署提示：每次推送代码请把 CACHE_VERSION 的数字 +1，否则浏览器不会发现
 *           SW 文件变化，新版本不会被检测到。 */

const CACHE_VERSION = 'atlas-v26';
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './themes.css',
  './config.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './icons/apple-touch-icon.png',
  './icons/apple-touch-icon-120.png',
  './icons/apple-touch-icon-152.png',
  './icons/apple-touch-icon-167.png',
  './icons/apple-touch-icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // cache: 'reload' 绕过 HTTP 缓存，保证装入 SW 缓存的是网络最新版本
      cache.addAll(CORE_ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  // 不在此处 skipWaiting，等页面通知
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
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
