# PWA & Offline Notes
- Service worker caches static assets (`index.html`, `app.js`, etc.) and **attempts** to cache model shards (`.gguf`, `.wasm`, MLC/CDN files).
- First load still requires network to fetch model artifacts; subsequent loads are faster / can work offline if fully cached.
- Add to Home Screen/Install via the browser menu to get a standalone look.
