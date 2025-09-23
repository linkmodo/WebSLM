# Crazy Bananas SLM - Small Language Model (Web Edition)

<div align="center">
  <img src="./web/public/logo.png" alt="Crazy Bananas SLM Logo" width="200">
</div>

Run an LLM **entirely in the browser**. Primary path uses **WebLLM + WebGPU**. If WebGPU isn't available, we **fallback to WASM** via **wllama** (no server, no keys).

## Features
- **Model selection dialog** with descriptions; dialog is centered and has a dark backdrop for readability
- OpenAI-compatible **WebLLM** with **streaming** output
- Optional **function calling** support (for select models like Hermes and Llama 3.x)
- **File upload** support (button and drag‑and‑drop) for text/code/docs/images; files can be attached to prompts
- **Service Worker** caching (static assets + model shards for repeat loads)
- **PWA** packaging (installable, offline-first UX)
- **WASM fallback** using **wllama** (single-thread by default to avoid COOP/COEP headers)
- Runtime‑aware **Reload model** button (enabled only on WebGPU/WebLLM)

## Installation & Running

### Clone and Setup
```bash
git clone https://github.com/linkmodo/WebSLM.git
cd WebSLM
npx http-server web -p 8000
```

### Access the Application
1. Open **http://localhost:8000** in **Chrome/Edge** (WebGPU enabled)
2. First model load may take time (cached for next runs)
3. Click **Settings ⚙** to pick a model. Try the defaults first

> If WebGPU is unavailable (or blocked), the app will **auto-switch to WASM**. This path uses a tiny demo GGUF so it loads quickly.

## Folder Map
```
/web
  index.html            # UI, registers SW, loads app.js
  app.js                # WebLLM logic + runtime/fallback orchestrator
  styles.css
  sw.js                 # Service worker: caches app + model shards
  manifest.json         # PWA manifest
  /fallback
    wllama.js           # WASM fallback using @wllama/wllama CDN
  /public
    logo.png            # App logo used in header
/tools
  quantize.py           # Notes & helper scaffold for GGUF prep (optional)
/docs
  pwa.md                # PWA/offline notes
  models.md             # Model choices, tradeoffs
```

## Browser Support
- WebGPU: Chrome/Edge stable; Safari improving; Firefox partial (behind flags).
- WASM fallback works on most modern browsers.

## Deployment

### Deploy to Netlify

#### Method 1: Deploy from GitHub (Recommended)
1. Push your code to GitHub (e.g., `https://github.com/linkmodo/WebSLM`) - obviously use your own repo
2. Log into Netlify (https://app.netlify.com)
3. Click **"Add new site"** → **"Import an existing project"**
4. Connect to GitHub and select your repository (`linkmodo/WebSLM`)
5. Configure build settings:
   - **Base directory**: Leave blank
   - **Build command**: Leave blank (no build needed)
   - **Publish directory**: `web`
6. Click **"Deploy site"**

#### Method 2: Drag and Drop
1. Open Netlify Drop (https://app.netlify.com/drop)
2. Drag the entire `web` folder directly onto the page
3. Site deploys instantly

## Notes
- Default **WebLLM** models come from MLC’s prebuilt list and will stream from CDN/HF on first load.
- Service worker caches **static assets** and tries to cache **model shards** so subsequent loads are faster.
- For **wllama** multi-threading, you would need COOP/COEP headers. We default to single-thread to keep it simple.

## Tech Stack

### Frontend Technologies
- **HTML5** - Semantic markup with modern web standards
- **CSS3** - Custom styling (no frameworks, pure CSS)
- **Vanilla JavaScript (ES6+)** - No framework dependencies, using modern ES modules

### AI/ML Libraries
- **WebLLM** (v0.2.79) - Browser-based LLM inference engine by MLC
- **Wllama** (v2.3.5) - WebAssembly fallback for LLM inference
- **WebGPU API** - For GPU acceleration (primary runtime)
- **WebAssembly (WASM)** - Fallback runtime when WebGPU unavailable

### Model Selection and Supported IDs
Select models from the Settings dialog. First load will download model shards (cached afterwards).

**Updated Model List (2024 - WebLLM v0.2.79 Compatible):**

**Ultra Small Models (< 1B parameters):**
- `SmolLM2-135M-Instruct-q0f16-MLC` — Ultra-fast tiny model (~360MB VRAM)
- `SmolLM2-360M-Instruct-q4f16_1-MLC` — Very fast small model (~376MB VRAM)

**Small Models (1-2B parameters):**
- `Llama-3.2-1B-Instruct-q4f16_1-MLC` — Meta's latest ultra-compact model (~879MB VRAM)
- `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` — Alibaba's tiny but capable model (~945MB VRAM)
- `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` — Balanced small model (~1.6GB VRAM)
- `SmolLM2-1.7B-Instruct-q4f16_1-MLC` — HuggingFace's efficient model (~1.8GB VRAM)

**Medium Models (2-4B parameters):**
- `gemma-2-2b-it-q4f16_1-MLC-1k` — Google's latest efficient model (~1.6GB VRAM)
- `Qwen2.5-3B-Instruct-q4f16_1-MLC` — Alibaba's mid-size model (~2.5GB VRAM)
- `Phi-3.5-mini-instruct-q4f16_1-MLC-1k` — Microsoft's latest small model (~2.5GB VRAM)

**Large Models (7-8B parameters):**
- `Mistral-7B-Instruct-v0.3-q4f16_1-MLC` — Recommended general use (~4.6GB VRAM)
- `Llama-3.1-8B-Instruct-q4f16_1-MLC-1k` — Meta's powerful model (~4.6GB VRAM)
- `Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC` — Function calling support (~5GB VRAM)
- `Hermes-3-Llama-3.1-8B-q4f16_1-MLC` — Latest Hermes with advanced capabilities (~4.9GB VRAM)

**Specialized Models:**
- `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` — Coding specialist (~1.6GB VRAM)
- `Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC` — Advanced coding model (~2.5GB VRAM)
- `Qwen2.5-Math-1.5B-Instruct-q4f16_1-MLC` — Mathematical reasoning (~1.6GB VRAM)

**DeepSeek Models:**
- `DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC` — Latest DeepSeek reasoning model (~5.1GB VRAM)
- `DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC` — DeepSeek reasoning based on Llama (~5GB VRAM)

**Note:** Previous models like `Phi-2-q4f16_1-MLC` and `DeepSeek-Coder-1.3B-Instruct-q4f16_1-MLC` are no longer in the WebLLM prebuilt config and have been replaced with newer, more efficient alternatives.

Function calling is supported by select models (e.g., Hermes 2 Pro, Llama 3.x instruct). Demo buttons were removed from UI for simplicity, but function calling can still be invoked programmatically.

### File Uploads (Attach Context) - Enhanced Memory Management
- Click the paperclip button or drag & drop files into the chat area
- **File Size Limits (to prevent memory allocation errors):**
  - Maximum individual file size: 50MB
  - Maximum text file size: 10MB (larger files are truncated)
  - Maximum image file size: 20MB
  - Maximum total files: 10 files
  - Maximum combined size: 100MB
- **Supported types:** text/code (`.txt`, `.md`, `.json`, `.csv`, `.xml`, `.html`, `.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.py`, `.cpp`, `.c`, `.java`, `.php`, `.rb`, `.go`, `.rs`, `.sh`, `.yml`, `.yaml`), docs (`.pdf`, `.docx`, `.doc`, `.rtf`, `.odt`), images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp`, `.svg`)
- **Smart Processing:**
  - Text/code contents are inlined into the prompt with length limits
  - Large text files are automatically truncated with notification
  - PDFs show metadata only to prevent memory issues
  - Images are processed as data URLs (model capabilities vary)
  - Automatic memory cleanup after processing
- Remove attachments before sending using the × button in the preview
- **Memory Management:** Automatic garbage collection hints and chunked processing for large files

### Progressive Web App (PWA)
- **Service Worker** (`sw.js`) - For offline functionality
- **Web App Manifest** (`manifest.json`) - For installability
- **Icons** - PWA icons (192px, 512px)

### Development/Deployment
- **HTTP Server** - Using `npx http-server` for local development
- **No Backend Required** - Completely client-side execution
- **CDN Dependencies** - Libraries loaded from unpkg CDN

### Key Features
- Runs 100% locally in browser
- No API keys required
- No server dependencies
- WebGPU with WASM fallback
- Optional function calling support (for supported models)
- Persistent settings via localStorage
- File upload and drag‑and‑drop for context

## Credits
- WebLLM by the MLC team
- wllama by @ngxson (WASM binding for llama.cpp)
- Original Script by Dr. Ernesto Lee / LVNG.ai