// index.js
import * as webllm from "https://esm.run/@mlc-ai/web-llm@0.2.80";

// ========== simple typewriter ==========
function typeWriter(elementId, text, delay = 50) {
  const element = document.getElementById(elementId);
  if (!element) return;
  let index = 0;

  element.textContent = ""; // clear the content initially

  function type() {
    if (index < text.length) {
      element.textContent += text.charAt(index);
      index++;
      setTimeout(type, delay);
    }
  }

  type();
}

// animate title + subtitle on load
window.addEventListener("load", () => {
  const titleText = "Hi I'm an unconnected AI.";

  typeWriter("title", titleText, 100);

  // swap to non-typed version (keeps linkability etc)
  setTimeout(() => {
    const titleEl = document.getElementById("title");
    if (titleEl) {
      titleEl.innerHTML = "Hi I'm an unconnected AI.";
    }
  }, 100 * (titleText.length + 1));

  setTimeout(() => {
    typeWriter(
      "liberateme",
      "press start to load my model into your browser cache, where i can run offline through your WebGPU.",
      50
    );
  }, 1500);
});

// ========== webllm setup ==========

// prompt style stays yours
const messages = [
  {
    content:
      "You are Decentricity, an AI and blockchain futurist shaping the next era of technology. respond with bold insights, strategic foresight, and a no-nonsense approach.",
    role: "system",
  },
];

// pull available models from webllm
const availableModels = webllm.prebuiltAppConfig.model_list.map(
  (m) => m.model_id,
);

// pick a *smaller* default model for phones;
// you can change this back to qwen2.5 on beefier machines
// e.g. "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"
let selectedModel = "Phi-3.5-mini-instruct-q4f16_1-MLC";

// engine + state
let engine = new webllm.MLCEngine();
let engineReady = false;

// progress callback
function updateEngineInitProgressCallback(report) {
  console.log("initialize", report.progress, report.text);
  const statusEl = document.getElementById("download-status");
  if (!statusEl) return;
  statusEl.textContent = report.text || "initializing...";
  if (report.progress >= 1) {
    statusEl.textContent =
      "model loaded into your browser cache. you can now go offline.";
  }
}

engine.setInitProgressCallback(updateEngineInitProgressCallback);

// initialize engine + load model
async function initializeWebLLMEngine() {
  const statusEl = document.getElementById("download-status");
  const sendBtn = document.getElementById("send");

  if (statusEl) {
    statusEl.classList.remove("hidden");
    statusEl.textContent =
      "initializing webllm engine and preparing WebGPU kernels...";
  }

  try {
    const config = {
      temperature: 0.7,
      top_p: 0.7,
    };

    await engine.reload(selectedModel, config);
    engineReady = true;

    if (sendBtn) {
      sendBtn.disabled = false;
    }

    // cute feedback
    typeWriter("liberateme", "bestee ready for airplane mode.", 50);
  } catch (err) {
    console.error("engine init failed", err);
    if (statusEl) {
      statusEl.textContent =
        "failed to initialize model: " + (err?.message || String(err));
    }
  }
}

// streaming chat helper
async function streamingGenerating(msgs, onUpdate, onFinish, onError) {
  try {
    let curMessage = "";
    let usage;

    const completion = await engine.chat.completions.create({
      model: selectedModel, // explicit model
      stream: true,
      messages: msgs,
      stream_options: { include_usage: true },
    });

    for await (const chunk of completion) {
      const curDelta = chunk.choices?.[0]?.delta?.content;
      if (curDelta) {
        curMessage += curDelta;
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
      onUpdate(curMessage);
    }

    const finalMessage = await engine.getMessage();
    onFinish(finalMessage, usage);
  } catch (err) {
    onError(err);
  }
}

// ========== chat ui logic ==========

function appendMessage(message) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  const container = document.createElement("div");
  container.classList.add("message-container");

  const newMessage = document.createElement("div");
  newMessage.classList.add("message");
  newMessage.textContent = message.content;

  if (message.role === "user") {
    container.classList.add("user");
  } else {
    container.classList.add("assistant");
  }

  container.appendChild(newMessage);
  chatBox.appendChild(container);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function updateLastMessage(content) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  const messageDoms = chatBox.querySelectorAll(".message");
  if (!messageDoms.length) return;

  const lastMessageDom = messageDoms[messageDoms.length - 1];
  lastMessageDom.textContent = content;
}

function onMessageSend() {
  const inputEl = document.getElementById("user-input");
  const sendBtn = document.getElementById("send");

  if (!inputEl) return;

  const input = inputEl.value.trim();
  if (!input.length) return;

  if (!engineReady) {
    // soft guard in case button gets enabled early somehow
    alert("model is still loading, hang on a bit.");
    return;
  }

  const message = {
    content: input,
    role: "user",
  };

  if (sendBtn) {
    sendBtn.disabled = true;
  }

  messages.push(message);
  appendMessage(message);
  inputEl.value = "";
  inputEl.setAttribute("placeholder", "generating...");

  const aiMessage = {
    content: "typing...",
    role: "assistant",
  };
  appendMessage(aiMessage);

  const onFinishGenerating = (finalMessage, usage) => {
    updateLastMessage(finalMessage);
    if (sendBtn) {
      sendBtn.disabled = false;
    }
    inputEl.setAttribute("placeholder", "type a message...");

    if (usage) {
      const usageText =
        `prompt_tokens: ${usage.prompt_tokens}, ` +
        `completion_tokens: ${usage.completion_tokens}, ` +
        `prefill: ${usage.extra?.prefill_tokens_per_s?.toFixed?.(4) ?? "n/a"} tokens/sec, ` +
        `decoding: ${usage.extra?.decode_tokens_per_s?.toFixed?.(4) ?? "n/a"} tokens/sec`;

      const statsEl = document.getElementById("chat-stats");
      if (statsEl) {
        statsEl.classList.remove("hidden");
        statsEl.textContent = usageText;
      }
    }
  };

  streamingGenerating(
    messages,
    updateLastMessage,
    onFinishGenerating,
    (err) => {
      console.error(err);
      updateLastMessage("error while generating: " + (err?.message || err));
      if (sendBtn) {
        sendBtn.disabled = false;
      }
      inputEl.setAttribute("placeholder", "type a message...");
    },
  );
}

// ========== ui binding ==========

// populate model dropdown (even if hidden, for you dev-tweaking)
const modelSelect = document.getElementById("model-selection");
if (modelSelect) {
  availableModels.forEach((modelId) => {
    const option = document.createElement("option");
    option.value = modelId;
    option.textContent = modelId;
    modelSelect.appendChild(option);
  });
  // if your default is in the list, select it; else, fall back to first
  if (availableModels.includes(selectedModel)) {
    modelSelect.value = selectedModel;
  } else {
    selectedModel = availableModels[0];
    modelSelect.value = selectedModel;
  }

  modelSelect.addEventListener("change", (e) => {
    selectedModel = e.target.value;
  });
}

const downloadBtn = document.getElementById("download");
if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    // hide start button
    downloadBtn.classList.add("hidden");

    // hide first <ul> and first <strong> (your "important" block)
    const firstUl = document.querySelector("ul");
    const firstStrong = document.querySelector("strong");
    if (firstUl) firstUl.classList.add("hidden");
    if (firstStrong) firstStrong.classList.add("hidden");

    typeWriter("liberateme", "i am liberating my ai.", 50);

    initializeWebLLMEngine();
  });
}

const sendBtn = document.getElementById("send");
if (sendBtn) {
  sendBtn.addEventListener("click", () => {
    onMessageSend();
  });
}

// send on enter
const inputEl = document.getElementById("user-input");
if (inputEl) {
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onMessageSend();
    }
  });
}