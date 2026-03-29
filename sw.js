// Service Worker — Kandra Domy
// Mise en cache de tous les fichiers pour fonctionnement hors ligne

const CACHE_NAME = 'kandra-domy-v' + 'temp_1774783721';
const FILES = [
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/rules.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Installation : mise en cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

// Activation : supprime les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Requêtes : cache en priorité (offline first)
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
