export async function startWasmFallback({ WasmFromCDN }) {
  const { Wllama } = await import("https://esm.sh/@wllama/wllama@2.3.5/esm/index.js");
  const wllama = new Wllama(WasmFromCDN);

  await wllama.loadModelFromUrl(
    "https://huggingface.co/ggml-org/models/resolve/main/tinyllamas/stories260K.gguf?download=true"
  );

  return {
    async complete(prompt, opts = {}) {
      return wllama.createCompletion(prompt, {
        nPredict: opts.nPredict ?? 128,
        sampling: { temp: opts.temp ?? 0.7, top_k: 40, top_p: 0.9 },
      });
    }
  };
}
