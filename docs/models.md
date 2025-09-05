# Model Choices (WebLLM + WASM)

## WebLLM (WebGPU)
Use prebuilt IDs from MLC (examples you can try in **Settings → Model**):
- `TinyLlama-1.1B-Chat-v0.4-q4f16_1` (very small, fastest)
- `Phi-2-q4f16_1` (small, good quality for size)
- `Mistral-7B-Instruct-v0.2-q4f16_1` (heavier)
- `Llama-3.1-8B-Instruct` (heavier; needs more VRAM/system RAM)

> Tip: first run downloads model shards; later runs use the cache.

## WASM fallback (wllama)
- Start with a **tiny** GGUF for quick demo: `ggml-org/models : tinyllamas/stories260K.gguf`
- Upgrade to a chat model later, e.g. a TinyLlama or Phi-2 GGUF from Hugging Face.
- For files >2GB, **split** into 512MB chunks with `llama-gguf-split` (part of llama.cpp).

## Quality vs Size
- 1B–3B models: responsive UI, OK for simple Q&A.
- 7B+ models: better answers but larger downloads and memory use.
