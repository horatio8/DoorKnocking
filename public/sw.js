// Campaign OS — Door Knock Service Worker
// Precaches the app shell; network-first for HTML, cache-first for static
// assets and Mapbox tiles. Background sync is handled by the Zustand
// outbox + flushOutbox() in the React app, not here.

const CACHE_VERSION = "v1";
const SHELL_CACHE = `campaignos-shell-${CACHE_VERSION}`;
const TILES_CACHE = `campaignos-tiles-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "/",
  "/app",
  "/login",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("campaignos-") && !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // Mapbox tiles: cache-first with revalidation
  if (/api\.mapbox\.com|tiles\.mapbox\.com/.test(url.hostname)) {
    event.respondWith(cacheFirst(TILES_CACHE, event.request));
    return;
  }

  // HTML: network-first, fall back to shell
  if (event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(SHELL_CACHE, event.request));
    return;
  }

  // Other assets: cache-first
  if (url.origin === self.location.origin && /\.(js|css|png|svg|woff2?|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(SHELL_CACHE, event.request));
  }
});

async function cacheFirst(name, request) {
  const cache = await caches.open(name);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then((res) => cache.put(request, res.clone()))
      .catch(() => void 0);
    return cached;
  }
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(name, request) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return cache.match("/app") ?? Response.error();
  }
}
