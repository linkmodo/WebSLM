// app.js — WebLLM primary runtime with WebGPU, WASM fallback via wllama

// CDN ESM endpoints (pin versions for stability)
const WEBLLM_URL = "https://unpkg.com/@mlc-ai/web-llm@0.2.79?module";
const WLLAMA_URL = "https://unpkg.com/@wllama/wllama@2.3.5/esm/wasm-from-cdn.js?module";


const els = {
  messages: document.getElementById("messages"),
  prompt: document.getElementById("prompt"),
  send: document.getElementById("send"),
  form: document.getElementById("chat-form"),
  fileInput: document.getElementById("file-input"),
  fileBtn: document.getElementById("file-btn"),
  filePreview: document.getElementById("file-preview"),
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
let currentModel = els.modelSelect.value || "";
let uploadedFiles = [];

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

// --- File handling functions ---
function getFileIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const iconMap = {
    // Text files
    'txt': '📄', 'md': '📝', 'json': '📋', 'csv': '📊', 'xml': '📄', 'html': '🌐',
    // Code files
    'js': '📜', 'ts': '📜', 'jsx': '⚛️', 'tsx': '⚛️', 'vue': '💚', 'py': '🐍', 
    'cpp': '⚙️', 'c': '⚙️', 'java': '☕', 'php': '🐘', 'rb': '💎', 'go': '🐹', 
    'rs': '🦀', 'sh': '🐚', 'yml': '⚙️', 'yaml': '⚙️',
    // Documents
    'pdf': '📕', 'docx': '📘', 'doc': '📘', 'rtf': '📄', 'odt': '📄',
    // Images
    'png': '🖼️', 'jpg': '🖼️', 'jpeg': '🖼️', 'gif': '🖼️', 'bmp': '🖼️', 
    'webp': '🖼️', 'svg': '🖼️'
  };
  return iconMap[ext] || '📎';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function readFileContent(file) {
  return new Promise((resolve, reject) => {
    // File size limits to prevent memory issues
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
    const MAX_TEXT_SIZE = 10 * 1024 * 1024; // 10MB for text files
    const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB for images
    
    // Check file size limits
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`File too large: ${formatFileSize(file.size)}. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`));
      return;
    }
    
    const reader = new FileReader();
    
    // Handle different file types with specific size limits
    if (file.type.startsWith('image/')) {
      if (file.size > MAX_IMAGE_SIZE) {
        reject(new Error(`Image too large: ${formatFileSize(file.size)}. Maximum image size is ${formatFileSize(MAX_IMAGE_SIZE)}.`));
        return;
      }
      reader.onload = () => resolve({
        type: 'image',
        content: reader.result,
        name: file.name,
        size: file.size
      });
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      // For PDFs, just store metadata without reading content to avoid memory issues
      resolve({
        type: 'pdf',
        content: `[PDF file: ${file.name} (${formatFileSize(file.size)}) - Content not loaded to prevent memory issues. Please use a smaller file or extract text manually.]`,
        name: file.name,
        size: file.size
      });
    } else {
      // Text-based files with chunked reading for large files
      if (file.size > MAX_TEXT_SIZE) {
        // For large text files, read only the first portion
        const blob = file.slice(0, MAX_TEXT_SIZE);
        reader.onload = () => resolve({
          type: 'text',
          content: reader.result + `\n\n[File truncated - showing first ${formatFileSize(MAX_TEXT_SIZE)} of ${formatFileSize(file.size)}]`,
          name: file.name,
          size: file.size,
          truncated: true
        });
        reader.readAsText(blob);
      } else {
        reader.onload = () => resolve({
          type: 'text',
          content: reader.result,
          name: file.name,
          size: file.size
        });
        reader.readAsText(file);
      }
    }
    
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
  });
}

function updateFilePreview() {
  if (uploadedFiles.length === 0) {
    els.filePreview.style.display = 'none';
    return;
  }
  
  els.filePreview.style.display = 'block';
  els.filePreview.innerHTML = uploadedFiles.map((file, index) => `
    <div class="file-item">
      <span class="file-icon">${getFileIcon(file.name)}</span>
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-size">${formatFileSize(file.size)}</div>
      </div>
      <button class="remove-file" onclick="removeFile(${index})">×</button>
    </div>
  `).join('');
}

window.removeFile = function(index) {
  uploadedFiles.splice(index, 1);
  updateFilePreview();
}

async function handleFileUpload(files) {
  const MAX_FILES = 10; // Limit number of files to prevent memory issues
  const totalFiles = uploadedFiles.length + files.length;
  
  if (totalFiles > MAX_FILES) {
    addMsg("assistant", `Too many files. Maximum ${MAX_FILES} files allowed. Currently have ${uploadedFiles.length} files.`);
    return;
  }
  
  // Calculate total size to prevent memory overload
  let totalSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);
  const newFilesSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
  const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total limit
  
  if (totalSize + newFilesSize > MAX_TOTAL_SIZE) {
    addMsg("assistant", `Total file size too large. Maximum total size is ${formatFileSize(MAX_TOTAL_SIZE)}. Current total: ${formatFileSize(totalSize)}, trying to add: ${formatFileSize(newFilesSize)}.`);
    return;
  }
  
  for (const file of files) {
    try {
      // Add progress indication for large files
      if (file.size > 5 * 1024 * 1024) { // 5MB
        addMsg("assistant", `Processing large file: ${file.name} (${formatFileSize(file.size)})...`);
      }
      
      const fileData = await readFileContent(file);
      uploadedFiles.push(fileData);
      
      // Force garbage collection hint for large files
      if (file.size > 10 * 1024 * 1024 && window.gc) {
        window.gc();
      }
      
    } catch (error) {
      console.error('Error reading file:', error);
      addMsg("assistant", `❌ Error reading file ${file.name}: ${error.message}`);
    }
  }
  updateFilePreview();
}

// --- Function-calling demo schema ---
const tools = [
  {
    type: "function",
    function: {
      name: "getTime",
      description: "Get the current local time as an ISO string.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Calculate the result of a mathematical expression.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "The mathematical expression to evaluate (e.g., '2 + 2 * 3')"
          }
        },
        required: ["expression"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getWeather",
      description: "Get the current weather for a specified location.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and optional state/country (e.g., 'New York' or 'London, UK')"
          }
        },
        required: ["location"]
      }
    }
  }
];

function toolRouter(name, args) {
  try {
    switch (name) {
      case "getTime":
        return { 
          success: true,
          time: new Date().toISOString(),
          formatted: new Date().toLocaleString()
        };
        
      case "calculate":
        try {
          // Security note: In a real app, you'd want to validate the expression
          // to prevent code injection. This is a simplified example.
          const result = Function(`return (${args.expression})`)();
          return { 
            success: true, 
            result: result,
            expression: args.expression
          };
        } catch (e) {
          return { 
            success: false, 
            error: "Invalid expression",
            message: e.message
          };
        }
        
      case "getWeather":
        // Mock weather data - in a real app, you'd call a weather API
        const weatherData = {
          location: args.location,
          temperature: Math.round(Math.random() * 30 + 10), // Random temp between 10-40°C
          condition: ["Sunny", "Partly Cloudy", "Cloudy", "Rainy", "Thunderstorm"][Math.floor(Math.random() * 5)],
          humidity: Math.round(Math.random() * 50 + 30), // 30-80%
          wind: (Math.random() * 20).toFixed(1) // 0-20 km/h
        };
        return { 
          success: true,
          ...weatherData
        };
        
      default:
        return { 
          success: false, 
          error: "Unknown function" 
        };
    }
  } catch (e) {
    return { 
      success: false, 
      error: "Error processing function call",
      message: e.message
    };
  }
}

// --- Runtime detection + init ---
async function init() {
  // Clear any existing messages
  els.messages.innerHTML = "";
  
  // Check if a model is selected
  if (!currentModel) {
    addMsg("assistant", "Please select a model from the Settings menu to get started.");
    updateChatInterface(false);
    return;
  }
  
  // Show loading state
  const loadingMsg = addMsg("assistant", "Loading model... This may take a moment as we download the model weights.");
  
  try {
    // Try WebGPU first
    if (navigator.gpu) {
      try {
        const webllm = await import(WEBLLM_URL);
        
        // Only try to populate model list if it's empty
        if (els.modelSelect.options.length <= 1) { // Assuming there's a default option
          try {
            const list = webllm.prebuiltAppConfig?.model_list || [];
            if (Array.isArray(list) && list.length) {
              // Keep the first option (if exists) and add the rest
              while (els.modelSelect.options.length > 1) {
                els.modelSelect.remove(1);
              }
              for (const m of list) {
                const opt = document.createElement("option");
                opt.value = m.model_id;
                opt.textContent = m.model_id;
                els.modelSelect.appendChild(opt);
              }
              // Select the first model by default if none selected
              if (!currentModel && list.length > 0) {
                currentModel = list[0].model_id;
                els.modelSelect.value = currentModel;
              }
            }
          } catch (e) {
            console.warn("Could not populate model list:", e);
            loadingMsg.textContent = "Error loading model list. Please check the console for details.";
            return;
          }
        }

        setBadge("WebGPU (WebLLM) — initializing…");
        els.initLabel.textContent = `Loading ${currentModel} (first run downloads weights)…`;

        const engineConfig = {
          initProgressCallback: (r) => {
            els.initLabel.textContent = r.text || "Loading model…";
            loadingMsg.textContent = r.text || "Loading model…";
          },
          appConfig: webllm.prebuiltAppConfig, // use the prebuilt model list
        };

        try {
          // Use the main-thread engine creation API compatible with v0.2.79
          engine = await webllm.CreateMLCEngine(
            currentModel,
            engineConfig
          );

          setBadge("WebGPU (WebLLM)");
          els.initLabel.textContent = `Model: ${currentModel.split('-')[0]}`;
          loadingMsg.textContent = `Model ${currentModel} loaded and ready!`;
          setTimeout(() => {
            loadingMsg.textContent = "How can I help you today?";
          }, 1000);
          runtime = "webgpu";
          // Enable chat interface for WebGPU success
          updateChatInterface(true);
          return; // Success, exit the function
        } catch (e) {
          console.error("Error initializing model:", e);
          loadingMsg.textContent = `Failed to load model: ${e.message}`;
          setBadge("Error loading model", false);
          updateChatInterface(false);
          return;
        }
      } catch (err) {
        console.warn("WebGPU path failed, will use WASM fallback:", err);
        // Do not rethrow here; allow outer catch to handle and continue to WASM
        throw err;
      }
    }
  } catch (err) {
    // Swallow error here to proceed to WASM fallback
  }

  // Fallback to WASM (wllama)
  runtime = "wasm";
  setBadge("WASM (wllama) — initializing…", true);
  els.initLabel.textContent = "Loading tiny GGUF (first run downloads)…";

  try {
    // Import the CDN helper; it can be a function (returning assets) OR a ready assets object.
    const { default: WasmFromCDN } = await import(WLLAMA_URL);
    const assets = (typeof WasmFromCDN === "function") ? WasmFromCDN() : WasmFromCDN;

    const { startWasmFallback } = await import("./fallback/wllama.js");
    engine = await startWasmFallback({ WasmFromCDN: assets });

    setBadge("WASM (wllama)");
    els.initLabel.textContent = "Ready (fallback).";
    // Enable chat interface for WASM fallback as well
    updateChatInterface(true);
  } catch (e) {
    console.error("Error initializing WASM fallback:", e);
    setBadge("Initialization failed", false);
    els.initLabel.textContent = "Failed to initialize. Check console for details.";
    throw e;
  }
}

// Initialize the application when the page loads
window.addEventListener('load', () => {
  try {
    init();
  } catch (error) {
    console.error("Error initializing application:", error);
  }
});


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
  
  // Prepare the message with file content if any
  let fullPrompt = prompt;
  if (uploadedFiles.length > 0) {
    try {
      const fileContents = uploadedFiles.map(file => {
        if (file.type === 'text') {
          // Limit text content length to prevent memory issues
          const maxTextLength = 50000; // 50KB of text per file
          let content = file.content;
          if (content.length > maxTextLength) {
            content = content.substring(0, maxTextLength) + `\n[Content truncated - showing first ${maxTextLength} characters of ${content.length}]`;
          }
          return `\n\n--- File: ${file.name} ---\n${content}\n--- End of ${file.name} ---`;
        } else if (file.type === 'image') {
          return `\n\n--- Image: ${file.name} (${formatFileSize(file.size)}) ---\n[Image content available for analysis]\n--- End of ${file.name} ---`;
        } else if (file.type === 'pdf') {
          return `\n\n--- PDF: ${file.name} (${formatFileSize(file.size)}) ---\n${file.content}\n--- End of ${file.name} ---`;
        }
        return `\n\n--- File: ${file.name} (${formatFileSize(file.size)}) ---\n[File content available]\n--- End of ${file.name} ---`;
      }).join('');
      
      // Check if the combined prompt is too large
      const maxPromptLength = 200000; // 200KB total prompt limit
      if ((prompt + fileContents).length > maxPromptLength) {
        addMsg("assistant", `❌ Combined message too large (${formatFileSize((prompt + fileContents).length)}). Please reduce file content or number of files. Maximum size: ${formatFileSize(maxPromptLength)}.`);
        return;
      }
      
      fullPrompt = prompt + fileContents;
      
      // Show user message with file indicator
      const fileIndicator = uploadedFiles.length > 0 ? ` 📎 (${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''})` : '';
      addMsg("user", prompt + fileIndicator);
      
      // Clear uploaded files after sending and force cleanup
      uploadedFiles = [];
      updateFilePreview();
      
      // Force garbage collection for memory cleanup
      if (window.gc) {
        window.gc();
      }
      
    } catch (error) {
      console.error('Error processing files:', error);
      addMsg("assistant", `❌ Error processing files: ${error.message}`);
      return;
    }
  } else {
    addMsg("user", prompt);
  }
  
  let bubble = addMsg("assistant", "…");
  if (runtime === "webgpu") {
    const webllm = await import(WEBLLM_URL);
    messages.push({ role: "user", content: fullPrompt });
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
    const out = await engine.complete(fullPrompt, { nPredict: 128, temp: 0.7 });
    bubble.textContent = out || "(no output)";
    messages.push({ role: "assistant", content: out || "" });
  } catch (e) {
    bubble.textContent = "Error: " + e.message;
    console.error(e);
  }
}

}


// Handle form submission
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.prompt.value.trim();
  if (!text) return;
  els.prompt.value = "";
  handleSend(text);
});

// Handle file upload
els.fileBtn.addEventListener('click', () => {
  els.fileInput.click();
});

els.fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileUpload(Array.from(e.target.files));
  }
});

// Handle drag and drop
els.messages.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

els.messages.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length > 0) {
    handleFileUpload(Array.from(e.dataTransfer.files));
  }
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

// Enable/disable chat interface based on model selection
function updateChatInterface(enabled) {
  els.prompt.disabled = !enabled;
  els.send.disabled = !enabled;
  els.fileBtn.disabled = !enabled;
  if (!enabled) {
    els.prompt.placeholder = "Please select a model from Settings first";
  } else {
    els.prompt.placeholder = "Ask anything (runs locally)...";
  }
  // The reload button only applies to WebGPU (WebLLM) path
  const reloadDisabled = runtime !== "webgpu";
  els.reloadModelBtn.disabled = reloadDisabled;
  els.reloadModelBtn.title = reloadDisabled ? "Reload available only for WebLLM (WebGPU) runtime" : "Reload the current WebLLM model";
}

// Initially disable chat interface
updateChatInterface(false);

// Update model description when selection changes
function updateModelDescription() {
  const selectedOption = els.modelSelect.options[els.modelSelect.selectedIndex];
  const description = selectedOption.getAttribute('data-desc') || 'No description available.';
  document.getElementById('model-description').textContent = description;
}

// Initialize model description
updateModelDescription();

// Add event listener for model selection changes
els.modelSelect.addEventListener('change', updateModelDescription);

// Initialize after model is selected
els.settingsDlg.addEventListener('close', async () => {
  const selectedModel = els.modelSelect.value;
  if (selectedModel && selectedModel !== currentModel) {
    currentModel = selectedModel;
    await init();
  } else if (!selectedModel) {
    currentModel = "";
    addMsg("assistant", "Please select a model from the Settings menu to get started.");
    updateChatInterface(false);
  }
});

// Show settings dialog on start (after all event listeners are set up)
if (els.settingsDlg) {
  // Use setTimeout to ensure the dialog shows after the page is fully loaded
  window.addEventListener('load', () => {
    els.settingsDlg.showModal();
  });
} else {
  console.error('Settings dialog element not found');
}


const FUNCTION_CALLING_MODELS = [
  "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC",
  "Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC",
  "Hermes-2-Pro-Mistral-7B-q4f16_1-MLC",
  "Hermes-3-Llama-3.1-8B-q4f32_1-MLC",
  "Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
  "Hermes-3-Llama-3.2-3B-q4f16_1-MLC",
  "Hermes-3-Llama-3.2-3B-q4f32_1-MLC",
  "Llama-3.1-8B-Instruct-q4f16_1-MLC",
  "Llama-3.1-8B-Instruct-q4f16_1-MLC-1k",
  "Llama-3.1-8B-Instruct-q4f32_1-MLC",
  "Llama-3.1-8B-Instruct-q4f32_1-MLC-1k",
  "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  "Llama-3.2-3B-Instruct-q4f32_1-MLC"
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
    if (bubble) {
      bubble.textContent = "Error: " + (e.message || "Failed to process request");
    }
  }
}
