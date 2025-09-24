// sw.js — cache static assets + attempt to cache model shards for faster reloads
// Updated to fix CORS issues with cross-origin requests
const CACHE = "webllm-cache-v3-fixed";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./public/icon-192.png",
  "./public/icon-512.png",
  "./public/logo.png",
];

self.addEventListener("install", (event) => {
  console.log('🔧 SW: Installing with cache:', CACHE);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => {
      console.log('📦 SW: Caching app assets');
      return c.addAll(APP_ASSETS);
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log('✅ SW: Activated, claiming clients');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE) {
              console.log('🗑️ SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  // CRITICAL: Only handle same-origin requests to avoid CORS issues
  // Let cross-origin requests (CDNs, unpkg, jsDelivr) go through normally
  if (url.origin !== self.location.origin) {
    console.log('🌐 SW: Ignoring cross-origin request:', url.href);
    // Don't intercept cross-origin requests - let browser handle them
    return;
  }
  
  console.log('🏠 SW: Handling same-origin request:', url.pathname);
  
  // Only handle same-origin requests from here
  // Heuristic: cache-first for model shards & tokenizer/wasm (same-origin only)
  const isModel =
    url.hostname.includes("huggingface.co") ||
    url.href.includes(".gguf") ||
    url.href.includes("mlc-ai") ||
    url.href.includes("web-llm") ||
    url.href.includes(".wasm");

  if (isModel) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch (error) {
          console.error('SW: Failed to fetch model resource:', error);
          throw error;
        }
      })
    );
    return;
  }

  // Default: network-first with fallback to cache (same-origin only)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
