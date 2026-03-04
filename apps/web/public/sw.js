// JARVIS DCS — Manual Service Worker
// Cache strategy:
//   cache-first  → /_next/static/** (immutable, hashed)
//   network-first → navigation (HTML pages) with offline fallback
//   network-only  → Supabase, /api/**, RSC payloads, auth endpoints
//   pass-through  → everything else

const CACHE_NAME = 'jarvis-app-shell-v1';
const STATIC_CACHE = 'jarvis-static-v1';

// ─── Install ────────────────────────────────────────────────────────────────
// Pre-cache the offline fallback only. Do NOT call skipWaiting here — let the
// user control updates via the SKIP_WAITING message to avoid mid-flight reload.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/offline.html']))
  );
});

// ─── Message ────────────────────────────────────────────────────────────────
// The app sends 'SKIP_WAITING' when the user explicitly accepts an update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Enable navigation preload to cut response latency on navigate requests.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }

      // Purge stale caches from previous SW versions.
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );

      // Take immediate control of all open clients.
      await self.clients.claim();
    })()
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests — POST/PUT/DELETE must never be intercepted.
  if (request.method !== 'GET') return;

  // 2. Skip Supabase requests — live telemetry data must always be fresh.
  if (url.hostname.includes('supabase.co')) return;

  // 3. Skip API routes — server actions must reach the origin.
  if (url.pathname.startsWith('/api/')) return;

  // 4. Skip RSC payloads — intercepting these causes React hydration errors.
  if (
    url.searchParams.has('_rsc') ||
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1'
  ) return;

  // 5. Cache-first for immutable Next.js static assets (content-hashed filenames).
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 6. Network-first for navigation (HTML page) requests with offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        // Use preloaded response if available (faster time-to-first-byte).
        const preloadResponse = event.preloadResponse && await event.preloadResponse;
        if (preloadResponse) return preloadResponse;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Network unavailable — serve cached page or offline fallback.
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/offline.html');
        }
      })()
    );
    return;
  }

  // 7. Cache-first for other public static assets (icons, images, fonts).
  const isPublicStatic =
    url.pathname.startsWith('/icons/') ||
    /\.(png|jpg|jpeg|svg|webp|gif|woff2|woff|ttf)$/.test(url.pathname);

  if (isPublicStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 8. Everything else — fall through to browser default network handling.
});
