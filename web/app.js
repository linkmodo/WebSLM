// app.js — WebLLM primary runtime with WebGPU, WASM fallback via wllama

// CDN ESM endpoints (pin versions for stability)
const WEBLLM_URL = "https://unpkg.com/@mlc-ai/web-llm@0.2.79?module";
const WLLAMA_URL = "https://unpkg.com/@wllama/wllama@2.3.5/esm/wasm-from-cdn.js?module";



const els = {
  messages: document.getElementById("messages"),
  prompt: document.getElementById("prompt"),
  send: document.getElementById("send"),
  form: document.getElementById("chat-form"),
  toolBtn: document.getElementById("btn-tool-demo"),
  initLabel: document.getElementById("init-label"),
  runtimeBadge: document.getElementById("runtime-badge"),
  settingsDlg: document.getElementById("settings"),
  settingsBtn: document.getElementById("btn-settings"),
  closeSettingsBtn: document.getElementById("btn-close-settings"),
  modelSelect: document.getElementById("model-select"),
  reloadModelBtn: document.getElementById("btn-reload-model"),
  clearBtn: document.getElementById("btn-clear"),
};

let engine = null;
let runtime = "detecting"; // "webgpu" | "wasm"
let messages = [{ role: "system", content: "You are a concise, helpful assistant that runs 100% locally in the user's browser." }];
let currentModel = els.modelSelect.value;

// --- UI helpers ---
function addMsg(who, text) {
  const row = document.createElement("div");
  row.className = "msg " + (who === "assistant" ? "assistant" : "user");
  const whoEl = document.createElement("div");
  whoEl.className = "who";
  whoEl.textContent = who;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.append(whoEl, bubble);
  els.messages.append(row);
  els.messages.scrollTop = els.messages.scrollHeight;
  return bubble;
}
function setBadge(txt, ok = true) {
  els.runtimeBadge.textContent = txt;
  els.runtimeBadge.style.background = ok ? "#dcfce7" : "#fee2e2";
  els.runtimeBadge.style.border = "1px solid " + (ok ? "#bbf7d0" : "#fecaca");
  els.runtimeBadge.style.color = ok ? "#14532d" : "#7f1d1d";
}

// --- Function-calling demo schema ---
const tools = [{
  type: "function",
  function: {
    name: "getTime",
    description: "Get the current local time as an ISO string.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
}];

function toolRouter(name, _args) {
  if (name === "getTime") {
    return { now: new Date().toISOString() };
  }
  return { error: "Unknown tool" };
}

// --- Runtime detection + init ---
async function init() {
  // Try WebGPU first
  if (navigator.gpu) {
    try {
      const webllm = await import(WEBLLM_URL);

      // Dynamically populate the model dropdown from WebLLM's prebuilt list
      try {
        const list = webllm.prebuiltAppConfig?.model_list || [];
        if (Array.isArray(list) && list.length) {
          els.modelSelect.innerHTML = "";
          for (const m of list) {
            const opt = document.createElement("option");
            opt.value = m.model_id;          // <-- guaranteed valid ID
            opt.textContent = m.model_id;
            els.modelSelect.appendChild(opt);
          }
          currentModel = els.modelSelect.value;
        }
      } catch (e) {
        console.warn("Could not populate model list:", e);
      }

      setBadge("WebGPU (WebLLM) — initializing…");
      els.initLabel.textContent = "Loading model (first run downloads weights)…";

      const engineConfig = {
        initProgressCallback: (r) => (els.initLabel.textContent = r.text || "Loading…"),
        appConfig: webllm.prebuiltAppConfig, // use the prebuilt model list
      };

      engine = await webllm.CreateMLCEngine(currentModel, engineConfig);
      runtime = "webgpu";
      setBadge("WebGPU (WebLLM)");
      els.initLabel.textContent = "Ready.";
      return;
    } catch (err) {
      console.warn("WebGPU path failed, falling back to WASM:", err);
    }
  }

  // Fallback to WASM (wllama)
  // Fallback to WASM (wllama)
  runtime = "wasm";
  setBadge("WASM (wllama) — initializing…", true);
  els.initLabel.textContent = "Loading tiny GGUF (first run downloads)…";

  // Import the CDN helper; it can be a function (returning assets) OR a ready assets object.
// inside init(), WASM fallback block in app.js
const { default: WasmFromCDN } = await import(WLLAMA_URL);
const assets = (typeof WasmFromCDN === "function") ? WasmFromCDN() : WasmFromCDN;

const { startWasmFallback } = await import("./fallback/wllama.js");
engine = await startWasmFallback({ WasmFromCDN: assets });


  setBadge("WASM (wllama)");
  els.initLabel.textContent = "Ready (fallback).";
}


async function reloadModel() {
  if (runtime !== "webgpu") return alert("Model reload only applies to WebLLM path.");
  els.initLabel.textContent = "Reloading model…";
  const webllm = await import(WEBLLM_URL);
  const cfg = { initProgressCallback: (r) => (els.initLabel.textContent = r.text || "Loading…") };
  engine = await webllm.CreateMLCEngine(currentModel, cfg);
  els.initLabel.textContent = "Ready.";
}

// --- Chat send ---
async function handleSend(prompt) {
  if (!engine) return;
  addMsg("user", prompt);
  let bubble = addMsg("assistant", "…");
  if (runtime === "webgpu") {
    const webllm = await import(WEBLLM_URL);
    messages.push({ role: "user", content: prompt });
    try {
      const chunks = await engine.chat.completions.create({
        messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: Number(document.getElementById("temperature").value || 0.7),
        seed: Number(document.getElementById("seed").value || 0),
      });
      let acc = "";
      for await (const ch of chunks) {
        const delta = ch.choices?.[0]?.delta?.content || "";
        acc += delta;
        bubble.textContent = acc;
      }
      messages.push({ role: "assistant", content: acc });
    } catch (e) {
      bubble.textContent = "Error: " + e.message;
      console.error(e);
    }
} else {
  try {
    bubble.textContent = "Thinking (WASM)…";
    const out = await engine.complete(prompt, { nPredict: 128, temp: 0.7 });
    bubble.textContent = out || "(no output)";
    messages.push({ role: "assistant", content: out || "" });
  } catch (e) {
    bubble.textContent = "Error: " + e.message;
    console.error(e);
  }
}

}


els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.prompt.value.trim();
  if (!text) return;
  els.prompt.value = "";
  handleSend(text);
});

els.toolBtn.addEventListener("click", () => { runToolDemo(); return; /* below is legacy */

  
});

els.settingsBtn.addEventListener("click", () => els.settingsDlg.showModal());
els.closeSettingsBtn?.addEventListener("click", () => els.settingsDlg.close());

els.reloadModelBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  currentModel = els.modelSelect.value;
  await reloadModel();
});

els.clearBtn.addEventListener("click", () => {
  messages = [{ role: "system", content: "You are a concise, helpful assistant that runs 100% locally in the user's browser." }];
  els.messages.innerHTML = "";
});

// Kick off init
init();


const FUNCTION_CALLING_MODELS = [
  "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC",
  "Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC",
  "Hermes-2-Pro-Mistral-7B-q4f16_1-MLC",
  "Hermes-3-Llama-3.1-8B-q4f32_1-MLC",
  "Hermes-3-Llama-3.1-8B-q4f16_1-MLC"
];

async function runToolDemo() {
  if (!engine) return;
  
  // Check if current model supports function calling
  const modelId = els.modelSelect.value;
  const supportsFunctionCalling = FUNCTION_CALLING_MODELS.includes(modelId);
  
  if (!supportsFunctionCalling) {
    const errorMsg = `This model (${modelId}) does not support function calling.\n\n` +
      `Please switch to one of the following models that support function calling:\n` +
      FUNCTION_CALLING_MODELS.join('\n');
    addMsg("assistant", errorMsg);
    return;
  }

  const q = "What time is it now? If you can, call getTime().";
  addMsg("user", q);
  let bubble = addMsg("assistant", "…");

  try {
    // First, get the model's response which may include a tool call
    const response = await engine.chat.completions.create({
      messages: [...messages, { role: "user", content: q }],
      tools,
      tool_choice: "auto",
    });

    const message = response.choices[0]?.message;
    
    // Check if the model wants to call a tool
    if (message.tool_calls && message.tool_calls.length > 0) {
      const call = message.tool_calls[0];
      if (call.function.name === "getTime") {
        // Call the tool
        const toolResult = toolRouter(call.function.name, call.function.arguments ? JSON.parse(call.function.arguments) : {});
        
        // Add the tool response to the messages
        messages.push({
          role: "assistant",
          content: "",
          tool_calls: [{
            id: call.id,
            type: "function",
            function: {
              name: call.function.name,
              arguments: call.function.arguments || ""
            }
          }]
        });
        
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(toolResult)
        });
        
        // Get the final response from the model
        const finalResponse = await engine.chat.completions.create({
          messages: messages,
          tools: tools
        });
        
        const finalMessage = finalResponse.choices[0]?.message?.content || "I've checked the time for you.";
        bubble.textContent = finalMessage;
        messages.push({ role: "assistant", content: finalMessage });
      }
    } else {
      // If no tool call, just show the model's response
      const responseText = message?.content || "I couldn't determine the current time.";
      bubble.textContent = responseText;
      messages.push({ role: "assistant", content: responseText });
    }
  } catch (e) {
    console.error("Error in runToolDemo:", e);
    bubble.textContent = "Error: " + (e.message || "Failed to process request");
  }
}
