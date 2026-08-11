// Minimal offline app-shell service worker.
// Network-first for navigations so online users always get fresh content;
// cache is only ever a fallback when the network request genuinely fails.
// Static, content-hashed assets are cache-first since they never change
// under a given URL.

const SHELL_CACHE = "shell-v1";
const STATIC_CACHE = "static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/") || // includes /_next/static/ and the
    // /_next/image optimizer endpoint next/image routes all <Image> src
    // requests through (e.g. the header logo) — both are safe to cache
    // since the same URL+params always produce the same output.
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.json" ||
    /\.(png|jpe?g|svg|ico|webp|gif)$/i.test(pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match(request)) ||
            (await cache.match("/")) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          cache.put(request, response.clone());
          return response;
        } catch {
          return Response.error();
        }
      })()
    );
  }
});
