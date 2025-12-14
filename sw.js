const CACHE = "railtrail-v2";
const OFFLINE_URL = "./offline.html";
const ASSETS = [
  "./",
  "./index.html",
  "./main.js",
  "./styles.css",
  "./manifest.json",
  "./offline.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./music/bgm/game_theme.wav",
  "./music/bgm/game_op.wav",
  "./music/se/news.wav",
  "./music/se/fanfare.wav"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(oldKey => caches.delete(oldKey))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const acceptHeader = event.request.headers.get("accept") || "";
  if (event.request.mode === "navigate" ||
      (event.request.method === "GET" && acceptHeader.includes("text/html"))) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
