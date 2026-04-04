const CACHE_NAME = 'sport-sante-v8';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/auth.js',
  './js/config.js',
  './js/db.js',
  './js/coach.js',
  './js/router.js',
  './js/utils.js',
  './js/version.js',
  './js/program-data.js',
  './js/components/nav.js',
  './js/views/login.js',
  './js/views/dashboard.js',
  './js/views/workout.js',
  './js/views/sleep.js',
  './js/views/weekly.js',
  './js/views/charts.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for everything (offline fallback to cache)
self.addEventListener('fetch', (event) => {
  // Only cache GET requests (POST, etc. are not supported by Cache API)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // version.js: always bypass HTTP cache
  const fetchOptions = url.pathname.endsWith('version.js')
    ? { cache: 'no-store' }
    : {};

  event.respondWith(
    fetch(event.request, fetchOptions)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
