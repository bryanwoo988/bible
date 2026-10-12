// Offline support: app shell is precached; Bible text is cached as it is read
// (and prefetched in the background by the app).
// Other apps live on the same bryanwoo988.github.io origin and share the
// Cache Storage, so every cache name carries this app's prefix and only
// caches with that prefix are ever deleted here.
const PREFIX = "bible-";
const VERSION = "v12";
const SHELL = `${PREFIX}shell-${VERSION}`;
const DATA = `${PREFIX}data-v1`; // bump only when the text files change
// Names used before the prefix (up to shell-v11 / data-v1). Nobody else on
// the origin uses them; the downloaded text is moved over, not fetched again.
const LEGACY_SHELL = /^shell-v\d+$/;
const LEGACY_DATA = "data-v1";

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

async function moveLegacyData(keys) {
  if (!keys.includes(LEGACY_DATA)) return;
  const [from, to] = await Promise.all([caches.open(LEGACY_DATA), caches.open(DATA)]);
  const scope = new URL("./", self.location).href;
  for (const req of await from.keys()) {
    if (!req.url.startsWith(scope)) continue;
    const res = await from.match(req);
    if (res && !(await to.match(req))) await to.put(req, res);
  }
  await caches.delete(LEGACY_DATA);
}

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await moveLegacyData(keys);
    const old = keys.filter((k) => (k.startsWith(PREFIX) && k !== SHELL && k !== DATA) || LEGACY_SHELL.test(k));
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
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
  // "no-cache" revalidates with the server so a new app.js is never mixed with
  // stale strings or styles from the browser's HTTP cache.
  e.respondWith(
    fetch(url.href, { cache: "no-cache", credentials: "same-origin" })
      .then((res) => {
        if (res.ok) caches.open(SHELL).then((c) => c.put(e.request, res.clone()));
        return res;
      })
      .catch(async () => {
        const shell = await caches.open(SHELL);
        return (await shell.match(e.request, { ignoreSearch: true })) || (await shell.match("index.html")) || Response.error();
      }),
  );
});
