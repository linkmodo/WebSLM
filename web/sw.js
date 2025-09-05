// sw.js — cache static assets + attempt to cache model shards for faster reloads
const CACHE = "webllm-cache-v1";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "../public/icon-192.png",
  "../public/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Heuristic: cache-first for model shards & tokenizer/wasm
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
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
    );
    return;
  }

  // Default: network-first with fallback to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
