// Shared LLM engine loader: WebGPU (WebLLM) when a real adapter exists, else CPU (wllama WASM).
export const MODELS = {
  smol: { label: "SmolLM2 360M — fast", mlc: "SmolLM2-360M-Instruct-q4f16_1-MLC", gguf: { repo: "bartowski/SmolLM2-360M-Instruct-GGUF", file: "SmolLM2-360M-Instruct-Q4_K_M.gguf" } },
  qwen: { label: "Qwen2.5 1.5B — better", mlc: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", gguf: { repo: "Qwen/Qwen2.5-1.5B-Instruct-GGUF", file: "qwen2.5-1.5b-instruct-q4_k_m.gguf" } },
};

export async function probeGPU() {
  if (!navigator.gpu || new URLSearchParams(location.search).has("cpu")) return false;
  try { return !!(await navigator.gpu.requestAdapter()); } catch { return false; }
}

// Returns { chat, backend } where chat = async (messages, onToken, opts) => full reply
export async function createEngine(kind, onProgress) {
  const m = MODELS[kind];
  if (await probeGPU()) {
    try {
      const webllm = await import("https://esm.run/@mlc-ai/web-llm");
      const engine = await webllm.CreateMLCEngine(m.mlc, {
        initProgressCallback: p => onProgress(p.progress, p.text)
      });
      return {
        backend: "GPU",
        chat: async (messages, onToken, opts = {}) => {
          let reply = "";
          const chunks = await engine.chat.completions.create({ messages, stream: true, max_tokens: opts.maxTokens });
          for await (const c of chunks) { reply += c.choices[0]?.delta?.content || ""; onToken?.(reply); }
          return reply;
        }
      };
    } catch (e) { console.warn("GPU engine failed, falling back to CPU:", e); }
  }
  const { Wllama } = await import("https://cdn.jsdelivr.net/npm/@wllama/wllama/esm/index.js");
  const wllama = new Wllama({ default: "https://cdn.jsdelivr.net/npm/@wllama/wllama/esm/wasm/wllama.wasm" });
  await wllama.loadModelFromHF(m.gguf, {
    n_gpu_layers: 0,
    progressCallback: ({ loaded, total }) => onProgress(total ? loaded / total : 0, `Downloading model… ${Math.round((loaded / total) * 100) || 0}%`)
  });
  return {
    backend: "CPU",
    chat: async (messages, onToken, opts = {}) => {
      const res = await wllama.createChatCompletion({ messages, max_tokens: opts.maxTokens ?? 512, temperature: opts.temperature ?? 0.7 });
      const reply = typeof res === "string" ? res : (res?.choices?.[0]?.message?.content ?? String(res));
      onToken?.(reply);
      return reply;
    }
  };
}
