// fallback/wllama.js — tiny WASM demo using @wllama/wllama
// We intentionally use a very small GGUF for a quick first-run demo.
// For better quality, switch to a quantized chat model in GGUF (docs/models.md).

export async function startWasmFallback({ WasmFromCDN }) {
  const mod = await import("https://esm.sh/@wllama/wllama@2.3.5/esm/index.js");
  const { Wllama } = mod;
  const wllama = new Wllama(WasmFromCDN); // single-thread by default

  // Load a tiny demo model (fast download). Replace with a chat GGUF later.
  // Repo: ggml-org/models  File: tinyllamas/stories260K.gguf
  await wllama.loadModelFromHF("ggml-org/models", "tinyllamas/stories260K.gguf");

  return {
    // Minimal adapter so app.js can call complete()
    async complete(prompt, opts = {}) {
      const out = await wllama.createCompletion(prompt, {
        nPredict: opts.nPredict ?? 128,
        sampling: { temp: opts.temp ?? 0.7, top_k: 40, top_p: 0.9 },
      });
      return out;
    }
  };
}
