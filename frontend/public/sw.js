/* JharSetu service worker — app-shell caching with a strict rule:
 * /api/* is NEVER intercepted. Auth, uploads, pledges and every mutation go
 * straight to the network, so a cached response can never fake a session or
 * swallow a report. Bump VERSION to invalidate old caches on deploy. */
const VERSION = "jharsetu-v1";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add("/"))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.hostname === "fonts.gstatic.com" ||
    url.hostname === "fonts.googleapis.com"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !isStaticAsset(url)) return;

  // API and auth traffic: network only, never cached, never faked.
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: network first, shell fallback when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((cache) => cache.put("/", copy)).catch(() => undefined);
          return res;
        })
        .catch(() =>
          caches.match("/").then(
            (cached) =>
              cached ??
              new Response("JharSetu needs a connection for this page.", {
                status: 503,
                headers: { "Content-Type": "text/plain" },
              }),
          ),
        ),
    );
    return;
  }

  // Static assets and images: cache first, refresh in background.
  if (isStaticAsset(url) || request.destination === "image") {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((cache) => cache.put(request, copy)).catch(() => undefined);
            }
            return res;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
  }
});
