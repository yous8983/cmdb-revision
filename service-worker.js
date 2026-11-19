/* Service worker — fonctionnement hors ligne.
   ⚠ Incrémenter CACHE_VERSION à chaque modification de code ou de contenu. */
const CACHE_VERSION = 1;
const CACHE_NAME = 'cmdb-revision-v' + CACHE_VERSION;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'css/style.css',
  'js/progress.js',
  'js/quiz.js',
  'js/app.js',
  'data/themes.json',
  'data/notions.json',
  'data/questions.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cmdb-revision-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Données : réseau d'abord (contenu frais), repli sur le cache hors ligne.
  if (req.url.includes('/data/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // App shell : cache d'abord.
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
