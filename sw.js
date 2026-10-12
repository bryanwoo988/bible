// Offline support: app shell is precached; Bible text is cached as it is read
// (and prefetched in the background by the app).
const VERSION = "v8";
const SHELL = `shell-${VERSION}`;
const DATA = "data-v1"; // bump only when the text files change

const SHELL_FILES = [
  "./",
  "index.html",
  "css/app.css",
  "js/app.js",
  "js/books.js",
  "js/intro.js",
  "js/intro-zht.js",
  "js/i18n.js",
  "js/strings/zhs.js",
  "js/strings/zht.js",
  "js/strings/en.js",
  "js/store.js",
  "js/versions.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/logo.png",
  "icons/favicon-64.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // Bible text never changes: cache first.
  if (url.pathname.includes("/data/")) {
    e.respondWith(
      caches.open(DATA).then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }),
    );
    return;
  }

  // App shell: network first so updates show up, fall back to cache offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) caches.open(SHELL).then((c) => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))),
  );
});
