const CACHE_NAME = 'sndeck-v11';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/cyberpunk-theme.css',
  './js/id3-parser.js',
  './js/sound-effects.js',
  './js/sample-tracks.js',
  './js/audio-engine.js',
  './js/playlist-manager.js',
  './js/visualizer.js',
  './js/ripper-engine.js',
  './js/app.js',
  './assets/cyber_vinyl.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
