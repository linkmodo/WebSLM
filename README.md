# WebGPU WebLLM App (with WASM fallback)

Run an LLM **entirely in the browser**. Primary path uses **WebLLM + WebGPU**. If WebGPU isn't available, we **fallback to WASM** via **wllama** (no server, no keys).

## Features
- OpenAI-compatible **WebLLM** with **streaming** output
- **Function calling** demo (local JS function)
- **Service Worker** caching (static assets + model shards for repeat loads)
- **PWA** packaging (installable, offline-first UX)
- **WASM fallback** using **wllama** (single-thread by default to avoid COOP/COEP headers)

## Quick Start
1. **Serve statically** (any static server). Examples:
   - Python: `cd web && python -m http.server 8000`
   - Node (http-server): `npx http-server web -p 8000`
2. Open **http://localhost:8000** in **Chrome/Edge** (WebGPU enabled). First model load may take time (cached for next runs).
3. Click **Settings ⚙** to pick a model. Try the defaults first.

> If WebGPU is unavailable (or blocked), the app will **auto-switch to WASM**. This path uses a tiny demo GGUF so it loads quickly.

## Folder Map
```
/web
  index.html           # UI, registers SW, loads app.js
  app.js               # WebLLM logic + fallback orchestrator
  styles.css
  sw.js                # Service worker: caches app + model shards
  manifest.json        # PWA manifest
/fallback
  wllama.js            # WASM fallback using @wllama/wllama CDN
/tools
  quantize.py          # Notes & helper scaffold for GGUF prep (optional)
/docs
  pwa.md               # PWA/offline notes
  models.md            # Model choices, tradeoffs
/public
  icon-192.png         # Placeholder PWA icons
  icon-512.png
```

## Browser Support
- WebGPU: Chrome/Edge stable; Safari improving; Firefox partial (behind flags).
- WASM fallback works on most modern browsers.

## Notes
- Default **WebLLM** models come from MLC’s prebuilt list and will stream from CDN/HF on first load.
- Service worker caches **static assets** and tries to cache **model shards** so subsequent loads are faster.
- For **wllama** multi-threading, you would need COOP/COEP headers. We default to single-thread to keep it simple.

## Credits
- WebLLM by the MLC team.
- wllama by @ngxson (WASM binding for llama.cpp).
